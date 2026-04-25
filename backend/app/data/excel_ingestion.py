"""Excel (.xlsx) graph-data ingestion.

Reads the multi-sheet template (Parameter + Node/Edge/Graph data sheets),
derives the user's intended task from Y rows in the Parameter sheet, and emits
DataFrames ready for the PyG converter.

Schema (2026-04-25 — V2 simplified):

    One sheet per level:  ``Node``, ``Edge``, ``Graph``.
    No ``Type`` column in data sheets.
    The Parameter sheet still carries a ``Type`` column but each Level must
    declare exactly one distinct Type value (heterogeneous graphs are not
    supported; use a single Type per Level).

Scope:
    * Homogeneous graphs only.
    * Y must be declared on exactly one Level (Node or Graph).
    * Edge-level prediction (Y on Edge) is still deferred.
"""
from __future__ import annotations

import io
from typing import Optional

import pandas as pd

from app.data.excel_spec import (
    ExcelGraphSpec,
    VALID_LEVELS,
    parse_parameter_sheet,
    validate_single_type_per_level,
)


# ── Column-name normalisation ──
NODE_ID_CANDIDATES = ("Node", "node_id", "NodeID", "Node_ID", "node")
SRC_ID_CANDIDATES = ("Source_Node_ID", "src_id", "source", "Source", "SourceNodeID")
DST_ID_CANDIDATES = ("Target_Node_ID", "dst_id", "target", "Target", "TargetNodeID")
GRAPH_ID_CANDIDATES = ("Graph_ID", "graph_id", "GraphID")


def _pick(df: pd.DataFrame, candidates: tuple[str, ...]) -> Optional[str]:
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
        return "classification"
    nunique = clean.nunique()
    is_integer = bool(((clean.astype(float) % 1) == 0).all())
    if is_integer and nunique <= 20:
        return "classification"
    return "regression"


def _validate_scope(spec: ExcelGraphSpec) -> None:
    """Enforce the scope boundary for the current implementation."""
    y_levels = spec.y_levels()
    if not y_levels:
        raise ValueError(
            "Parameter sheet must declare at least one Y row "
            "(to indicate the prediction target)."
        )
    if "Edge" in y_levels:
        raise ValueError(
            "Edge-level prediction (Y on Edge) is not yet supported."
        )
    if len(y_levels) > 1:
        raise ValueError(
            f"Multi-task training is not yet supported; Y declared on "
            f"multiple levels: {y_levels}."
        )


def _load_workbook(source: bytes | str) -> dict[str, pd.DataFrame]:
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

    Expected sheets: ``Parameter``, ``Node``, ``Edge`` (optional), ``Graph`` (optional).
    Data sheets must NOT contain a ``Type`` column — one sheet per level, homogeneous only.

    Returns:
        dict with keys:
            spec                 : ExcelGraphSpec
            is_heterogeneous     : bool  (always False under the simplified schema)
            nodes_df             : node DataFrame
            edges_df             : edge DataFrame
            graph_df             : Optional[pd.DataFrame]
            node_dfs             : dict[node_type, DataFrame]  (single key "default")
            edge_dfs             : dict[edge_type, DataFrame]  (single key "default", or {})
            canonical_edges      : list[tuple[src_type, rel, dst_type]]
            task_type            : e.g. "graph_regression"
            label_column         : Y column name
            label_weight         : float (default 1.0)
            name                 : dataset_name
    """
    sheets = _load_workbook(source)
    spec = parse_parameter_sheet(sheets["Parameter"])
    _validate_scope(spec)
    validate_single_type_per_level(spec)

    y_level = spec.y_levels()[0]           # "Node" or "Graph"

    # ── Load Node sheet (required) ──
    if "Node" not in sheets:
        raise ValueError(
            "Excel workbook is missing the required 'Node' sheet. "
            "Please provide a sheet named exactly 'Node'."
        )
    node_type = spec.types_for_level("Node")[0]
    node_norm = _normalise_node_sheet(sheets["Node"], "Node")
    node_norm["_node_type"] = "default"
    node_dfs: dict[str, pd.DataFrame] = {"default": node_norm}

    # ── Load Edge sheet (optional) ──
    edge_dfs: dict[str, pd.DataFrame] = {}
    if "Edge" in sheets:
        edge_norm = _normalise_edge_sheet(sheets["Edge"], "Edge")
        edge_norm["_edge_type"] = "default"
        edge_dfs["default"] = edge_norm

    # ── Load Graph sheet (optional) ──
    graph_df: Optional[pd.DataFrame] = None
    if "Graph" in sheets:
        graph_df = sheets["Graph"].copy()
        gcol = _pick(graph_df, GRAPH_ID_CANDIDATES)
        if gcol and gcol != "_graph":
            graph_df = graph_df.rename(columns={gcol: "_graph"})

    if not node_dfs:
        raise ValueError(
            "Parameter sheet must declare at least one Node-level entry "
            "(to identify graph vertices)."
        )

    # Unified views (single type → same as the one df).
    unified_nodes = node_norm.copy()
    unified_edges = (
        edge_norm.copy()
        if edge_dfs else pd.DataFrame(columns=["src_id", "dst_id"])
    )

    # Canonical edges: homogeneous → single (default, default, default).
    canonical_edges: list[tuple[str, str, str]] = []
    if edge_dfs:
        canonical_edges.append(("default", "default", "default"))

    # ── derive task_type + label_column ──
    y_type = spec.types_for_level(y_level)[0]
    y_cols = spec.y_columns(y_level, y_type)
    label_column = y_cols[0]

    if y_level == "Node":
        target_df = node_dfs.get("default")
        if target_df is None or label_column not in target_df.columns:
            raise ValueError(
                f"Label column '{label_column}' declared in Parameter sheet "
                f"is not present in the Node sheet."
            )
        kind = _infer_task_kind(target_df[label_column])
        task_type = f"node_{kind}"
    elif y_level == "Graph":
        if graph_df is None or label_column not in graph_df.columns:
            raise ValueError(
                f"Label column '{label_column}' declared in Parameter sheet "
                f"is not present in the Graph sheet."
            )
        kind = _infer_task_kind(graph_df[label_column])
        task_type = f"graph_{kind}"
    else:
        raise ValueError(f"Unsupported Y level: {y_level}")

    y_entries = [e for e in spec.entries if e.xy == "Y" and e.parameter == label_column]
    label_weight = y_entries[0].weight if y_entries and y_entries[0].weight is not None else 1.0

    return {
        "spec": spec,
        "is_heterogeneous": False,
        "nodes_df": unified_nodes,
        "edges_df": unified_edges,
        "graph_df": graph_df,
        "node_dfs": node_dfs,
        "edge_dfs": edge_dfs,
        "canonical_edges": canonical_edges,
        "task_type": task_type,
        "label_column": label_column,
        "label_weight": label_weight,
        "name": dataset_name or "excel-upload",
    }
