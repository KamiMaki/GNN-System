"""Generate demo .xlsx files matching the graph_data_template.

Produces two files under backend/demo_data/:
    * demo_multigraph_homo.xlsx   — 10 graphs, single node/edge type,
                                    graph regression target
    * demo_multigraph_hetero.xlsx — 10 graphs, 3 node types (cell/pin/net),
                                    3 edge types (cell2pin/pin2pin/pin2net),
                                    graph regression target

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


# ── Homogeneous demo (10 graphs, graph_regression) ────────────────────────

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
                "Graph_ID": gid, "Node": nid, "Type": "default",
                "delay_ps": delay,
                "area_um2": round(rng.uniform(0.3, 3.0), 3),
                "fanout": rng.randint(1, 10),
                "drive": rng.choice([1, 2, 4, 8, 16]),
                "depth": rng.randint(1, 10),
            })
        # Sparse random edges (~1.5x nodes)
        n_edges = int(n_nodes * 1.5)
        for _ in range(n_edges):
            s = rng.choice(node_ids)
            d = rng.choice(node_ids)
            if s == d:
                continue
            edge_rows.append({
                "Graph_ID": gid, "Source_Node_ID": s, "Target_Node_ID": d,
                "Edge_Type": "default",
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
        "Node_default": pd.DataFrame(node_rows),
        "Edge_default": pd.DataFrame(edge_rows),
        "Graph_default": pd.DataFrame(graph_rows),
    }


# ── Heterogeneous demo (10 graphs, cell/pin/net, graph_regression) ────────

def make_hetero(n_graphs: int = 30) -> dict[str, pd.DataFrame]:
    rng = random.Random(SEED + 1)
    parameter = pd.DataFrame([
        # cell nodes
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "cell_area", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "cell_drive", "Weight": None},
        # pin nodes
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "pin_cap", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "pin_slew", "Weight": None},
        # net nodes
        {"XY": "X", "Level": "Node", "Type": "net", "Parameter": "net_fanout", "Weight": None},
        # edges with X features
        {"XY": "X", "Level": "Edge", "Type": "cell2pin", "Parameter": "c2p_delay", "Weight": None},
        {"XY": "X", "Level": "Edge", "Type": "pin2pin", "Parameter": "p2p_wire_len", "Weight": None},
        {"XY": "X", "Level": "Edge", "Type": "pin2net", "Parameter": "p2n_res", "Weight": None},
        # graph-level
        {"XY": "X", "Level": "Graph", "Type": "default", "Parameter": "num_cells", "Weight": None},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "total_wirelength", "Weight": 1.0},
    ])

    cell_rows, pin_rows, net_rows = [], [], []
    e_c2p, e_p2p, e_p2n = [], [], []
    graph_rows = []

    for gid in range(1, n_graphs + 1):
        n_cells = rng.randint(8, 18)
        n_pins = n_cells * 3
        n_nets = max(n_cells // 2, 3)

        cell_ids = list(range(n_cells))
        pin_ids = list(range(n_pins))
        net_ids = list(range(n_nets))

        for cid in cell_ids:
            cell_rows.append({
                "Graph_ID": gid, "Node": cid, "Type": "cell",
                "cell_area": round(rng.uniform(0.5, 4.0), 3),
                "cell_drive": rng.choice([1, 2, 4, 8]),
            })
        for pid in pin_ids:
            pin_rows.append({
                "Graph_ID": gid, "Node": pid, "Type": "pin",
                "pin_cap": round(rng.uniform(0.05, 1.0), 4),
                "pin_slew": round(rng.uniform(10, 80), 2),
            })
        for nid in net_ids:
            net_rows.append({
                "Graph_ID": gid, "Node": nid, "Type": "net",
                "net_fanout": rng.randint(2, 8),
            })

        # cell → pin: each cell connects to 3 pins
        for cid in cell_ids:
            for k in range(3):
                pid = cid * 3 + k
                e_c2p.append({
                    "Graph_ID": gid, "Source_Node_ID": cid, "Target_Node_ID": pid,
                    "Source_Node_Type": "cell", "Target_Node_Type": "pin",
                    "Edge_Type": "cell2pin",
                    "c2p_delay": round(rng.uniform(5, 40), 2),
                })
        # pin → pin: each pin connects to one other pin
        for pid in pin_ids:
            tgt = rng.choice(pin_ids)
            if tgt == pid:
                continue
            e_p2p.append({
                "Graph_ID": gid, "Source_Node_ID": pid, "Target_Node_ID": tgt,
                "Source_Node_Type": "pin", "Target_Node_Type": "pin",
                "Edge_Type": "pin2pin",
                "p2p_wire_len": round(rng.uniform(5, 50), 2),
            })
        # pin → net: each pin connects to one net
        total_wl = 0.0
        for pid in pin_ids:
            net = rng.choice(net_ids)
            wl = rng.uniform(2, 30)
            total_wl += wl
            e_p2n.append({
                "Graph_ID": gid, "Source_Node_ID": pid, "Target_Node_ID": net,
                "Source_Node_Type": "pin", "Target_Node_Type": "net",
                "Edge_Type": "pin2net",
                "p2n_res": round(wl * 0.1, 3),
            })

        graph_rows.append({
            "Graph_ID": gid,
            "num_cells": n_cells,
            "total_wirelength": round(total_wl + rng.uniform(-5, 5), 2),
        })

    return {
        "Parameter": parameter,
        "Node_cell": pd.DataFrame(cell_rows),
        "Node_pin": pd.DataFrame(pin_rows),
        "Node_net": pd.DataFrame(net_rows),
        "Edge_cell2pin": pd.DataFrame(e_c2p),
        "Edge_pin2pin": pd.DataFrame(e_p2p),
        "Edge_pin2net": pd.DataFrame(e_p2n),
        "Graph_default": pd.DataFrame(graph_rows),
    }


def main() -> None:
    homo = OUT / "demo_multigraph_homo.xlsx"
    hetero = OUT / "demo_multigraph_hetero.xlsx"
    _write(homo, make_homo())
    _write(hetero, make_hetero())
    print(f"Wrote {homo}")
    print(f"Wrote {hetero}")


if __name__ == "__main__":
    main()
