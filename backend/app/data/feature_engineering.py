import pandas as pd
import numpy as np


# ── Generic Column Analysis (new) ──

def detect_column_type(series: pd.Series) -> str:
    """Auto-detect column type: 'numeric', 'categorical', or 'boolean'."""
    if series.dropna().empty:
        return "categorical"

    # Boolean check
    unique = set(series.dropna().unique())
    if unique <= {0, 1, True, False, "True", "False", "true", "false"}:
        return "boolean"

    # Numeric check
    if pd.api.types.is_numeric_dtype(series):
        if series.nunique() <= 2:
            return "boolean"
        return "numeric"

    # Try coercing to numeric
    coerced = pd.to_numeric(series, errors="coerce")
    if coerced.notna().sum() > 0.8 * series.notna().sum():
        return "numeric"

    return "categorical"


def compute_generic_explore(nodes_df: pd.DataFrame, edges_df: pd.DataFrame) -> dict:
    """Compute generic exploration stats for any CSV dataset."""
    columns = []
    for col in nodes_df.columns:
        dtype = detect_column_type(nodes_df[col])
        columns.append({
            "name": col,
            "dtype": dtype,
            "missing_count": int(nodes_df[col].isna().sum()),
            "missing_pct": round(float(nodes_df[col].isna().mean()) * 100, 2),
            "unique_count": int(nodes_df[col].nunique()),
        })

    # Default correlation: top 5 numeric columns by variance
    numeric_cols = [c["name"] for c in columns if c["dtype"] == "numeric"]
    # Exclude ID-like columns
    numeric_cols = [c for c in numeric_cols if c.lower() not in ("node_id", "id", "index")]
    # Pick top 5 by variance
    if len(numeric_cols) > 5:
        variances = nodes_df[numeric_cols].var().sort_values(ascending=False)
        numeric_cols = list(variances.index[:5])

    correlation = compute_correlation(nodes_df, numeric_cols) if numeric_cols else []

    return {
        "num_nodes": len(nodes_df),
        "num_edges": len(edges_df),
        "columns": columns,
        "feature_correlation": correlation,
        "correlation_columns": numeric_cols,
    }


def analyze_numeric_column(series: pd.Series) -> dict:
    """Compute statistics for a numeric column including distribution and outliers."""
    clean = pd.to_numeric(series, errors="coerce").dropna()

    if clean.empty:
        return {
            "column": series.name,
            "dtype": "numeric",
            "mean": 0, "median": 0, "std": 0,
            "min": 0, "max": 0, "q1": 0, "q3": 0,
            "outlier_count": 0,
            "distribution": [],
        }

    q1 = float(clean.quantile(0.25))
    q3 = float(clean.quantile(0.75))
    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    outlier_count = int(((clean < lower_bound) | (clean > upper_bound)).sum())

    # Histogram: 10 bins
    counts, bin_edges = np.histogram(clean, bins=10)
    distribution = []
    for i in range(len(counts)):
        lo = round(float(bin_edges[i]), 4)
        hi = round(float(bin_edges[i + 1]), 4)
        distribution.append({"range": f"{lo}~{hi}", "count": int(counts[i])})

    return {
        "column": series.name,
        "dtype": "numeric",
        "mean": round(float(clean.mean()), 4),
        "median": round(float(clean.median()), 4),
        "std": round(float(clean.std()), 4),
        "min": round(float(clean.min()), 4),
        "max": round(float(clean.max()), 4),
        "q1": round(q1, 4),
        "q3": round(q3, 4),
        "outlier_count": outlier_count,
        "distribution": distribution,
    }


def analyze_categorical_column(series: pd.Series) -> dict:
    """Compute value counts for a categorical column."""
    vc = series.dropna().value_counts()
    value_counts = [{"name": str(k), "count": int(v)} for k, v in vc.items()]

    top_value = str(vc.index[0]) if len(vc) > 0 else ""
    top_count = int(vc.iloc[0]) if len(vc) > 0 else 0

    return {
        "column": series.name,
        "dtype": "categorical",
        "value_counts": value_counts,
        "top_value": top_value,
        "top_count": top_count,
    }


def compute_correlation(df: pd.DataFrame, columns: list[str]) -> list[dict]:
    """Compute pairwise Pearson correlation for given columns."""
    if not columns:
        return []
    valid_cols = [c for c in columns if c in df.columns]
    if not valid_cols:
        return []

    numeric_df = df[valid_cols].apply(pd.to_numeric, errors="coerce")
    corr_matrix = numeric_df.corr()

    result = []
    for xi in valid_cols:
        for yi in valid_cols:
            result.append({
                "x": xi,
                "y": yi,
                "value": round(float(corr_matrix.loc[xi, yi]), 2)
                if not pd.isna(corr_matrix.loc[xi, yi]) else 0.0,
            })
    return result


def validate_label(
    nodes_df: pd.DataFrame, column: str, task_type: str
) -> dict:
    """Validate a label column for a given task type."""
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
        # Classification: check discrete classes
        unique_vals = series.unique()
        num_classes = len(unique_vals)

        if num_classes < 2:
            return {
                "valid": False,
                "message": f"Classification requires at least 2 classes, found {num_classes}.",
            }
        if num_classes > 100:
            return {
                "valid": False,
                "message": f"Too many classes ({num_classes}). Consider regression instead.",
            }

        # For graph-level tasks, check label consistency (same value per graph)
        if task_type == "graph_classification":
            # All rows in the same CSV represent one graph, so label should be uniform
            if num_classes > 1 and series.nunique() > 1:
                # Check if it's intentionally multi-class across graphs
                # For single-graph CSV, all labels should be the same
                pass  # Allow it - user may have multi-graph data

        vc = series.value_counts()
        class_dist = [{"label": str(k), "count": int(v)} for k, v in vc.items()]

        return {
            "valid": True,
            "message": f"Valid classification target with {num_classes} classes.",
            "num_classes": num_classes,
            "class_distribution": class_dist,
        }

    elif task_type in ("node_regression", "graph_regression"):
        # Regression: check if values are numeric/continuous
        numeric_series = pd.to_numeric(series, errors="coerce")
        non_numeric = int(numeric_series.isna().sum() - series.isna().sum())

        if non_numeric > 0:
            return {
                "valid": False,
                "message": f"Regression target has {non_numeric} non-numeric values.",
            }

        is_continuous = series.nunique() > 10  # heuristic
        value_range = {
            "min": round(float(numeric_series.min()), 4),
            "max": round(float(numeric_series.max()), 4),
            "mean": round(float(numeric_series.mean()), 4),
            "std": round(float(numeric_series.std()), 4),
        }

        if task_type == "graph_regression":
            if series.nunique() > 1:
                # For single-graph CSV, regression target should be uniform
                pass  # Allow it

        return {
            "valid": True,
            "message": f"Valid regression target. Range: [{value_range['min']}, {value_range['max']}].",
            "is_continuous": is_continuous,
            "value_range": value_range,
        }

    return {"valid": False, "message": f"Unknown task type: {task_type}"}


def impute_column(
    df: pd.DataFrame, column: str, method: str
) -> tuple[pd.DataFrame, int]:
    """Impute missing values in a column. Returns (modified_df, filled_count)."""
    if column not in df.columns:
        return df, 0

    missing_mask = df[column].isna()
    filled_count = int(missing_mask.sum())

    if filled_count == 0:
        return df, 0

    df = df.copy()
    if method == "mean":
        fill_value = pd.to_numeric(df[column], errors="coerce").mean()
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(fill_value)
    elif method == "median":
        fill_value = pd.to_numeric(df[column], errors="coerce").median()
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(fill_value)
    elif method == "zero":
        df[column] = df[column].fillna(0)
    else:
        return df, 0

    return df, filled_count


# ── Legacy (kept for mock dataset backward compat) ──

def compute_explore_stats(nodes_df: pd.DataFrame, edges_df: pd.DataFrame) -> dict:
    """Compute exploration statistics matching the legacy ExploreData frontend interface."""

    # fanout_dist
    fanout_bins = [0, 2, 5, 10, 20, float("inf")]
    fanout_labels = ["1-2", "3-5", "6-10", "11-20", ">20"]
    fanout_counts = pd.cut(
        nodes_df["fanout"], bins=fanout_bins, labels=fanout_labels
    ).value_counts().sort_index()
    fanout_dist = [{"range": str(r), "count": int(c)} for r, c in fanout_counts.items()]

    # slack_dist
    slack_bins = [-float("inf"), -0.3, -0.1, 0.0, 0.1, 0.3, float("inf")]
    slack_labels = ["<-0.3ns", "-0.3~-0.1ns", "-0.1~0ns", "0~0.1ns", "0.1~0.3ns", ">0.3ns"]
    slack_counts = pd.cut(
        nodes_df["slack_ns"], bins=slack_bins, labels=slack_labels
    ).value_counts().sort_index()
    slack_dist = [{"range": str(r), "count": int(c)} for r, c in slack_counts.items()]

    # cell_type_dist
    ct_counts = nodes_df["cell_type"].value_counts()
    cell_type_dist = [{"name": str(k), "value": int(v)} for k, v in ct_counts.items()]

    # feature_correlation
    corr_cols = ["logic_depth", "fanout", "congestion_score", "slack_ns", "cell_delay_ps"]
    short_names = ["Depth", "Fanout", "Congest", "Slack", "Delay"]
    corr_matrix = nodes_df[corr_cols].corr()
    feature_correlation = []
    for i, xi in enumerate(short_names):
        for j, yi in enumerate(short_names):
            feature_correlation.append({
                "x": xi, "y": yi,
                "value": round(float(corr_matrix.iloc[i, j]), 2),
            })

    # critical_paths_table
    table_cols = ["node_id", "name", "cell_type", "slack_ns", "logic_depth", "congestion_score", "is_critical"]
    top_critical = (
        nodes_df[nodes_df["is_critical"] == 1]
        .nsmallest(10, "slack_ns")[table_cols]
        .to_dict("records")
    )
    top_safe = (
        nodes_df[nodes_df["is_critical"] == 0]
        .nlargest(10, "slack_ns")[table_cols]
        .to_dict("records")
    )
    critical_paths_table = top_critical + top_safe

    # radar_data
    means = nodes_df[["logic_depth", "cell_delay_ps", "congestion_score", "fanout", "drive_strength"]].mean()
    radar_data = [
        {"subject": "Logic Depth",  "A": int(min(150, means["logic_depth"] * 15)),       "fullMark": 150},
        {"subject": "Cell Density", "A": int(min(150, means["cell_delay_ps"] * 2)),       "fullMark": 150},
        {"subject": "Congestion",   "A": int(min(150, means["congestion_score"] * 200)),  "fullMark": 150},
        {"subject": "Fanout",       "A": int(min(150, means["fanout"] * 20)),              "fullMark": 150},
        {"subject": "Connectivity", "A": int(min(150, means["drive_strength"] * 15)),      "fullMark": 150},
        {"subject": "Power",        "A": 65,                                               "fullMark": 150},
    ]

    return {
        "fanout_dist": fanout_dist,
        "slack_dist": slack_dist,
        "cell_type_dist": cell_type_dist,
        "feature_correlation": feature_correlation,
        "critical_paths_table": critical_paths_table,
        "radar_data": radar_data,
    }
