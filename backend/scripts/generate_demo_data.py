"""Generate 4 demo datasets for LayoutXpert."""

import os
import random
import numpy as np
import pandas as pd

random.seed(42)
np.random.seed(42)

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "mock_data")

CELL_TYPES = ["Logic", "Buffer", "Register", "Port"]


def make_edges(n_nodes, n_edges, extra_cols=None):
    """Generate random edges."""
    rows = []
    for _ in range(n_edges):
        src = random.randint(0, n_nodes - 1)
        dst = random.randint(0, n_nodes - 1)
        while dst == src:
            dst = random.randint(0, n_nodes - 1)
        row = {"src_id": src, "dst_id": dst}
        if extra_cols:
            for col, fn in extra_cols.items():
                row[col] = fn()
        rows.append(row)
    return pd.DataFrame(rows)


def make_nodes(n, add_missing=False, add_outliers=False):
    """Generate nodes with standard circuit features."""
    data = {
        "node_id": list(range(n)),
        "name": [f"cell_{i}" for i in range(n)],
        "cell_type": [random.choice(CELL_TYPES) for _ in range(n)],
        "logic_depth": [random.randint(1, 8) for _ in range(n)],
        "fanout": [max(1, int(np.random.exponential(3))) for _ in range(n)],
        "fan_in": [max(1, int(np.random.exponential(2))) for _ in range(n)],
        "slack_ns": [round(np.random.normal(0.5, 0.3), 3) for _ in range(n)],
        "cell_delay_ps": [round(abs(np.random.normal(15, 5)), 1) for _ in range(n)],
        "drive_strength": [round(1 + random.random() * 4, 1) for _ in range(n)],
        "cell_area_um2": [round(0.5 + random.random() * 5, 2) for _ in range(n)],
        "congestion_score": [round(random.random(), 3) for _ in range(n)],
    }
    # Label: is_critical based on slack
    data["is_critical"] = [1 if s < 0.2 else 0 for s in data["slack_ns"]]

    df = pd.DataFrame(data)

    if add_missing:
        # Introduce ~5% missing values in slack_ns, cell_delay_ps, congestion_score
        for col in ["slack_ns", "cell_delay_ps", "congestion_score"]:
            mask = np.random.random(n) < 0.05
            df.loc[mask, col] = np.nan

    if add_outliers:
        # Add a few extreme outliers
        outlier_idx = np.random.choice(n, size=max(1, n // 50), replace=False)
        df.loc[outlier_idx, "fanout"] = df.loc[outlier_idx, "fanout"] * 20
        df.loc[outlier_idx, "cell_delay_ps"] = df.loc[outlier_idx, "cell_delay_ps"] * 15

    return df


def save_dataset(outdir, nodes_train, edges_train, nodes_test=None, edges_test=None):
    os.makedirs(outdir, exist_ok=True)
    nodes_train.to_csv(os.path.join(outdir, "nodes_train.csv"), index=False)
    edges_train.to_csv(os.path.join(outdir, "edges_train.csv"), index=False)
    if nodes_test is not None:
        nodes_test.to_csv(os.path.join(outdir, "nodes_test.csv"), index=False)
    if edges_test is not None:
        edges_test.to_csv(os.path.join(outdir, "edges_test.csv"), index=False)
    print(f"  Saved to {outdir}: {len(nodes_train)} train nodes, "
          f"{len(edges_train)} train edges"
          + (f", {len(nodes_test)} test nodes" if nodes_test is not None else ""))


def generate_basic():
    """Demo 1: Basic single graph, clean data."""
    print("Generating demo_basic...")
    nodes_train = make_nodes(300)
    nodes_test = make_nodes(100)
    # Reindex test node_ids to avoid overlap
    nodes_test["node_id"] = nodes_test["node_id"] + 300
    nodes_test["name"] = [f"cell_{i}" for i in range(300, 400)]

    edges_train = make_edges(300, 600, {"wire_cap_ff": lambda: round(random.uniform(0.1, 5), 2),
                                         "wire_length_um": lambda: round(random.uniform(1, 100), 1)})
    edges_test = make_edges(100, 200, {"wire_cap_ff": lambda: round(random.uniform(0.1, 5), 2),
                                        "wire_length_um": lambda: round(random.uniform(1, 100), 1)})
    # Fix test edge ids to be in test range
    edges_test["src_id"] = edges_test["src_id"] + 300
    edges_test["dst_id"] = edges_test["dst_id"] + 300

    save_dataset(os.path.join(BASE_DIR, "demo_basic"), nodes_train, edges_train, nodes_test, edges_test)


def generate_edge_attrs():
    """Demo 2: Graph with extra edge attributes."""
    print("Generating demo_edge_attrs...")
    nodes_train = make_nodes(250)
    nodes_test = make_nodes(80)
    nodes_test["node_id"] = nodes_test["node_id"] + 250
    nodes_test["name"] = [f"cell_{i}" for i in range(250, 330)]

    routing_layers = ["M1", "M2", "M3", "M4", "M5"]

    def edge_cols():
        return {
            "wire_cap_ff": lambda: round(random.uniform(0.1, 5), 2),
            "wire_length_um": lambda: round(random.uniform(1, 100), 1),
            "routing_layer": lambda: random.choice(routing_layers),
            "resistance_ohm": lambda: round(random.uniform(0.5, 50), 2),
            "coupling_cap_ff": lambda: round(random.uniform(0.01, 2), 3),
        }

    edges_train = make_edges(250, 500, edge_cols())
    edges_test = make_edges(80, 160, edge_cols())
    edges_test["src_id"] = edges_test["src_id"] + 250
    edges_test["dst_id"] = edges_test["dst_id"] + 250

    save_dataset(os.path.join(BASE_DIR, "demo_edge_attrs"), nodes_train, edges_train, nodes_test, edges_test)


def generate_multigraph():
    """Demo 3: Multiple graphs in separate folders."""
    print("Generating demo_multigraph...")
    base = os.path.join(BASE_DIR, "demo_multigraph")

    for gname, n_nodes, n_edges in [("graph_A", 120, 240), ("graph_B", 100, 200), ("graph_C", 130, 260)]:
        nodes = make_nodes(n_nodes)
        edges = make_edges(n_nodes, n_edges, {
            "wire_cap_ff": lambda: round(random.uniform(0.1, 5), 2),
            "wire_length_um": lambda: round(random.uniform(1, 100), 1),
        })
        gdir = os.path.join(base, gname)
        save_dataset(gdir, nodes, edges)


def generate_dirty():
    """Demo 4: Data with missing values and outliers."""
    print("Generating demo_dirty...")
    nodes_train = make_nodes(300, add_missing=True, add_outliers=True)
    nodes_test = make_nodes(100, add_missing=True, add_outliers=False)
    nodes_test["node_id"] = nodes_test["node_id"] + 300
    nodes_test["name"] = [f"cell_{i}" for i in range(300, 400)]

    edges_train = make_edges(300, 600, {"wire_cap_ff": lambda: round(random.uniform(0.1, 5), 2),
                                         "wire_length_um": lambda: round(random.uniform(1, 100), 1)})
    edges_test = make_edges(100, 200, {"wire_cap_ff": lambda: round(random.uniform(0.1, 5), 2),
                                        "wire_length_um": lambda: round(random.uniform(1, 100), 1)})
    edges_test["src_id"] = edges_test["src_id"] + 300
    edges_test["dst_id"] = edges_test["dst_id"] + 300

    # Add a column with mixed types to nodes_train
    nodes_train["mixed_col"] = [
        str(i) if random.random() > 0.1 else random.choice(["N/A", "unknown", None])
        for i in range(len(nodes_train))
    ]

    save_dataset(os.path.join(BASE_DIR, "demo_dirty"), nodes_train, edges_train, nodes_test, edges_test)


if __name__ == "__main__":
    generate_basic()
    generate_edge_attrs()
    generate_multigraph()
    generate_dirty()
    print("\nAll demo datasets generated successfully!")
