"""Generic feature engineering + explore statistics for Excel-ingested data."""
from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd


# ── column analysis ────────────────────────────────────────────────────────

def detect_column_type(series: pd.Series) -> str:
    """Auto-detect column type: 'numeric', 'categorical', or 'boolean'."""
    if series.dropna().empty:
        return "categorical"

    unique = set(series.dropna().unique())
    if unique <= {0, 1, True, False, "True", "False", "true", "false"}:
        return "boolean"

    if pd.api.types.is_numeric_dtype(series):
        if series.nunique() <= 2:
            return "boolean"
        return "numeric"

    coerced = pd.to_numeric(series, errors="coerce")
    if coerced.notna().sum() > 0.8 * series.notna().sum():
        return "numeric"

    return "categorical"


# ── explore-page stats ─────────────────────────────────────────────────────

def _graph_stats(df: pd.DataFrame) -> tuple[int, float]:
    """Return (graph_count, avg_rows_per_graph) based on _graph column."""
    if "_graph" in df.columns and len(df) > 0:
        groups = df["_graph"].value_counts()
        return int(len(groups)), round(float(groups.mean()), 2) if len(groups) > 0 else 0.0
    return 1, float(len(df))


def compute_generic_explore(
    nodes_df: pd.DataFrame,
    edges_df: pd.DataFrame,
    *,
    is_heterogeneous: bool = False,
    node_types: Optional[list[str]] = None,
    edge_types: Optional[list[str]] = None,
    canonical_edges: Optional[list] = None,
) -> dict:
    """Compute generic exploration stats for an Excel-ingested dataset.

    Includes multi-graph summary (graph_count + avg_nodes_per_graph +
    avg_edges_per_graph) and heterogeneity metadata when available.
    """
    node_type_skip = {"_graph", "_node_type", "Type"}
    edge_type_skip = {"_graph", "_edge_type", "src_type", "dst_type",
                      "Edge_Type", "src_id", "dst_id"}

    columns = []
    for col in nodes_df.columns:
        if col in node_type_skip:
            continue
        dtype = detect_column_type(nodes_df[col])
        columns.append({
            "name": col,
            "dtype": dtype,
            "missing_count": int(nodes_df[col].isna().sum()),
            "missing_pct": round(float(nodes_df[col].isna().mean()) * 100, 2),
            "unique_count": int(nodes_df[col].nunique()),
        })

    numeric_cols = [c["name"] for c in columns
                    if c["dtype"] == "numeric" and c["name"].lower() not in ("node_id", "id", "index")]
    if len(numeric_cols) > 5:
        variances = nodes_df[numeric_cols].var().sort_values(ascending=False)
        numeric_cols = list(variances.index[:5])
    correlation = compute_correlation(nodes_df, numeric_cols) if numeric_cols else []

    edge_columns = []
    for col in edges_df.columns:
        if col in edge_type_skip:
            continue
        dtype = detect_column_type(edges_df[col])
        edge_columns.append({
            "name": col,
            "dtype": dtype,
            "missing_count": int(edges_df[col].isna().sum()),
            "missing_pct": round(float(edges_df[col].isna().mean()) * 100, 2),
            "unique_count": int(edges_df[col].nunique()),
        })

    graph_count, avg_nodes = _graph_stats(nodes_df)
    _, avg_edges = _graph_stats(edges_df)

    payload = {
        "num_nodes": len(nodes_df),
        "num_edges": len(edges_df),
        "columns": columns,
        "edge_columns": edge_columns,
        "feature_correlation": correlation,
        "correlation_columns": numeric_cols,
        # Multi-graph & heterogeneity summary
        "graph_count": graph_count,
        "avg_nodes_per_graph": avg_nodes,
        "avg_edges_per_graph": avg_edges,
        "is_heterogeneous": bool(is_heterogeneous),
        "node_types": node_types or [],
        "edge_types": edge_types or [],
        "canonical_edges": [list(ce) for ce in (canonical_edges or [])],
    }
    return payload


def analyze_numeric_column(series: pd.Series) -> dict:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return {
            "column": series.name, "dtype": "numeric",
            "mean": 0, "median": 0, "std": 0,
            "min": 0, "max": 0, "q1": 0, "q3": 0,
            "outlier_count": 0, "distribution": [],
        }

    q1 = float(clean.quantile(0.25))
    q3 = float(clean.quantile(0.75))
    iqr = q3 - q1
    lo = q1 - 1.5 * iqr
    hi = q3 + 1.5 * iqr
    outliers = int(((clean < lo) | (clean > hi)).sum())

    counts, bin_edges = np.histogram(clean, bins=10)
    distribution = [
        {"range": f"{round(float(bin_edges[i]), 4)}~{round(float(bin_edges[i + 1]), 4)}",
         "count": int(counts[i])}
        for i in range(len(counts))
    ]

    return {
        "column": series.name, "dtype": "numeric",
        "mean": round(float(clean.mean()), 4),
        "median": round(float(clean.median()), 4),
        "std": round(float(clean.std()), 4),
        "min": round(float(clean.min()), 4),
        "max": round(float(clean.max()), 4),
        "q1": round(q1, 4), "q3": round(q3, 4),
        "outlier_count": outliers, "distribution": distribution,
    }


def analyze_categorical_column(series: pd.Series) -> dict:
    vc = series.dropna().value_counts()
    value_counts = [{"name": str(k), "count": int(v)} for k, v in vc.items()]
    top_value = str(vc.index[0]) if len(vc) > 0 else ""
    top_count = int(vc.iloc[0]) if len(vc) > 0 else 0
    return {
        "column": series.name, "dtype": "categorical",
        "value_counts": value_counts,
        "top_value": top_value, "top_count": top_count,
    }


def compute_correlation(df: pd.DataFrame, columns: list[str]) -> list[dict]:
    if not columns:
        return []
    valid = [c for c in columns if c in df.columns]
    if not valid:
        return []
    numeric = df[valid].apply(pd.to_numeric, errors="coerce")
    corr = numeric.corr()
    out = []
    for xi in valid:
        for yi in valid:
            v = corr.loc[xi, yi]
            out.append({"x": xi, "y": yi, "value": round(float(v), 2) if not pd.isna(v) else 0.0})
    return out


# ── Label validation + imputation ──────────────────────────────────────────

def validate_label(nodes_df: pd.DataFrame, column: str, task_type: str) -> dict:
    if column not in nodes_df.columns:
        return {"valid": False, "message": f"Column '{column}' not found in dataset."}

    series = nodes_df[column]
    missing = int(series.isna().sum())
    if missing > 0:
        return {
            "valid": False,
            "message": f"Label column '{column}' has {missing} missing values. Please impute first.",
        }

    if task_type in ("node_classification", "graph_classification"):
        unique_vals = series.unique()
        n = len(unique_vals)
        if n < 2:
            return {"valid": False, "message": f"Classification requires at least 2 classes, found {n}."}
        if n > 100:
            return {"valid": False, "message": f"Too many classes ({n}). Consider regression instead."}
        vc = series.value_counts()
        return {
            "valid": True,
            "message": f"Valid classification target with {n} classes.",
            "num_classes": n,
            "class_distribution": [{"label": str(k), "count": int(v)} for k, v in vc.items()],
        }

    if task_type in ("node_regression", "graph_regression"):
        numeric_series = pd.to_numeric(series, errors="coerce")
        non_numeric = int(numeric_series.isna().sum() - series.isna().sum())
        if non_numeric > 0:
            return {"valid": False, "message": f"Regression target has {non_numeric} non-numeric values."}
        return {
            "valid": True,
            "message": f"Valid regression target.",
            "is_continuous": series.nunique() > 10,
            "value_range": {
                "min": round(float(numeric_series.min()), 4),
                "max": round(float(numeric_series.max()), 4),
                "mean": round(float(numeric_series.mean()), 4),
                "std": round(float(numeric_series.std()), 4),
            },
        }

    return {"valid": False, "message": f"Unknown task type: {task_type}"}


def impute_column(df: pd.DataFrame, column: str, method: str) -> tuple[pd.DataFrame, int]:
    if column not in df.columns:
        return df, 0
    mask = df[column].isna()
    filled = int(mask.sum())
    if filled == 0:
        return df, 0
    df = df.copy()
    if method == "mean":
        fill = pd.to_numeric(df[column], errors="coerce").mean()
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(fill)
    elif method == "median":
        fill = pd.to_numeric(df[column], errors="coerce").median()
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(fill)
    elif method == "zero":
        df[column] = df[column].fillna(0)
    else:
        return df, 0
    return df, filled
