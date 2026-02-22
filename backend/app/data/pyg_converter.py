import numpy as np
import torch
from torch_geometric.data import Data
from sklearn.preprocessing import StandardScaler
import pandas as pd

from app.core.config import settings
from app.data.feature_engineering import detect_column_type


EDGE_NUMERIC_FEATURES = ["wire_cap_ff", "wire_length_um"]


def dataframes_to_pyg(
    nodes_df: pd.DataFrame,
    edges_df: pd.DataFrame,
    scaler: StandardScaler | None = None,
    fit_scaler: bool = True,
    task_type: str = "node_classification",
) -> tuple[Data, StandardScaler]:
    """Convert validated node/edge DataFrames to a PyG Data object (legacy, hardcoded features).

    Feature matrix X: [N, 7 numeric + 4 one-hot cell_type = 11]
    Labels y: depends on task_type
    Edge index: [2, E]
    Edge attr: [E, 2] (wire_cap_ff, wire_length_um)

    Returns (Data, fitted_scaler).
    """
    # Node ID mapping
    node_ids = nodes_df["node_id"].values
    id_to_idx = {int(nid): i for i, nid in enumerate(node_ids)}

    # One-hot encode cell_type
    cell_types = nodes_df["cell_type"].values
    cell_type_ohe = np.zeros((len(nodes_df), len(settings.CELL_TYPES)), dtype=np.float32)
    for i, ct in enumerate(cell_types):
        if ct in settings.CELL_TYPES:
            cell_type_ohe[i, settings.CELL_TYPES.index(ct)] = 1.0

    # Normalize numeric features
    numeric_vals = nodes_df[settings.NUMERIC_FEATURES].values.astype(np.float32)
    if fit_scaler:
        scaler = StandardScaler()
        numeric_vals = scaler.fit_transform(numeric_vals).astype(np.float32)
    else:
        numeric_vals = scaler.transform(numeric_vals).astype(np.float32)

    # Concatenate: [N, 11]
    x = np.concatenate([numeric_vals, cell_type_ohe], axis=1)

    # Labels - depend on task_type
    if task_type in ("node_classification", "graph_classification"):
        node_labels = nodes_df[settings.LABEL_COLUMN].values.astype(np.int64)
        if task_type == "graph_classification":
            graph_label = 1 if node_labels.mean() > 0.15 else 0
            y = torch.tensor([graph_label], dtype=torch.long)
        else:
            y = torch.tensor(node_labels, dtype=torch.long)
    elif task_type in ("node_regression", "graph_regression"):
        node_scores = nodes_df[settings.REGRESSION_LABEL].values.astype(np.float32)
        if task_type == "graph_regression":
            graph_score = float(node_scores.mean())
            y = torch.tensor([graph_score], dtype=torch.float)
        else:
            y = torch.tensor(node_scores, dtype=torch.float)
    else:
        y = torch.tensor(nodes_df[settings.LABEL_COLUMN].values.astype(np.int64), dtype=torch.long)

    # Build edge_index (filter edges with invalid node IDs)
    valid_mask = edges_df["src_id"].isin(id_to_idx) & edges_df["dst_id"].isin(id_to_idx)
    valid_edges = edges_df[valid_mask]
    src_idx = [id_to_idx[int(s)] for s in valid_edges["src_id"].values]
    dst_idx = [id_to_idx[int(d)] for d in valid_edges["dst_id"].values]
    edge_index = torch.tensor([src_idx, dst_idx], dtype=torch.long)

    # Edge features
    edge_attr_vals = valid_edges[EDGE_NUMERIC_FEATURES].values.astype(np.float32)

    data = Data(
        x=torch.tensor(x, dtype=torch.float),
        y=y,
        edge_index=edge_index,
        edge_attr=torch.tensor(edge_attr_vals, dtype=torch.float),
        num_nodes=len(nodes_df),
    )
    return data, scaler


def dataframes_to_pyg_dynamic(
    nodes_df: pd.DataFrame,
    edges_df: pd.DataFrame,
    label_column: str,
    task_type: str,
    scaler: StandardScaler | None = None,
    fit_scaler: bool = True,
) -> tuple[Data | list[Data], StandardScaler, list[str]]:
    """Convert DataFrames to PyG Data with dynamically detected features.

    Auto-detects numeric and categorical columns (excluding node_id and label).
    Returns (Data or list[Data], fitted_scaler, feature_names).
    """
    has_graph_col = "_graph" in nodes_df.columns and "_graph" in edges_df.columns
    
    if len(nodes_df) == 0:
        empty_data = Data(
            x=torch.zeros((0, 1), dtype=torch.float),
            y=torch.zeros((0,), dtype=torch.long if task_type.endswith("classification") else torch.float),
            edge_index=torch.zeros((2, 0), dtype=torch.long),
            edge_attr=torch.zeros((0, 1), dtype=torch.float),
            num_nodes=0
        )
        empty_data.num_classes = 1
        empty_data.num_features_actual = 1
        return [empty_data] if has_graph_col else empty_data, scaler, []
        
    if not has_graph_col:
        nodes_df = nodes_df.copy()
        edges_df = edges_df.copy()
        nodes_df["_graph"] = "default"
        edges_df["_graph"] = "default"

    # Determine feature columns
    exclude_cols = {"node_id", "id", "index", "name", label_column, "_graph"}
    all_cols = [c for c in nodes_df.columns if c not in exclude_cols]

    numeric_features = []
    categorical_features = {}

    for col in all_cols:
        col_type = detect_column_type(nodes_df[col])
        if col_type == "numeric":
            numeric_features.append(col)
        elif col_type in ("categorical", "boolean"):
            unique_vals = sorted(nodes_df[col].dropna().unique().astype(str).tolist())
            if len(unique_vals) <= 20:  # Only one-hot if reasonable number of categories
                categorical_features[col] = unique_vals

    feature_names = list(numeric_features)

    # Normalize numeric features
    if numeric_features:
        numeric_vals = nodes_df[numeric_features].apply(pd.to_numeric, errors="coerce").fillna(0).values.astype(np.float32)
        if fit_scaler:
            scaler = StandardScaler()
            numeric_vals = scaler.fit_transform(numeric_vals).astype(np.float32)
        else:
            if scaler is not None:
                numeric_vals = scaler.transform(numeric_vals).astype(np.float32)
    else:
        numeric_vals = np.zeros((len(nodes_df), 0), dtype=np.float32)
        if fit_scaler:
            scaler = StandardScaler()

    # One-hot encode categorical features
    ohe_parts = []
    for col, values in categorical_features.items():
        col_data = nodes_df[col].astype(str).values
        ohe = np.zeros((len(nodes_df), len(values)), dtype=np.float32)
        val_to_idx = {v: i for i, v in enumerate(values)}
        for i, v in enumerate(col_data):
            if v in val_to_idx:
                ohe[i, val_to_idx[v]] = 1.0
        ohe_parts.append(ohe)
        feature_names.extend([f"{col}_{v}" for v in values])

    # Concatenate all features
    parts = [numeric_vals]
    parts.extend(ohe_parts)
    x_global = np.concatenate(parts, axis=1) if parts else np.zeros((len(nodes_df), 1), dtype=np.float32)

    num_features = x_global.shape[1]

    # Global Labels
    if task_type in ("node_classification", "graph_classification"):
        label_series = nodes_df[label_column]
        unique_labels = sorted(label_series.dropna().unique())
        label_map = {v: i for i, v in enumerate(unique_labels)}
        y_per_node = label_series.map(label_map).fillna(0).values.astype(np.int64)
        num_classes = len(unique_labels)
    elif task_type in ("node_regression", "graph_regression"):
        y_per_node = pd.to_numeric(nodes_df[label_column], errors="coerce").fillna(0).values.astype(np.float32)
        num_classes = 1
    else:
        raise ValueError(f"Unknown task_type: {task_type}")

    # Edge features
    edge_exclude = {"src_id", "dst_id", "id", "is_critical", "_graph"}
    edge_numeric_cols = [c for c in edges_df.columns if c not in edge_exclude and detect_column_type(edges_df[c]) == "numeric"]

    data_list = []
    unique_graphs = nodes_df["_graph"].unique()

    for g in unique_graphs:
        g_node_mask = (nodes_df["_graph"] == g).values
        g_edge_mask = (edges_df["_graph"] == g).values

        g_x = x_global[g_node_mask]
        g_nodes_df = nodes_df[g_node_mask]
        g_edges_df = edges_df[g_edge_mask]
        
        g_y_arr = y_per_node[g_node_mask]

        if task_type == "graph_classification":
            from collections import Counter
            counter = Counter(g_y_arr)
            g_y = torch.tensor([counter.most_common(1)[0][0]], dtype=torch.long)
        elif task_type == "graph_regression":
            g_y = torch.tensor([float(g_y_arr.mean())], dtype=torch.float)
        elif task_type == "node_classification":
            g_y = torch.tensor(g_y_arr, dtype=torch.long)
        else:
            g_y = torch.tensor(g_y_arr, dtype=torch.float)

        g_node_ids = g_nodes_df["node_id"].values
        g_id_to_idx = {}
        for i, nid in enumerate(g_node_ids):
            try:
                g_id_to_idx[int(nid)] = i
            except (ValueError, TypeError):
                g_id_to_idx[str(nid)] = i

        g_src_indices, g_dst_indices, valid_edge_mask = [], [], []
        for s, d in zip(g_edges_df["src_id"].values, g_edges_df["dst_id"].values):
            try:
                s_key, d_key = int(s), int(d)
            except (ValueError, TypeError):
                s_key, d_key = str(s), str(d)
            if s_key in g_id_to_idx and d_key in g_id_to_idx:
                g_src_indices.append(g_id_to_idx[s_key])
                g_dst_indices.append(g_id_to_idx[d_key])
                valid_edge_mask.append(True)
            else:
                valid_edge_mask.append(False)

        if g_src_indices:
            g_edge_index = torch.tensor([g_src_indices, g_dst_indices], dtype=torch.long)
        else:
            g_edge_index = torch.zeros((2, 0), dtype=torch.long)

        if edge_numeric_cols and len(g_src_indices) > 0:
            g_valid_edges = g_edges_df[valid_edge_mask]
            g_edge_attr_vals = g_valid_edges[edge_numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0).values.astype(np.float32)
            g_edge_attr = torch.tensor(g_edge_attr_vals, dtype=torch.float)
        else:
            g_edge_attr = torch.zeros((g_edge_index.shape[1], 1), dtype=torch.float)

        data = Data(
            x=torch.tensor(g_x, dtype=torch.float),
            y=g_y,
            edge_index=g_edge_index,
            edge_attr=g_edge_attr,
            num_nodes=len(g_nodes_df),
        )
        data.num_classes = num_classes
        data.num_features_actual = num_features
        data_list.append(data)

    ret_data = data_list if has_graph_col else data_list[0]
    return ret_data, scaler, feature_names
