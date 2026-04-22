"""Heterogeneous graph conversion — DataFrames → torch_geometric.data.HeteroData.

Consumes the output of ``excel_ingestion.parse_excel_file`` for heterogeneous
graphs. Each node Type becomes a ``HeteroData`` node type; each edge Type (with
its (src_type, rel, dst_type) canonical triple) becomes a relation.

This module focuses on **graph regression / graph classification** where ``y``
is a single scalar per graph taken from the Graph_{type} sheet, aligned by
``_graph``. Node-level heterogeneous prediction is deferred.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import torch
from sklearn.preprocessing import StandardScaler
from torch_geometric.data import HeteroData


def _numeric_feature_columns(df: pd.DataFrame, exclude: set[str]) -> list[str]:
    cols = []
    for c in df.columns:
        if c in exclude:
            continue
        if pd.api.types.is_numeric_dtype(df[c]):
            cols.append(c)
    return cols


def _fit_scalers(
    node_dfs: dict[str, pd.DataFrame],
    exclude: set[str],
) -> tuple[dict[str, StandardScaler], dict[str, list[str]]]:
    scalers: dict[str, StandardScaler] = {}
    feature_cols: dict[str, list[str]] = {}
    for t, df in node_dfs.items():
        cols = _numeric_feature_columns(df, exclude)
        feature_cols[t] = cols
        if cols:
            vals = df[cols].fillna(0.0).to_numpy(dtype=np.float32)
            sc = StandardScaler()
            sc.fit(vals)
            scalers[t] = sc
        else:
            scalers[t] = StandardScaler()
    return scalers, feature_cols


def _build_single_hetero(
    graph_id,
    node_dfs: dict[str, pd.DataFrame],
    edge_dfs: dict[str, pd.DataFrame],
    graph_df: pd.DataFrame,
    label_column: str,
    canonical_edges: list[tuple[str, str, str]],
    scalers: dict[str, StandardScaler],
    feature_cols: dict[str, list[str]],
) -> HeteroData:
    """Build one HeteroData for a single graph_id."""
    data = HeteroData()

    # node types + id → local index maps per type
    id_maps: dict[str, dict] = {}
    for nt, df in node_dfs.items():
        sub = df[df["_graph"] == graph_id] if "_graph" in df.columns else df
        sub = sub.reset_index(drop=True)
        id_map = {int(v): i for i, v in enumerate(sub["node_id"].tolist())}
        id_maps[nt] = id_map

        cols = feature_cols[nt]
        if cols:
            vals = sub[cols].fillna(0.0).to_numpy(dtype=np.float32)
            vals = scalers[nt].transform(vals).astype(np.float32) if len(vals) else vals
        else:
            vals = np.zeros((len(sub), 1), dtype=np.float32)
        data[nt].x = torch.tensor(vals, dtype=torch.float)
        data[nt].num_nodes = len(sub)

    # edge types
    for src_t, rel, dst_t in canonical_edges:
        edf = edge_dfs[rel]
        sub = edf[edf["_graph"] == graph_id] if "_graph" in edf.columns else edf
        sub = sub.reset_index(drop=True)
        src_idx = []
        dst_idx = []
        for _, row in sub.iterrows():
            s = int(row["src_id"])
            d = int(row["dst_id"])
            if s in id_maps[src_t] and d in id_maps[dst_t]:
                src_idx.append(id_maps[src_t][s])
                dst_idx.append(id_maps[dst_t][d])
        if src_idx:
            edge_index = torch.tensor([src_idx, dst_idx], dtype=torch.long)
        else:
            edge_index = torch.zeros((2, 0), dtype=torch.long)
        data[src_t, rel, dst_t].edge_index = edge_index

    # graph-level label
    row = graph_df[graph_df["_graph"] == graph_id]
    if row.empty:
        raise ValueError(f"Graph_{label_column}: no row found for graph {graph_id}")
    y_val = row[label_column].iloc[0]
    data.y = torch.tensor([float(y_val)], dtype=torch.float)

    return data


def parsed_excel_to_hetero_list(
    parsed: dict,
) -> tuple[list[HeteroData], dict[str, StandardScaler], dict[str, list[str]], list[tuple[str, str, str]]]:
    """Convert a parse_excel_file() result into a list of HeteroData (one per graph).

    Returns:
        data_list, scalers, feature_names_by_type, metadata_edges
    metadata_edges is a list of canonical (src_type, relation, dst_type) tuples —
    together with sorted(scalers.keys()) this forms the HeteroData metadata needed
    by ``to_hetero()``.
    """
    node_dfs = parsed["node_dfs"]
    edge_dfs = parsed["edge_dfs"]
    graph_df = parsed["graph_df"]
    label_column = parsed["label_column"]
    canonical_edges = parsed["canonical_edges"]

    if graph_df is None:
        raise ValueError(
            "Heterogeneous graph_regression requires a Graph-level sheet with the "
            "Y column; none was provided."
        )

    exclude = {"node_id", "_graph", "_node_type", "_edge_type",
               "src_id", "dst_id", "src_type", "dst_type", "Graph_ID",
               "Type", "Edge_Type"}

    scalers, feature_cols = _fit_scalers(node_dfs, exclude)

    graph_ids = sorted({
        gid for df in node_dfs.values() if "_graph" in df.columns
        for gid in df["_graph"].dropna().unique().tolist()
    })
    if not graph_ids:
        # Single implicit graph
        graph_ids = [graph_df["_graph"].iloc[0] if "_graph" in graph_df.columns else 1]

    data_list: list[HeteroData] = []
    for gid in graph_ids:
        d = _build_single_hetero(
            gid, node_dfs, edge_dfs, graph_df, label_column,
            canonical_edges, scalers, feature_cols,
        )
        data_list.append(d)

    return data_list, scalers, feature_cols, canonical_edges
