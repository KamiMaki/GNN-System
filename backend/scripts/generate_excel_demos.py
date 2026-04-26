"""Generate demo .xlsx files matching the graph_data_template (V3 — 2026-04-26).

Produces files under backend/demo_data/:
    * demo_multigraph_homo.v2.xlsx        — 30 graphs, homogeneous, graph regression
    * demo_multigraph_homo_large.v2.xlsx  — 100 graphs, homogeneous, graph regression
    * demo_multigraph_hetero.v2.xlsx      — 30 graphs, 3 node types (cell/pin/net),
                                            2 edge types (cell_pin/pin_net),
                                            graph regression (total_wirelength)

Hetero schema:
    Node sheet has a ``Type`` column with values "cell", "pin", "net".
    Edge sheet has a ``Type`` column with values "cell_pin", "pin_net".
    Parameter sheet declares features per type and the graph-level Y target.

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


# ── Heterogeneous demo (graph_regression) ────────────────────────────────
# 3 node types: cell, pin, net
# 2 edge types: cell_pin (cell→pin connections), pin_net (pin→net connections)
# Graph-level Y: total_wirelength (regression)
#
# Node sheet has a ``Type`` column; Edge sheet has a ``Type`` column.
# Parameter sheet declares features per node/edge type + graph-level Y.

def make_hetero(n_graphs: int = 30) -> dict[str, pd.DataFrame]:
    rng = random.Random(SEED)

    parameter = pd.DataFrame([
        # Cell node features
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "cell_delay_ps", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "cell_area_um2", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "cell_drive", "Weight": None},
        # Pin node features
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "pin_cap_ff", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "pin_direction", "Weight": None},
        # Net node features
        {"XY": "X", "Level": "Node", "Type": "net", "Parameter": "net_fanout", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "net", "Parameter": "net_total_cap_ff", "Weight": None},
        # cell_pin edge features
        {"XY": "X", "Level": "Edge", "Type": "cell_pin", "Parameter": "cp_resistance_ohm", "Weight": None},
        # pin_net edge features
        {"XY": "X", "Level": "Edge", "Type": "pin_net", "Parameter": "pn_wire_length_um", "Weight": None},
        # Graph-level X + Y
        {"XY": "X", "Level": "Graph", "Type": "default", "Parameter": "num_cells", "Weight": None},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "total_wirelength", "Weight": 1.0},
    ])

    node_rows: list[dict] = []
    edge_rows: list[dict] = []
    graph_rows: list[dict] = []

    global_node_id = 0

    for gid in range(1, n_graphs + 1):
        n_cells = rng.randint(5, 15)
        n_pins_per_cell = rng.randint(2, 4)
        n_nets = rng.randint(3, 8)

        cell_ids = list(range(global_node_id, global_node_id + n_cells))
        global_node_id += n_cells
        pin_ids = list(range(global_node_id, global_node_id + n_cells * n_pins_per_cell))
        global_node_id += n_cells * n_pins_per_cell
        net_ids = list(range(global_node_id, global_node_id + n_nets))
        global_node_id += n_nets

        for cid in cell_ids:
            node_rows.append({
                "Graph_ID": gid, "Node": cid, "Type": "cell",
                "cell_delay_ps": rng.randint(5, 60),
                "cell_area_um2": round(rng.uniform(0.3, 3.0), 3),
                "cell_drive": rng.choice([1, 2, 4, 8]),
                "pin_cap_ff": None, "pin_direction": None,
                "net_fanout": None, "net_total_cap_ff": None,
            })

        for pid in pin_ids:
            node_rows.append({
                "Graph_ID": gid, "Node": pid, "Type": "pin",
                "cell_delay_ps": None, "cell_area_um2": None, "cell_drive": None,
                "pin_cap_ff": round(rng.uniform(0.01, 0.5), 4),
                "pin_direction": rng.choice([0, 1]),
                "net_fanout": None, "net_total_cap_ff": None,
            })

        for nid in net_ids:
            node_rows.append({
                "Graph_ID": gid, "Node": nid, "Type": "net",
                "cell_delay_ps": None, "cell_area_um2": None, "cell_drive": None,
                "pin_cap_ff": None, "pin_direction": None,
                "net_fanout": rng.randint(1, 8),
                "net_total_cap_ff": round(rng.uniform(0.1, 2.0), 3),
            })

        # cell_pin edges: each cell connects to its pins
        total_wl = 0.0
        for i, cid in enumerate(cell_ids):
            for j in range(n_pins_per_cell):
                pid = pin_ids[i * n_pins_per_cell + j]
                resistance = round(rng.uniform(1.0, 50.0), 2)
                edge_rows.append({
                    "Graph_ID": gid,
                    "Source_Node_ID": cid, "Target_Node_ID": pid,
                    "Type": "cell_pin",
                    "cp_resistance_ohm": resistance,
                    "pn_wire_length_um": None,
                })

        # pin_net edges: each net connects to random pins
        for nid in net_ids:
            connected = rng.sample(pin_ids, min(rng.randint(1, 3), len(pin_ids)))
            for pid in connected:
                wl = round(rng.uniform(5.0, 200.0), 2)
                total_wl += wl
                edge_rows.append({
                    "Graph_ID": gid,
                    "Source_Node_ID": pid, "Target_Node_ID": nid,
                    "Type": "pin_net",
                    "cp_resistance_ohm": None,
                    "pn_wire_length_um": wl,
                })

        graph_rows.append({
            "Graph_ID": gid,
            "num_cells": n_cells,
            "total_wirelength": round(total_wl + rng.uniform(-50, 50), 2),
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
    hetero_v2 = OUT / "demo_multigraph_hetero.v2.xlsx"

    _write(homo_v2, make_homo(30))
    _write(homo_large_v2, make_homo(100))

    # Hetero file may be locked if open in Excel; fall back to a temp name.
    try:
        _write(hetero_v2, make_hetero(30))
        print(f"Wrote {hetero_v2}")
    except PermissionError:
        fallback = OUT / "demo_multigraph_hetero.v2.new.xlsx"
        _write(fallback, make_hetero(30))
        print(f"Skipped {hetero_v2} (open in Excel?); wrote {fallback} instead")

    # Also refresh the unversioned homo alias (best-effort; may be locked by Excel).
    try:
        _write(OUT / "demo_multigraph_homo.xlsx", make_homo(30))
    except PermissionError:
        print("Skipped demo_multigraph_homo.xlsx (open in Excel?)")

    print(f"Wrote {homo_v2}")
    print(f"Wrote {homo_large_v2}")


if __name__ == "__main__":
    main()
