"""Excel (.xlsx) graph-data ingestion.

Reads the multi-sheet template (Parameter + Node/Edge/Graph data sheets),
derives the user's intended task from Y rows in the Parameter sheet, and emits
DataFrames ready for the PyG converter.

Two sheet layouts are supported (Phase 4 — 2026-04-24):

1.  **Unified single-sheet layout (preferred for heterogeneous graphs)**
        Node data lives in a single ``Node`` sheet with a ``Type`` column.
        Every declared feature is a column; rows that don't carry a given
        feature leave the cell blank. The same applies to ``Edge`` and
        ``Graph`` sheets.

2.  **Legacy per-type layout (still accepted for backwards compatibility)**
        Each (Level, Type) pair lives in its own sheet, e.g. ``Node_cell``,
        ``Node_pin``, ``Edge_cell2pin``.

Scope:
    * Homogeneous and heterogeneous graphs both supported.
    * Y must be declared on exactly one Level (Node or Graph).
    * Edge-level prediction (Y on Edge) is still deferred.

Heterogeneous Edge sheet convention:
    In addition to Source_Node_ID / Target_Node_ID, edge rows in hetero mode
    declare Source_Node_Type / Target_Node_Type columns so
    (src_type, rel, dst_type) canonical edges can be constructed. For
    homogeneous graphs these columns are optional — the single declared node
    type is used by default.
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
NODE_ID_CANDIDATES = ("Node", "node_id", "NodeID", "Node_ID", "node")
SRC_ID_CANDIDATES = ("Source_Node_ID", "src_id", "source", "Source", "SourceNodeID")
DST_ID_CANDIDATES = ("Target_Node_ID", "dst_id", "target", "Target", "TargetNodeID")
GRAPH_ID_CANDIDATES = ("Graph_ID", "graph_id", "GraphID")
SRC_TYPE_CANDIDATES = ("Source_Node_Type", "src_type", "SourceType")
DST_TYPE_CANDIDATES = ("Target_Node_Type", "dst_type", "TargetType")


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

    src_type_col = _pick(out, SRC_TYPE_CANDIDATES)
    dst_type_col = _pick(out, DST_TYPE_CANDIDATES)
    if src_type_col and src_type_col != "src_type":
        renames[src_type_col] = "src_type"
    if dst_type_col and dst_type_col != "dst_type":
        renames[dst_type_col] = "dst_type"
    if renames:
        out = out.rename(columns=renames)

    g_col = _pick(out, GRAPH_ID_CANDIDATES)
    if g_col and g_col != "_graph":
        out = out.rename(columns={g_col: "_graph"})
    return out


def parse_excel_file(source: bytes | str, dataset_name: str = "") -> dict:
    """Parse an Excel workbook matching graph_data_template.xlsx.

    Returns:
        dict with keys:
            spec                 : ExcelGraphSpec
            is_heterogeneous     : bool
            nodes_df             : unified node DataFrame (homo) — also emitted in hetero
                                   mode by concatenating all type-tagged node sheets
            edges_df             : unified edge DataFrame (homo+hetero)
            graph_df             : Optional[pd.DataFrame]
            node_dfs             : dict[node_type, DataFrame]   (hetero path)
            edge_dfs             : dict[edge_type, DataFrame]   (hetero path)
            canonical_edges      : list[tuple[src_type, rel, dst_type]]
            task_type            : e.g. "graph_regression"
            label_column         : Y column name
            label_weight         : float (default 1.0)
            name                 : dataset_name
    """
    sheets = _load_workbook(source)
    spec = parse_parameter_sheet(sheets["Parameter"])
    _validate_scope(spec)

    y_level = spec.y_levels()[0]           # "Node" or "Graph"

    def _split_unified_by_type(unified: pd.DataFrame, level: str,
                               declared_types: list[str]) -> dict[str, pd.DataFrame]:
        """Split a single ``Node``/``Edge``/``Graph`` sheet by its Type column.

        Columns declared for OTHER types in the Parameter sheet are dropped
        from each per-type slice so downstream feature extraction doesn't
        treat them as missing-data columns.
        """
        type_col = next(
            (c for c in unified.columns if str(c).strip().lower() == "type"),
            None,
        )
        if type_col is None:
            raise ValueError(
                f"Sheet '{level}' is missing a 'Type' column "
                f"(required when using the unified single-sheet layout; "
                f"expected types: {declared_types})."
            )
        if type_col != "Type":
            unified = unified.rename(columns={type_col: "Type"})

        declared_params_by_type: dict[str, set[str]] = {
            t: {e.parameter for e in spec.entries_for(level, t)}
            for t in declared_types
        }
        all_declared_params: set[str] = set().union(*declared_params_by_type.values())

        out: dict[str, pd.DataFrame] = {}
        for t in declared_types:
            mask = unified["Type"].astype(str).str.strip() == t
            sub = unified[mask].copy()
            if sub.empty:
                raise ValueError(
                    f"Sheet '{level}' declares Type='{t}' in the Parameter "
                    f"sheet but no rows with that Type value were found."
                )
            # Drop columns declared for OTHER types (they'd otherwise appear
            # as all-NaN feature columns for this type).
            other_only = {
                p for p in all_declared_params if p not in declared_params_by_type[t]
            }
            drop_cols = [c for c in other_only if c in sub.columns]
            if drop_cols:
                sub = sub.drop(columns=drop_cols)
            out[t] = sub.reset_index(drop=True)
        return out

    def _resolve_all(level: str) -> dict[str, pd.DataFrame]:
        """Return {type: DataFrame} for every declared Type on a Level.

        Prefers the unified single-sheet layout (``Node`` / ``Edge`` / ``Graph``
        sheet with a ``Type`` column). Falls back to the legacy per-type
        sheets (``Node_{type}`` / ``Edge_{type}`` / ``Graph_{type}``).
        """
        declared_types = spec.types_for_level(level)
        if not declared_types:
            return {}

        # Preferred: unified single-sheet layout.
        if level in sheets:
            return _split_unified_by_type(sheets[level], level, declared_types)

        # Legacy: one sheet per Type.
        out: dict[str, pd.DataFrame] = {}
        for t in declared_types:
            sheet_name = f"{level}_{t}"
            if sheet_name not in sheets:
                raise ValueError(
                    f"Parameter sheet declares Level={level} Type={t} but "
                    f"neither a unified '{level}' sheet nor a per-type "
                    f"'{sheet_name}' sheet is present in the workbook."
                )
            out[t] = sheets[sheet_name]
        return out

    node_raw = _resolve_all("Node")
    edge_raw = _resolve_all("Edge")
    graph_raw = _resolve_all("Graph")

    if not node_raw:
        raise ValueError(
            "Parameter sheet must declare at least one Node-level entry "
            "(to identify graph vertices)."
        )

    # Normalise each type sheet individually.
    node_dfs: dict[str, pd.DataFrame] = {}
    for t, df in node_raw.items():
        norm = _normalise_node_sheet(df, f"Node_{t}")
        norm["_node_type"] = t
        node_dfs[t] = norm

    edge_dfs: dict[str, pd.DataFrame] = {}
    for t, df in edge_raw.items():
        norm = _normalise_edge_sheet(df, f"Edge_{t}")
        norm["_edge_type"] = t
        edge_dfs[t] = norm

    graph_df: Optional[pd.DataFrame] = None
    if graph_raw:
        # Single Type for Graph level expected; concat to be safe.
        graph_df = pd.concat(list(graph_raw.values()), ignore_index=True)
        gcol = _pick(graph_df, GRAPH_ID_CANDIDATES)
        if gcol and gcol != "_graph":
            graph_df = graph_df.rename(columns={gcol: "_graph"})

    # Unified views for homogeneous pipeline + explore stats.
    unified_nodes = pd.concat(list(node_dfs.values()), ignore_index=True)
    unified_edges = (
        pd.concat(list(edge_dfs.values()), ignore_index=True)
        if edge_dfs else pd.DataFrame(columns=["src_id", "dst_id"])
    )

    # Canonical edges: (src_type, relation, dst_type) for HeteroData.
    canonical_edges: list[tuple[str, str, str]] = []
    default_node_type = next(iter(node_dfs))  # first declared node type
    for rel, edf in edge_dfs.items():
        if "src_type" in edf.columns and "dst_type" in edf.columns and not edf.empty:
            # Take first row to determine canonical types; downstream validation
            # asserts consistency.
            st = str(edf["src_type"].iloc[0])
            dt = str(edf["dst_type"].iloc[0])
        else:
            st = dt = default_node_type
        canonical_edges.append((st, rel, dt))

    # ── derive task_type + label_column ──
    y_type = spec.types_for_level(y_level)[0]
    y_cols = spec.y_columns(y_level, y_type)
    label_column = y_cols[0]

    if y_level == "Node":
        target_df = node_dfs.get(y_type)
        if target_df is None or label_column not in target_df.columns:
            raise ValueError(
                f"Label column '{label_column}' declared in Parameter sheet "
                f"is not present in data sheet Node_{y_type}."
            )
        kind = _infer_task_kind(target_df[label_column])
        task_type = f"node_{kind}"
    elif y_level == "Graph":
        if graph_df is None or label_column not in graph_df.columns:
            raise ValueError(
                f"Label column '{label_column}' declared in Parameter sheet "
                f"is not present in Graph_{y_type} sheet."
            )
        kind = _infer_task_kind(graph_df[label_column])
        task_type = f"graph_{kind}"
    else:
        raise ValueError(f"Unsupported Y level: {y_level}")

    y_entries = [e for e in spec.entries if e.xy == "Y" and e.parameter == label_column]
    label_weight = y_entries[0].weight if y_entries and y_entries[0].weight is not None else 1.0

    return {
        "spec": spec,
        "is_heterogeneous": spec.is_heterogeneous(),
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
