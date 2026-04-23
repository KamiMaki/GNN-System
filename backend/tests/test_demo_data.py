"""Smoke tests for the bundled demo .xlsx files.

Verifies that the `demo_multigraph_{homo,hetero}.v2.xlsx` files committed
under `backend/demo_data/` parse cleanly through `parse_excel_file`, use the
new unified single-sheet layout, and expose the expected types.
"""
from __future__ import annotations

from pathlib import Path

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


def test_demo_hetero_parses_and_has_three_node_types():
    parsed = parse_excel_file(_read("demo_multigraph_hetero.v2.xlsx"), "hetero")
    assert parsed["is_heterogeneous"] is True
    assert set(parsed["node_dfs"].keys()) == {"cell", "pin", "net"}
    assert set(parsed["edge_dfs"].keys()) == {"cell2pin", "pin2pin", "pin2net"}
    # Each per-type frame should only carry its own declared features.
    assert "pin_cap" not in parsed["node_dfs"]["cell"].columns
    assert "net_fanout" not in parsed["node_dfs"]["pin"].columns
    # Canonical edges are tuples that match declared types.
    ce = parsed["canonical_edges"]
    triples = {(s, r, d) for s, r, d in ce}
    assert ("cell", "cell2pin", "pin") in triples
    assert ("pin", "pin2net", "net") in triples
