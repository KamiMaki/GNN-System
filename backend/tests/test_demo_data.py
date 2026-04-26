"""Smoke tests for the bundled demo .xlsx files.

Verifies that both the homogeneous and heterogeneous demo workbooks under
``backend/demo_data/`` parse cleanly through ``parse_excel_file``.
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
