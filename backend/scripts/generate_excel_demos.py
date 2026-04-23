"""Generate demo .xlsx files matching the graph_data_template.

Produces two files under backend/demo_data/:
    * demo_multigraph_homo.v2.xlsx   — 30 graphs, single node/edge type,
                                       graph regression target (single Node/Edge sheet)
    * demo_multigraph_hetero.v2.xlsx — 30 graphs, 3 node types (cell/pin/net),
                                       3 edge types (cell2pin/pin2pin/pin2net),
                                       graph regression target, unified Node/Edge sheets

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


# ── Homogeneous demo (30 graphs, graph_regression) ────────────────────────

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
        n_edges = int(n_nodes * 1.5)
        for _ in range(n_edges):
            s = rng.choice(node_ids)
            d = rng.choice(node_ids)
            if s == d:
                continue
            edge_rows.append({
                "Graph_ID": gid, "Source_Node_ID": s, "Target_Node_ID": d,
                "Type": "default",
                "wire_cap_ff": round(rng.uniform(0.1, 5.0), 3),
                "wire_length_um": round(rng.uniform(1.0, 100.0), 2),
            })
        graph_rows.append({
            "Graph_ID": gid, "Type": "default",
            "num_cells": n_nodes,
            "target_delay": round(total_delay / n_nodes + rng.uniform(-2, 2), 3),
        })

    return {
        "Parameter": parameter,
        "Node": pd.DataFrame(node_rows),
        "Edge": pd.DataFrame(edge_rows),
        "Graph": pd.DataFrame(graph_rows),
    }


# ── Heterogeneous demo (30 graphs, cell/pin/net, graph_regression) ────────
# Uses the unified single-sheet layout: one Node sheet, one Edge sheet, each
# distinguished by a Type column. Features that don't apply to a given type
# are left blank.

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

    # All node columns (superset). Rows leave N/A columns blank.
    node_cols = ["Graph_ID", "Node", "Type",
                 "cell_area", "cell_drive",
                 "pin_cap", "pin_slew",
                 "net_fanout"]
    edge_cols = ["Graph_ID", "Source_Node_ID", "Target_Node_ID",
                 "Source_Node_Type", "Target_Node_Type", "Type",
                 "c2p_delay", "p2p_wire_len", "p2n_res"]

    node_rows: list[dict] = []
    edge_rows: list[dict] = []
    graph_rows: list[dict] = []

    def _new_row(cols: list[str], **known) -> dict:
        row = {c: None for c in cols}
        row.update(known)
        return row

    for gid in range(1, n_graphs + 1):
        n_cells = rng.randint(8, 18)
        n_pins = n_cells * 3
        n_nets = max(n_cells // 2, 3)

        cell_ids = list(range(n_cells))
        pin_ids = list(range(n_pins))
        net_ids = list(range(n_nets))

        # Nodes — one row per node, blank features for other types.
        for cid in cell_ids:
            node_rows.append(_new_row(
                node_cols,
                Graph_ID=gid, Node=cid, Type="cell",
                cell_area=round(rng.uniform(0.5, 4.0), 3),
                cell_drive=rng.choice([1, 2, 4, 8]),
            ))
        for pid in pin_ids:
            node_rows.append(_new_row(
                node_cols,
                Graph_ID=gid, Node=pid, Type="pin",
                pin_cap=round(rng.uniform(0.05, 1.0), 4),
                pin_slew=round(rng.uniform(10, 80), 2),
            ))
        for nid in net_ids:
            node_rows.append(_new_row(
                node_cols,
                Graph_ID=gid, Node=nid, Type="net",
                net_fanout=rng.randint(2, 8),
            ))

        # Edges — one row per edge, blank features for other relations.
        for cid in cell_ids:
            for k in range(3):
                pid = cid * 3 + k
                edge_rows.append(_new_row(
                    edge_cols,
                    Graph_ID=gid, Source_Node_ID=cid, Target_Node_ID=pid,
                    Source_Node_Type="cell", Target_Node_Type="pin",
                    Type="cell2pin",
                    c2p_delay=round(rng.uniform(5, 40), 2),
                ))
        for pid in pin_ids:
            tgt = rng.choice(pin_ids)
            if tgt == pid:
                continue
            edge_rows.append(_new_row(
                edge_cols,
                Graph_ID=gid, Source_Node_ID=pid, Target_Node_ID=tgt,
                Source_Node_Type="pin", Target_Node_Type="pin",
                Type="pin2pin",
                p2p_wire_len=round(rng.uniform(5, 50), 2),
            ))
        total_wl = 0.0
        for pid in pin_ids:
            net = rng.choice(net_ids)
            wl = rng.uniform(2, 30)
            total_wl += wl
            edge_rows.append(_new_row(
                edge_cols,
                Graph_ID=gid, Source_Node_ID=pid, Target_Node_ID=net,
                Source_Node_Type="pin", Target_Node_Type="net",
                Type="pin2net",
                p2n_res=round(wl * 0.1, 3),
            ))

        graph_rows.append({
            "Graph_ID": gid, "Type": "default",
            "num_cells": n_cells,
            "total_wirelength": round(total_wl + rng.uniform(-5, 5), 2),
        })

    return {
        "Parameter": parameter,
        "Node": pd.DataFrame(node_rows, columns=node_cols),
        "Edge": pd.DataFrame(edge_rows, columns=edge_cols),
        "Graph": pd.DataFrame(graph_rows),
    }


def main() -> None:
    homo_v2 = OUT / "demo_multigraph_homo.v2.xlsx"
    hetero_v2 = OUT / "demo_multigraph_hetero.v2.xlsx"
    _write(homo_v2, make_homo())
    _write(hetero_v2, make_hetero())
    # Also refresh the unversioned aliases (best-effort; may be locked by Excel).
    for name, builder in (("demo_multigraph_homo.xlsx", make_homo),
                          ("demo_multigraph_hetero.xlsx", make_hetero)):
        try:
            _write(OUT / name, builder())
        except PermissionError:
            print(f"Skipped {name} (open in Excel?)")
    print(f"Wrote {homo_v2}")
    print(f"Wrote {hetero_v2}")


if __name__ == "__main__":
    main()
