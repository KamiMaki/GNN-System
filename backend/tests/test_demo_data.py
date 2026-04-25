"""Smoke test for the bundled demo .xlsx file.

Verifies that `demo_multigraph_homo.v2.xlsx` under `backend/demo_data/` parses
cleanly through `parse_excel_file` with the simplified V2 schema (one sheet
per level, no Type column). Heterogeneous demos are no longer supported as
of 2026-04-25.
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
