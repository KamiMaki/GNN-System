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
    """Enforce the scope boundary for the current implementation.

    Multi-Y on a single Level (e.g. several Y columns all on Graph) is
    supported as of 2026-05-12 for the regression path. Multi-Y across
    different Levels and Edge-level Y remain deferred.
    """
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
            f"Multi-Y across different Levels is not yet supported; Y declared on "
            f"multiple levels: {y_levels}. Place all Y columns on the same Level."
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


def _discover_types_from_data(
    level: str,
    sheets: dict[str, pd.DataFrame],
) -> tuple[list[str], dict[str, pd.DataFrame]]:
    """Discover Type values for a Level by inspecting the data sheets.

    Used when the Parameter sheet omits the Type column. Prefers the unified
    single-sheet layout (a sheet literally named ``Node`` / ``Edge`` /
    ``Graph``); falls back to legacy per-type sheets named ``Level_<type>``.

    Returns ``(types, per_type_slices)``. ``per_type_slices`` is the source
    DataFrame restricted to rows of each Type — used downstream to decide
    which Parameters live on which Type.
    """
    if level in sheets:
        df = sheets[level]
        type_col = next(
            (c for c in df.columns if str(c).strip().lower() == "type"),
            None,
        )
        if type_col is None:
            return ["default"], {"default": df}
        types_seen: list[str] = []
        for raw in df[type_col].astype(str).map(str.strip):
            if raw and raw.lower() != "nan" and raw not in types_seen:
                types_seen.append(raw)
        slices = {
            t: df[df[type_col].astype(str).str.strip() == t].copy()
            for t in types_seen
        }
        return types_seen, slices

    prefix = f"{level}_"
    found: list[str] = []
    slices: dict[str, pd.DataFrame] = {}
    for name, df in sheets.items():
        if name.startswith(prefix):
            t = name[len(prefix):]
            found.append(t)
            slices[t] = df
    return found, slices


def _infer_param_types_from_sheets(
    spec: ExcelGraphSpec,
    sheets: dict[str, pd.DataFrame],
) -> None:
    """Populate ``spec`` with Type assignments derived from the data sheets.

    For each Level that has Parameter rows but no Type was given in the
    Parameter sheet, this walks the Node / Edge / Graph sheets, lists their
    distinct Type values, and assigns each Parameter to the Types whose slice
    actually contains data (i.e. the column exists and has at least one
    non-null value).
    """
    for level in VALID_LEVELS:
        level_entries = spec.entries_for_level(level)
        if not level_entries:
            continue
        types, type_slices = _discover_types_from_data(level, sheets)
        if not types:
            decl = sorted({e.parameter for e in level_entries})
            raise ValueError(
                f"Parameter sheet declares {level}-level parameters {decl} but "
                f"no '{level}' (or 'Level_<type>') data sheet was found to "
                f"infer Types from."
            )

        param_to_types: dict[str, list[str]] = {}
        for e in level_entries:
            matched: list[str] = []
            for t in types:
                sub = type_slices[t]
                if e.parameter in sub.columns and sub[e.parameter].notna().any():
                    matched.append(t)
            if not matched:
                raise ValueError(
                    f"Parameter '{e.parameter}' (Level={level}) is declared in "
                    f"the Parameter sheet but no Type slice of the {level} "
                    f"sheet carries non-null data for that column. Either "
                    f"populate the column or remove the row from the Parameter "
                    f"sheet."
                )
            param_to_types[e.parameter] = matched

        spec.assign_types_for_level(level, types, param_to_types)


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

    # When the Parameter sheet omits the Type column, derive Types (and per-
    # Parameter Type membership) from the data sheets themselves.
    if not spec.types_declared_in_parameter_sheet:
        _infer_param_types_from_sheets(spec, sheets)

    y_level = spec.y_levels()[0]           # "Node" or "Graph"

    def _split_unified_by_type(unified: pd.DataFrame, level: str,
                               declared_types: list[str]) -> dict[str, pd.DataFrame]:
        """Split a single ``Node``/``Edge``/``Graph`` sheet by its Type column.

        Columns declared for OTHER types in the Parameter sheet are dropped
        from each per-type slice so downstream feature extraction doesn't
        treat them as missing-data columns.

        When the data sheet has **no** Type column:
          * If the Parameter sheet declares exactly one Type for this Level,
            all rows are assigned to that single Type — homogeneous-friendly
            layout where the user can skip the Type column entirely.
          * If the Parameter sheet declares more than one Type, a Type column
            is required to disambiguate — raise a clear ValueError.
        """
        type_col = next(
            (c for c in unified.columns if str(c).strip().lower() == "type"),
            None,
        )
        if type_col is None:
            if len(declared_types) == 1:
                # Homogeneous layout: synthesise a Type column with the
                # single declared type so the rest of the function works
                # uniformly.
                unified = unified.copy()
                unified["Type"] = declared_types[0]
                type_col = "Type"
            else:
                raise ValueError(
                    f"Sheet '{level}' is missing a 'Type' column. "
                    f"The Parameter sheet declares multiple Types "
                    f"({declared_types}); a Type column is required to "
                    f"split rows. (For a single-Type / homogeneous sheet you "
                    f"may omit the Type column.)"
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

    # ── derive task_type + label_columns (multi-Y aware) ──
    # All Y entries are on the same Level (validated above). Multiple Y
    # entries per Level — each becomes a parallel regression target.
    y_entries_all = [e for e in spec.entries if e.xy == "Y" and e.level == y_level]

    def _resolve_y_type(e) -> str:
        if e.type_ is not None:
            return e.type_
        candidates = spec.types_for_parameter(e.level, e.parameter)
        if len(candidates) == 1:
            return candidates[0]
        raise ValueError(
            f"Y column '{e.parameter}' on {e.level} resolves to multiple Types "
            f"{candidates or '∅'}. Y must belong to exactly one Type — either "
            f"declare the Type in the Parameter sheet or restrict the column "
            f"to a single Type's rows."
        )

    y_types_seen: list[str] = []
    for e in y_entries_all:
        t = _resolve_y_type(e)
        if t not in y_types_seen:
            y_types_seen.append(t)

    label_columns: list[str] = [e.parameter for e in y_entries_all]
    label_weights: list[float] = [
        float(e.weight) if e.weight is not None else 1.0
        for e in y_entries_all
    ]

    # Locate the source DataFrame holding each Y column + verify presence.
    def _source_df_for_level(level: str, type_: str) -> pd.DataFrame:
        if level == "Node":
            df = node_dfs.get(type_)
            sheet_label = f"Node_{type_}"
        else:  # Graph
            df = graph_df
            sheet_label = f"Graph_{type_}"
        if df is None:
            raise ValueError(
                f"Parameter sheet declares Y on {level}/{type_} but the "
                f"{sheet_label} data sheet is missing."
            )
        return df

    kinds: list[str] = []
    for e in y_entries_all:
        y_t = _resolve_y_type(e)
        src_df = _source_df_for_level(y_level, y_t)
        if e.parameter not in src_df.columns:
            raise ValueError(
                f"Label column '{e.parameter}' declared in Parameter sheet "
                f"is not present in data sheet {y_level}_{y_t}."
            )
        kinds.append(_infer_task_kind(src_df[e.parameter]))

    if len(set(kinds)) > 1:
        mixed = list(zip(label_columns, kinds))
        raise ValueError(
            f"All Y columns must be the same kind (regression or classification); "
            f"got mixed kinds: {mixed}."
        )
    kind = kinds[0]
    if len(label_columns) > 1 and kind == "classification":
        raise ValueError(
            "Multi-Y classification is not yet supported; only multi-Y "
            "regression is supported in this release."
        )
    task_type = f"{y_level.lower()}_{kind}"

    # Backwards-compatible singular fields (first Y).
    label_column = label_columns[0]
    label_weight = label_weights[0]

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
        "label_columns": label_columns,
        "label_weights": label_weights,
        "name": dataset_name or "excel-upload",
    }
