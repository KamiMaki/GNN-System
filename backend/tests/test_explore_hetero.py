"""Heterogeneous explore-stats regression test.

Catches the "feature missing" bug where cross-type NaN padding in the unified
``nodes_df`` caused `compute_generic_explore` to report 60%+ missing for every
type-specific feature.
"""
from __future__ import annotations

import pandas as pd

from app.data.feature_engineering import compute_generic_explore


def test_hetero_per_type_explore_has_no_false_missing():
    # Two node types with entirely disjoint feature sets.
    cell_df = pd.DataFrame({
        "node_id": [0, 1, 2],
        "_graph": [1, 1, 1],
        "_node_type": ["cell"] * 3,
        "cell_area": [1.1, 2.2, 3.3],
        "cell_drive": [1, 2, 4],
    })
    pin_df = pd.DataFrame({
        "node_id": [3, 4],
        "_graph": [1, 1],
        "_node_type": ["pin"] * 2,
        "pin_cap": [0.5, 0.6],
    })
    unified = pd.concat([cell_df, pin_df], ignore_index=True)

    stats = compute_generic_explore(
        unified, pd.DataFrame(columns=["src_id", "dst_id"]),
        is_heterogeneous=True,
        node_types=["cell", "pin"], edge_types=[],
        canonical_edges=[],
        node_dfs={"cell": cell_df, "pin": pin_df},
        edge_dfs={},
    )
    by_name = {(c["name"], c.get("node_type")): c for c in stats["columns"]}
    # cell features should have 0 missing under cell type
    assert by_name[("cell_area", "cell")]["missing_count"] == 0
    assert by_name[("cell_drive", "cell")]["missing_count"] == 0
    # pin feature should have 0 missing under pin type
    assert by_name[("pin_cap", "pin")]["missing_count"] == 0
    # Crucially, cell_area should NOT appear as a column under pin (it was
    # dropped by ingestion) — and vice versa.
    assert ("cell_area", "pin") not in by_name
    assert ("pin_cap", "cell") not in by_name


def test_homogeneous_explore_unchanged():
    df = pd.DataFrame({
        "node_id": [0, 1, 2, 3],
        "x1": [0.1, 0.2, 0.3, 0.4],
        "x2": [1.0, None, 3.0, 4.0],
    })
    stats = compute_generic_explore(df, pd.DataFrame(columns=["src_id", "dst_id"]))
    by_name = {c["name"]: c for c in stats["columns"]}
    # Legacy path uses unified counts: x2 has 1/4 missing.
    assert by_name["x2"]["missing_count"] == 1
    assert by_name["x1"]["missing_count"] == 0
