"""Excel (.xlsx) graph-data ingestion — Phase 1.

Reads the 4-sheet template (Parameter + Node_{Type} + Edge_{Type} + Graph_{Type}),
derives the user's intended task from Y rows in the Parameter sheet, and emits
DataFrames in the same shape as the existing CSV ingestion so the downstream
PyG converter / training pipeline can consume them unchanged.

Phase 1 scope restrictions (raise ValueError otherwise):
    * at most one Type per Level
    * Y declared on Node **or** Graph (not both, not Edge)

Phase 2 will lift these: HeteroData for multi-Type, multi-task weighted loss
across Y levels, edge-level prediction heads.
"""
from __future__ import annotations

import io
from typing import Optional

import pandas as pd

from app.data.excel_spec import (
    ExcelGraphSpec,
    VALID_LEVELS,
    parse_parameter_sheet,
)


# ── Column-name normalisation ──
# Template convention     → existing CSV-pair convention used by pyg_converter
NODE_ID_CANDIDATES = ("Node", "node_id", "NodeID", "Node_ID", "node")
SRC_ID_CANDIDATES = ("Source_Node_ID", "src_id", "source", "Source", "SourceNodeID")
DST_ID_CANDIDATES = ("Target_Node_ID", "dst_id", "target", "Target", "TargetNodeID")
GRAPH_ID_CANDIDATES = ("Graph_ID", "graph_id", "GraphID")


def _pick(df: pd.DataFrame, candidates: tuple[str, ...]) -> Optional[str]:
    """Return the first candidate column name present in df (case-insensitive)."""
    lower = {str(c).lower(): c for c in df.columns}
    for cand in candidates:
        hit = lower.get(cand.lower())
        if hit is not None:
            return hit
    return None


def _require(df: pd.DataFrame, candidates: tuple[str, ...], sheet: str, label: str) -> str:
    col = _pick(df, candidates)
    if col is None:
        raise ValueError(
            f"Sheet '{sheet}' missing required {label} column "
            f"(looked for any of {list(candidates)})."
        )
    return col


def _infer_task_kind(series: pd.Series) -> str:
    """Return 'classification' or 'regression' based on a Y column's values."""
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        # Non-numeric labels → classification
        return "classification"
    nunique = clean.nunique()
    # Integer-only AND ≤ 20 distinct values → classification, else regression
    is_integer = bool(((clean.astype(float) % 1) == 0).all())
    if is_integer and nunique <= 20:
        return "classification"
    return "regression"


def _validate_phase1(spec: ExcelGraphSpec) -> None:
    """Enforce the Phase 1 scope boundary. Clear errors on violation."""
    # Rule 1: at most one Type per Level (heterogeneous deferred)
    for level in VALID_LEVELS:
        types = spec.types_for_level(level)
        if len(types) > 1:
            raise ValueError(
                f"Phase 1 supports only one Type per Level, but Level={level} "
                f"declares types {types}. Heterogeneous graphs are planned for Phase 2."
            )

    # Rule 2: at least one Y
    y_levels = spec.y_levels()
    if not y_levels:
        raise ValueError(
            "Parameter sheet must declare at least one Y row "
            "(to indicate the prediction target)."
        )

    # Rule 3: Edge Y deferred
    if "Edge" in y_levels:
        raise ValueError(
            "Phase 1 does not support edge-level prediction (Y on Edge). "
            "This is planned for Phase 2."
        )

    # Rule 4: at most one Y level in Phase 1 (multi-task deferred)
    if len(y_levels) > 1:
        raise ValueError(
            f"Phase 1 supports only one Y level, but Y is declared on multiple "
            f"levels: {y_levels}. Multi-task training is planned for Phase 2."
        )


def _load_workbook(source: bytes | str) -> dict[str, pd.DataFrame]:
    """Read every sheet into a DataFrame dict. Works with bytes or a path."""
    buf: io.BytesIO | str
    buf = io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else source
    try:
        sheets = pd.read_excel(buf, sheet_name=None, engine="openpyxl")
    except ImportError as e:
        raise ValueError(
            "openpyxl is required to read .xlsx files. Install with 'pip install openpyxl'."
        ) from e
    except Exception as e:
        raise ValueError(f"Could not read Excel file: {e}") from e
    if "Parameter" not in sheets:
        raise ValueError(
            "Excel workbook is missing the required 'Parameter' sheet."
        )
    return sheets


def _normalise_node_sheet(df: pd.DataFrame, sheet_name: str) -> pd.DataFrame:
    out = df.copy()
    node_col = _require(out, NODE_ID_CANDIDATES, sheet_name, "node id")
    if node_col != "node_id":
        out = out.rename(columns={node_col: "node_id"})
    # Optional Graph_ID → _graph (matches multi-graph CSV pipeline)
    g_col = _pick(out, GRAPH_ID_CANDIDATES)
    if g_col and g_col != "_graph":
        out = out.rename(columns={g_col: "_graph"})
    return out


def _normalise_edge_sheet(df: pd.DataFrame, sheet_name: str) -> pd.DataFrame:
    out = df.copy()
    src_col = _require(out, SRC_ID_CANDIDATES, sheet_name, "source node id")
    dst_col = _require(out, DST_ID_CANDIDATES, sheet_name, "target node id")
    renames = {}
    if src_col != "src_id":
        renames[src_col] = "src_id"
    if dst_col != "dst_id":
        renames[dst_col] = "dst_id"
    if renames:
        out = out.rename(columns=renames)
    g_col = _pick(out, GRAPH_ID_CANDIDATES)
    if g_col and g_col != "_graph":
        out = out.rename(columns={g_col: "_graph"})
    return out


def parse_excel_file(source: bytes | str, dataset_name: str = "") -> dict:
    """Parse an Excel workbook matching graph_data_template.xlsx.

    Returns a dict:
        {
          "spec":              ExcelGraphSpec,
          "nodes_df":          DataFrame with at minimum node_id column,
          "edges_df":          DataFrame with src_id / dst_id columns (possibly empty),
          "graph_df":          Optional DataFrame for graph-level features,
          "task_type":         "node_classification" | "node_regression"
                             | "graph_classification" | "graph_regression",
          "label_column":      name of the Y column,
          "label_weight":      float (defaults 1.0 — persisted for Phase 2),
          "name":              dataset_name,
        }
    Raises ValueError on any schema violation or Phase 1 boundary breach.
    """
    sheets = _load_workbook(source)
    spec = parse_parameter_sheet(sheets["Parameter"])
    _validate_phase1(spec)

    # Exactly one Y level (post-validation), exactly one Type per declared level.
    y_level = spec.y_levels()[0]           # "Node" or "Graph"

    # Resolve the Type for each declared level; fail fast if data sheet is missing.
    def _resolve(level: str) -> tuple[Optional[str], Optional[pd.DataFrame]]:
        types = spec.types_for_level(level)
        if not types:
            return None, None
        type_ = types[0]
        sheet_name = f"{level}_{type_}"
        if sheet_name not in sheets:
            raise ValueError(
                f"Parameter sheet declares Level={level} Type={type_} but data "
                f"sheet '{sheet_name}' is missing."
            )
        return type_, sheets[sheet_name]

    node_type, nodes_raw = _resolve("Node")
    edge_type, edges_raw = _resolve("Edge")
    graph_type, graph_raw = _resolve("Graph")

    if nodes_raw is None:
        raise ValueError(
            "Parameter sheet must declare at least one Node-level entry "
            "(to identify graph vertices)."
        )

    nodes_df = _normalise_node_sheet(nodes_raw, f"Node_{node_type}")
    edges_df = (
        _normalise_edge_sheet(edges_raw, f"Edge_{edge_type}")
        if edges_raw is not None
        else pd.DataFrame(columns=["src_id", "dst_id"])
    )
    graph_df = graph_raw.copy() if graph_raw is not None else None

    # ── derive task_type + label_column ──
    y_type = spec.types_for_level(y_level)[0]
    y_cols = spec.y_columns(y_level, y_type)
    # Phase 1 validated exactly one Y level; multiple Y columns in same level ⇒ take first + warn via persisted spec
    label_column = y_cols[0]

    if y_level == "Node":
        if label_column not in nodes_df.columns:
            raise ValueError(
                f"Label column '{label_column}' declared in Parameter sheet "
                f"is not present in data sheet Node_{node_type}."
            )
        kind = _infer_task_kind(nodes_df[label_column])
        task_type = f"node_{kind}"
    elif y_level == "Graph":
        if graph_df is None or label_column not in graph_df.columns:
            raise ValueError(
                f"Label column '{label_column}' declared in Parameter sheet "
                f"is not present in Graph_{graph_type} sheet."
            )
        kind = _infer_task_kind(graph_df[label_column])
        task_type = f"graph_{kind}"
    else:
        # Defensive; _validate_phase1 already filtered Edge.
        raise ValueError(f"Unsupported Y level in Phase 1: {y_level}")

    y_entries = [e for e in spec.entries if e.xy == "Y" and e.parameter == label_column]
    label_weight = y_entries[0].weight if y_entries and y_entries[0].weight is not None else 1.0

    return {
        "spec": spec,
        "nodes_df": nodes_df,
        "edges_df": edges_df,
        "graph_df": graph_df,
        "task_type": task_type,
        "label_column": label_column,
        "label_weight": label_weight,
        "name": dataset_name or "excel-upload",
    }
