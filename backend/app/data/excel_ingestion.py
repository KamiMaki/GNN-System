"""Excel (.xlsx) graph-data ingestion.

Reads the multi-sheet template (Node + Edge + Graph data sheets) and emits
DataFrames ready for the PyG converter. The task type and label column are
inferred directly from the data sheets — no Parameter sheet is required.

Schema:

    One sheet per level: ``Node``, ``Edge``, ``Graph``.
    Data sheets MAY contain a ``Type`` column:
        - Absent OR all values equal  → homogeneous (single key "default").
        - Present with multiple distinct values → heterogeneous; rows are split
          into per-type DataFrames keyed by type name.
    Any ``Parameter`` sheet present in the workbook is ignored.

Label inference:
    * If a ``Graph`` sheet exists with at least one non-id numeric column,
      the dataset is treated as a graph-level task and the label column is
      picked from that sheet (preferring names containing ``y``/``target``/
      ``label``/``score``; falling back to the first numeric non-id column).
    * Otherwise, if a ``Node`` sheet contains a label-like column, the dataset
      is treated as a node-level task with that column as label.
    * Edge-level prediction is not supported.
"""
from __future__ import annotations

import io
from typing import Optional

import pandas as pd

from app.data.excel_spec import (
    ExcelGraphSpec,
    ParameterEntry,
    VALID_LEVELS,
)


# ── Column-name normalisation ──
NODE_ID_CANDIDATES = ("Node", "node_id", "NodeID", "Node_ID", "node")
SRC_ID_CANDIDATES = ("Source_Node_ID", "src_id", "source", "Source", "SourceNodeID")
DST_ID_CANDIDATES = ("Target_Node_ID", "dst_id", "target", "Target", "TargetNodeID")
GRAPH_ID_CANDIDATES = ("Graph_ID", "graph_id", "GraphID")
TYPE_COL_CANDIDATES = ("Type", "type", "TYPE", "node_type", "edge_type")

# Reserved column names that never count as features / labels.
_NODE_RESERVED = {"node_id", "_graph", "_node_type", "Type", "Graph_ID", "Node"}
_EDGE_RESERVED = {"src_id", "dst_id", "_graph", "_edge_type", "Type",
                  "Graph_ID", "Source_Node_ID", "Target_Node_ID",
                  "src_type", "dst_type", "Edge_Type"}
_GRAPH_RESERVED = {"_graph", "Graph_ID"}


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


def _looks_like_label(name: str) -> bool:
    n = str(name).strip().lower()
    if n in {"y", "target", "label"}:
        return True
    return any(tok in n for tok in ("target", "label", "score"))


def _pick_label_column(
    df: pd.DataFrame,
    reserved: set[str],
    *,
    allow_numeric_fallback: bool,
) -> Optional[str]:
    """Find the most label-like numeric column in *df*.

    Preference:
        1. First column whose name matches ``_looks_like_label``.
        2. If ``allow_numeric_fallback`` (Graph sheet), the LAST numeric
           non-reserved column — spreadsheet convention places the target on
           the right.
    Returns None when no candidate exists.
    """
    candidates = [c for c in df.columns if c not in reserved]
    numeric = [c for c in candidates if pd.api.types.is_numeric_dtype(df[c])]

    for c in candidates:
        if _looks_like_label(c):
            return c
    if allow_numeric_fallback and numeric:
        return numeric[-1]
    return None


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
    return sheets


def _normalise_node_sheet(df: pd.DataFrame, sheet_name: str) -> pd.DataFrame:
    out = df.copy()
    node_col = _require(out, NODE_ID_CANDIDATES, sheet_name, "node id")
    if node_col != "node_id":
        out = out.rename(columns={node_col: "node_id"})
    out["node_id"] = out["node_id"].astype(str)
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
    out["src_id"] = out["src_id"].astype(str)
    out["dst_id"] = out["dst_id"].astype(str)

    g_col = _pick(out, GRAPH_ID_CANDIDATES)
    if g_col and g_col != "_graph":
        out = out.rename(columns={g_col: "_graph"})
    return out


def _split_by_type(
    df: pd.DataFrame,
    type_col: Optional[str],
    internal_col: str,
    default_label: str = "default",
) -> tuple[dict[str, pd.DataFrame], bool]:
    """Split *df* by the values in *type_col*.

    Returns:
        (per_type_dict, is_hetero)
        - per_type_dict: keyed by type string; each sub-frame has *internal_col*
          set to the type string and the original type column dropped.
        - is_hetero: True when more than one distinct type is present.
    """
    if type_col is None:
        # No Type column → homogeneous
        out = df.copy()
        out[internal_col] = default_label
        return {default_label: out}, False

    values = df[type_col].fillna(default_label).astype(str)
    distinct = values.unique().tolist()

    if len(distinct) <= 1:
        # All rows share the same type → treat as homogeneous
        label = distinct[0] if distinct else default_label
        out = df.drop(columns=[type_col]).copy()
        out[internal_col] = label
        return {label: out}, False

    # Multiple types → heterogeneous split
    per_type: dict[str, pd.DataFrame] = {}
    for t in distinct:
        sub = df[values == t].drop(columns=[type_col]).copy()
        sub[internal_col] = t
        per_type[t] = sub.reset_index(drop=True)

    return per_type, True


def _build_inferred_spec(
    node_dfs: dict[str, pd.DataFrame],
    edge_dfs: dict[str, pd.DataFrame],
    graph_df: Optional[pd.DataFrame],
    y_level: str,
    label_column: str,
) -> ExcelGraphSpec:
    """Construct an ExcelGraphSpec from the data sheets.

    For each per-type frame, every numeric column with at least one non-NaN
    value is registered as an X feature for that type. The Y entry is added on
    the resolved (level, type) where the label column lives.
    """
    entries: list[ParameterEntry] = []

    def _x_columns(df: pd.DataFrame, reserved: set[str]) -> list[str]:
        cols: list[str] = []
        for c in df.columns:
            if c in reserved or c == label_column:
                continue
            if not pd.api.types.is_numeric_dtype(df[c]):
                continue
            if df[c].notna().sum() == 0:
                continue
            cols.append(c)
        return cols

    for nt, df in node_dfs.items():
        for c in _x_columns(df, _NODE_RESERVED):
            entries.append(ParameterEntry(
                xy="X", level="Node", type_=nt, parameter=c,
            ))

    for et, df in edge_dfs.items():
        for c in _x_columns(df, _EDGE_RESERVED):
            entries.append(ParameterEntry(
                xy="X", level="Edge", type_=et, parameter=c,
            ))

    if graph_df is not None:
        for c in _x_columns(graph_df, _GRAPH_RESERVED):
            entries.append(ParameterEntry(
                xy="X", level="Graph", type_="default", parameter=c,
            ))

    if y_level == "Node":
        for nt, df in node_dfs.items():
            if label_column in df.columns and df[label_column].notna().any():
                entries.append(ParameterEntry(
                    xy="Y", level="Node", type_=nt, parameter=label_column,
                ))
                break
    elif y_level == "Graph":
        entries.append(ParameterEntry(
            xy="Y", level="Graph", type_="default", parameter=label_column,
        ))

    return ExcelGraphSpec(entries=entries)


def parse_excel_file(source: bytes | str, dataset_name: str = "") -> dict:
    """Parse an Excel workbook into PyG-ready DataFrames.

    Expected sheets: ``Node`` (required), ``Edge`` (optional), ``Graph``
    (optional). A ``Parameter`` sheet, if present, is ignored — task type and
    label column are inferred from the data sheets directly.

    Data sheets may contain a ``Type`` column:
        - Absent or single-valued → homogeneous (``is_heterogeneous=False``).
        - Multi-valued → heterogeneous (``is_heterogeneous=True``).

    Returns:
        dict with keys:
            spec                 : ExcelGraphSpec (built from data)
            is_heterogeneous     : bool
            nodes_df             : node DataFrame (concatenated, with ``_node_type``)
            edges_df             : edge DataFrame (concatenated, with ``_edge_type``)
            graph_df             : Optional[pd.DataFrame]
            node_dfs             : dict[node_type, DataFrame]
            edge_dfs             : dict[edge_type, DataFrame]
            canonical_edges      : list[tuple[src_type, rel, dst_type]]
            task_type            : e.g. "graph_regression"
            label_column         : Y column name
            label_weight         : float (always 1.0)
            name                 : dataset_name
    """
    sheets = _load_workbook(source)

    # ── Load Node sheet (required) ──
    if "Node" not in sheets:
        raise ValueError(
            "Excel workbook is missing the required 'Node' sheet. "
            "Please provide a sheet named exactly 'Node'."
        )
    node_norm = _normalise_node_sheet(sheets["Node"], "Node")
    node_type_col = _pick(node_norm, TYPE_COL_CANDIDATES)
    node_dfs, node_is_hetero = _split_by_type(node_norm, node_type_col, "_node_type")

    # ── Load Edge sheet (optional) ──
    edge_dfs: dict[str, pd.DataFrame] = {}
    edge_is_hetero = False
    if "Edge" in sheets:
        edge_norm = _normalise_edge_sheet(sheets["Edge"], "Edge")
        edge_type_col = _pick(edge_norm, TYPE_COL_CANDIDATES)
        edge_dfs, edge_is_hetero = _split_by_type(edge_norm, edge_type_col, "_edge_type")

    is_heterogeneous = node_is_hetero or edge_is_hetero

    # ── Load Graph sheet (optional) ──
    graph_df: Optional[pd.DataFrame] = None
    if "Graph" in sheets:
        graph_df = sheets["Graph"].copy()
        gcol = _pick(graph_df, GRAPH_ID_CANDIDATES)
        if gcol and gcol != "_graph":
            graph_df = graph_df.rename(columns={gcol: "_graph"})

    if not node_dfs:
        raise ValueError(
            "Node sheet contains no rows; at least one node is required."
        )

    # Unified views (concatenate per-type frames).
    unified_nodes = pd.concat(list(node_dfs.values()), ignore_index=True)
    unified_edges = (
        pd.concat(list(edge_dfs.values()), ignore_index=True)
        if edge_dfs
        else pd.DataFrame(columns=["src_id", "dst_id"])
    )

    # Canonical edges: derive from observed (src_type, edge_type, dst_type) triples
    # rather than a Cartesian product over all node/edge type combinations.
    canonical_edges: list[tuple[str, str, str]] = []
    if edge_dfs:
        if is_heterogeneous:
            node_type_lookup: dict[str, str] = dict(
                zip(
                    unified_nodes["node_id"].astype(str),
                    unified_nodes["_node_type"].astype(str),
                )
            )
            seen: set[tuple[str, str, str]] = set()
            for et, edf in edge_dfs.items():
                for _, row in edf.iterrows():
                    s = node_type_lookup.get(str(row["src_id"]))
                    d = node_type_lookup.get(str(row["dst_id"]))
                    if s is None or d is None:
                        continue
                    triple = (s, et, d)
                    if triple not in seen:
                        seen.add(triple)
                        canonical_edges.append(triple)
        else:
            node_t = next(iter(node_dfs))
            edge_t = next(iter(edge_dfs))
            canonical_edges.append((node_t, edge_t, node_t))

    # ── Infer task_type + label_column from data ──
    label_column: Optional[str] = None
    y_level: Optional[str] = None
    target_series: Optional[pd.Series] = None

    if graph_df is not None:
        candidate = _pick_label_column(
            graph_df, _GRAPH_RESERVED, allow_numeric_fallback=True,
        )
        if candidate is not None:
            label_column = candidate
            y_level = "Graph"
            target_series = graph_df[candidate]

    if label_column is None:
        # Fall back to a node-level label. Node sheets usually carry many
        # numeric features, so we require the column name to look like a
        # label rather than picking blindly.
        for nt, df in node_dfs.items():
            candidate = _pick_label_column(
                df, _NODE_RESERVED, allow_numeric_fallback=False,
            )
            if candidate is None:
                continue
            label_column = candidate
            y_level = "Node"
            target_series = df[candidate]
            break

    if label_column is None or y_level is None or target_series is None:
        raise ValueError(
            "Could not infer a label column from the workbook. Provide a "
            "Graph sheet with a numeric target column, or a Node sheet with a "
            "label-like column (containing 'y', 'target', 'label', or 'score')."
        )

    kind = _infer_task_kind(target_series)
    task_type = f"{y_level.lower()}_{kind}"

    spec = _build_inferred_spec(
        node_dfs, edge_dfs, graph_df, y_level, label_column,
    )

    return {
        "spec": spec,
        "is_heterogeneous": is_heterogeneous,
        "nodes_df": unified_nodes,
        "edges_df": unified_edges,
        "graph_df": graph_df,
        "node_dfs": node_dfs,
        "edge_dfs": edge_dfs,
        "canonical_edges": canonical_edges,
        "task_type": task_type,
        "label_column": label_column,
        "label_weight": 1.0,
        "name": dataset_name or "excel-upload",
        "schema_warnings": [],
    }
