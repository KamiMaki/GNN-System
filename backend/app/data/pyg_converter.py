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
) -> tuple[Data, StandardScaler, list[str]]:
    """Convert DataFrames to PyG Data with dynamically detected features.

    Auto-detects numeric and categorical columns (excluding node_id and label).
    Returns (Data, fitted_scaler, feature_names).
    """
    # Node ID mapping
    node_ids = nodes_df["node_id"].values
    id_to_idx = {int(nid) if not pd.isna(nid) else i for i, nid in enumerate(node_ids)}
    id_to_idx = {}
    for i, nid in enumerate(nodes_df["node_id"].values):
        try:
            id_to_idx[int(nid)] = i
        except (ValueError, TypeError):
            id_to_idx[str(nid)] = i

    # Determine feature columns (exclude node_id, label, and non-feature columns)
    exclude_cols = {"node_id", "id", "index", "name", label_column}
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
    x = np.concatenate(parts, axis=1) if parts else np.zeros((len(nodes_df), 1), dtype=np.float32)

    num_features = x.shape[1]

    # Labels
    if task_type in ("node_classification", "graph_classification"):
        label_series = nodes_df[label_column]
        # Map labels to integers
        unique_labels = sorted(label_series.dropna().unique())
        label_map = {v: i for i, v in enumerate(unique_labels)}
        node_labels = label_series.map(label_map).fillna(0).values.astype(np.int64)

        if task_type == "graph_classification":
            # Most common label
            from collections import Counter
            counter = Counter(node_labels)
            graph_label = counter.most_common(1)[0][0]
            y = torch.tensor([graph_label], dtype=torch.long)
        else:
            y = torch.tensor(node_labels, dtype=torch.long)
        num_classes = len(unique_labels)
    elif task_type in ("node_regression", "graph_regression"):
        node_scores = pd.to_numeric(nodes_df[label_column], errors="coerce").fillna(0).values.astype(np.float32)
        if task_type == "graph_regression":
            y = torch.tensor([float(node_scores.mean())], dtype=torch.float)
        else:
            y = torch.tensor(node_scores, dtype=torch.float)
        num_classes = 1
    else:
        raise ValueError(f"Unknown task_type: {task_type}")

    # Build edge_index
    src_col = edges_df["src_id"]
    dst_col = edges_df["dst_id"]

    src_indices = []
    dst_indices = []
    for s, d in zip(src_col.values, dst_col.values):
        s_key = int(s) if isinstance(list(id_to_idx.keys())[0] if id_to_idx else 0, int) else str(s)
        d_key = int(d) if isinstance(list(id_to_idx.keys())[0] if id_to_idx else 0, int) else str(d)
        try:
            s_key = int(s)
        except (ValueError, TypeError):
            s_key = str(s)
        try:
            d_key = int(d)
        except (ValueError, TypeError):
            d_key = str(d)
        if s_key in id_to_idx and d_key in id_to_idx:
            src_indices.append(id_to_idx[s_key])
            dst_indices.append(id_to_idx[d_key])

    if src_indices:
        edge_index = torch.tensor([src_indices, dst_indices], dtype=torch.long)
    else:
        edge_index = torch.zeros((2, 0), dtype=torch.long)

    # Edge features (use any numeric columns in edges besides src_id/dst_id)
    edge_exclude = {"src_id", "dst_id", "id", "is_critical"}
    edge_numeric_cols = [c for c in edges_df.columns if c not in edge_exclude and detect_column_type(edges_df[c]) == "numeric"]

    if edge_numeric_cols and len(src_indices) > 0:
        # Filter to valid edges
        valid_mask = edges_df["src_id"].apply(lambda s: (int(s) if pd.notna(s) else s) in id_to_idx if id_to_idx else False)
        valid_mask &= edges_df["dst_id"].apply(lambda d: (int(d) if pd.notna(d) else d) in id_to_idx if id_to_idx else False)
        valid_edges = edges_df[valid_mask]
        edge_attr_vals = valid_edges[edge_numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0).values.astype(np.float32)
        edge_attr = torch.tensor(edge_attr_vals, dtype=torch.float)
    else:
        edge_attr = torch.zeros((edge_index.shape[1], 1), dtype=torch.float)

    data = Data(
        x=torch.tensor(x, dtype=torch.float),
        y=y,
        edge_index=edge_index,
        edge_attr=edge_attr,
        num_nodes=len(nodes_df),
    )
    data.num_classes = num_classes
    data.num_features_actual = num_features

    return data, scaler, feature_names
