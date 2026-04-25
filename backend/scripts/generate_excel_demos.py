"""Generate demo .xlsx files matching the graph_data_template (V2 — 2026-04-25).

Produces two files under backend/demo_data/:
    * demo_multigraph_homo.v2.xlsx   — 30 graphs, single node/edge type,
                                       graph regression target (Node/Edge/Graph sheets,
                                       no Type column in data sheets)
    * demo_multigraph_homo_large.v2.xlsx — same schema, 100 graphs, more features

Run with:
    cd backend && python scripts/generate_excel_demos.py
"""
from __future__ import annotations

import random
from pathlib import Path

import pandas as pd

SEED = 42
OUT = Path(__file__).resolve().parent.parent / "demo_data"
OUT.mkdir(parents=True, exist_ok=True)


def _write(path: Path, sheets: dict[str, pd.DataFrame]) -> None:
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for name, df in sheets.items():
            df.to_excel(writer, sheet_name=name, index=False)


# ── Homogeneous demo (graph_regression) ───────────────────────────────────
# Schema: Parameter sheet declares Type="default" for all levels.
# Data sheets (Node / Edge / Graph) have NO Type column.

def make_homo(n_graphs: int = 30) -> dict[str, pd.DataFrame]:
    rng = random.Random(SEED)
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "delay_ps", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "area_um2", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "fanout", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "drive", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "depth", "Weight": None},
        {"XY": "X", "Level": "Edge", "Type": "default", "Parameter": "wire_cap_ff", "Weight": None},
        {"XY": "X", "Level": "Edge", "Type": "default", "Parameter": "wire_length_um", "Weight": None},
        {"XY": "X", "Level": "Graph", "Type": "default", "Parameter": "num_cells", "Weight": None},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "target_delay", "Weight": 1.0},
    ])

    node_rows, edge_rows, graph_rows = [], [], []
    for gid in range(1, n_graphs + 1):
        n_nodes = rng.randint(20, 50)
        node_ids = list(range(n_nodes))
        total_delay = 0.0
        for nid in node_ids:
            delay = rng.randint(5, 60)
            total_delay += delay
            node_rows.append({
                "Graph_ID": gid, "Node": nid,
                "delay_ps": delay,
                "area_um2": round(rng.uniform(0.3, 3.0), 3),
                "fanout": rng.randint(1, 10),
                "drive": rng.choice([1, 2, 4, 8, 16]),
                "depth": rng.randint(1, 10),
            })
        n_edges = int(n_nodes * 1.5)
        for _ in range(n_edges):
            s = rng.choice(node_ids)
            d = rng.choice(node_ids)
            if s == d:
                continue
            edge_rows.append({
                "Graph_ID": gid, "Source_Node_ID": s, "Target_Node_ID": d,
                "wire_cap_ff": round(rng.uniform(0.1, 5.0), 3),
                "wire_length_um": round(rng.uniform(1.0, 100.0), 2),
            })
        graph_rows.append({
            "Graph_ID": gid,
            "num_cells": n_nodes,
            "target_delay": round(total_delay / n_nodes + rng.uniform(-2, 2), 3),
        })

    return {
        "Parameter": parameter,
        "Node": pd.DataFrame(node_rows),
        "Edge": pd.DataFrame(edge_rows),
        "Graph": pd.DataFrame(graph_rows),
    }


def main() -> None:
    homo_v2 = OUT / "demo_multigraph_homo.v2.xlsx"
    homo_large_v2 = OUT / "demo_multigraph_homo_large.v2.xlsx"
    _write(homo_v2, make_homo(30))
    _write(homo_large_v2, make_homo(100))
    # Also refresh the unversioned alias (best-effort; may be locked by Excel).
    try:
        _write(OUT / "demo_multigraph_homo.xlsx", make_homo(30))
    except PermissionError:
        print("Skipped demo_multigraph_homo.xlsx (open in Excel?)")
    print(f"Wrote {homo_v2}")
    print(f"Wrote {homo_large_v2}")


if __name__ == "__main__":
    main()
