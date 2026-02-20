import io
from pathlib import Path

import pandas as pd


# Legacy strict validation columns (used for mock data)
NODE_REQUIRED_COLUMNS = [
    "node_id", "name", "cell_type", "logic_depth", "fanout", "fan_in",
    "slack_ns", "cell_delay_ps", "drive_strength", "cell_area_um2",
    "congestion_score", "is_critical",
]

EDGE_REQUIRED_COLUMNS = [
    "src_id", "dst_id", "wire_cap_ff", "wire_length_um", "is_critical",
]

# Minimal columns for generic parsing
NODE_MINIMUM_COLUMNS = ["node_id"]
EDGE_MINIMUM_COLUMNS = ["src_id", "dst_id"]


def _read_csv(source: bytes | Path) -> pd.DataFrame:
    if isinstance(source, (str, Path)):
        return pd.read_csv(source)
    return pd.read_csv(io.BytesIO(source))


def parse_csv_pair(
    nodes_csv: bytes | Path,
    edges_csv: bytes | Path,
    dataset_name: str,
) -> dict:
    """Parse and validate a pair of node/edge CSV files (strict mode for legacy data).

    Returns dict with keys: nodes_df, edges_df, name.
    Raises ValueError on missing columns.
    """
    nodes_df = _read_csv(nodes_csv)
    edges_df = _read_csv(edges_csv)

    missing_node = set(NODE_REQUIRED_COLUMNS) - set(nodes_df.columns)
    if missing_node:
        raise ValueError(f"Missing node columns: {missing_node}")

    missing_edge = set(EDGE_REQUIRED_COLUMNS) - set(edges_df.columns)
    if missing_edge:
        raise ValueError(f"Missing edge columns: {missing_edge}")

    return {"nodes_df": nodes_df, "edges_df": edges_df, "name": dataset_name}


def parse_csv_pair_generic(
    nodes_csv: bytes | Path,
    edges_csv: bytes | Path,
    dataset_name: str,
) -> dict:
    """Parse a pair of node/edge CSV files with minimal validation.

    Only requires node_id in nodes and src_id/dst_id in edges.
    Returns dict with keys: nodes_df, edges_df, name.
    Raises ValueError on missing minimum columns.
    """
    nodes_df = _read_csv(nodes_csv)
    edges_df = _read_csv(edges_csv)

    missing_node = set(NODE_MINIMUM_COLUMNS) - set(nodes_df.columns)
    if missing_node:
        raise ValueError(f"Missing required node columns: {missing_node}")

    missing_edge = set(EDGE_MINIMUM_COLUMNS) - set(edges_df.columns)
    if missing_edge:
        raise ValueError(f"Missing required edge columns: {missing_edge}")

    return {"nodes_df": nodes_df, "edges_df": edges_df, "name": dataset_name}
