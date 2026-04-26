"""Smoke tests for the bundled demo .xlsx files.

Verifies that both the homogeneous and heterogeneous demo workbooks under
``backend/demo_data/`` parse cleanly through ``parse_excel_file``.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from app.data.excel_ingestion import parse_excel_file

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo_data"


def _read(name: str) -> bytes:
    p = DEMO_DIR / name
    if not p.exists():
        pytest.skip(f"{name} not generated; run scripts/generate_excel_demos.py")
    return p.read_bytes()


def test_demo_homo_parses_and_is_homogeneous():
    parsed = parse_excel_file(_read("demo_multigraph_homo.v2.xlsx"), "homo")
    assert parsed["is_heterogeneous"] is False
    assert parsed["task_type"] == "graph_regression"
    assert parsed["label_column"] == "target_delay"
    # 30 graphs bundled.
    assert parsed["graph_df"] is not None
    assert len(parsed["graph_df"]) == 30


def _read_hetero() -> bytes:
    """Read the hetero demo, preferring the freshly generated copy."""
    for name in ("demo_multigraph_hetero.v2.new.xlsx", "demo_multigraph_hetero.v2.xlsx"):
        p = DEMO_DIR / name
        if p.exists():
            return p.read_bytes()
    pytest.skip("hetero demo not generated; run scripts/generate_excel_demos.py")


def test_demo_hetero_parses_and_is_heterogeneous():
    parsed = parse_excel_file(_read_hetero(), "hetero")
    assert parsed["is_heterogeneous"] is True
    assert parsed["task_type"] == "graph_regression"
    # At least 2 node types present
    assert len(parsed["node_dfs"]) >= 2
    # Unified view contains all rows from all types
    total_typed = sum(len(df) for df in parsed["node_dfs"].values())
    assert len(parsed["nodes_df"]) == total_typed
    assert parsed["graph_df"] is not None
    # canonical_edges must be exactly the 2 observed triples, not a Cartesian product
    triples = set(map(tuple, parsed["canonical_edges"]))
    assert triples == {("cell", "cell_pin", "pin"), ("pin", "pin_net", "net")}, \
        f"Unexpected canonical_edges: {triples}"


def _isolated_nodes(nodes_df: pd.DataFrame, edges_df: pd.DataFrame, graph_id: int) -> list:
    """Return list of node IDs in graph_id that appear in no edge."""
    g_nodes = nodes_df[nodes_df["_graph"] == graph_id]["node_id"].tolist()
    if edges_df.empty:
        return g_nodes
    g_edges = edges_df[edges_df["_graph"] == graph_id]
    connected = set(g_edges["src_id"].tolist()) | set(g_edges["dst_id"].tolist())
    return [n for n in g_nodes if n not in connected]


def test_demo_homo_no_isolated_nodes_first_graph():
    """First graph of the homo demo must have zero isolated nodes."""
    parsed = parse_excel_file(_read("demo_multigraph_homo.v2.xlsx"), "homo")
    first_gid = parsed["nodes_df"]["_graph"].iloc[0]
    isolated = _isolated_nodes(parsed["nodes_df"], parsed["edges_df"], first_gid)
    assert isolated == [], f"Isolated nodes in graph {first_gid}: {isolated}"


def test_demo_hetero_no_isolated_nodes_first_graph():
    """First graph of the hetero demo must have zero isolated nodes."""
    parsed = parse_excel_file(_read_hetero(), "hetero")
    first_gid = parsed["nodes_df"]["_graph"].iloc[0]
    isolated = _isolated_nodes(parsed["nodes_df"], parsed["edges_df"], first_gid)
    assert isolated == [], f"Isolated nodes in graph {first_gid}: {isolated}"
