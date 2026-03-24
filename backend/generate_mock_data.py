"""Generate mock data CSVs for the GraphX.AI GNN backend.

Produces:
  1. Original large-scale mock dataset (30K nodes) at mock_data/
  2. demo_basic/      — 400 nodes, clean single graph
  3. demo_edge_attrs/ — 330 nodes, extra edge features
  4. demo_multigraph/ — 3 subgraphs (graph_A, graph_B, graph_C), ~350 total
  5. demo_dirty/      — 400 nodes, ~5% missing values + outliers

Run with:
    cd backend && uv run python generate_mock_data.py
"""

import csv
import math
import os
import random
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SEED = 42
OUT_DIR = Path(__file__).resolve().parent / "mock_data"

# Cell-type distribution
CELL_TYPES = [
    ("Logic", "LOG", 0.50),
    ("Buffer", "BUF", 0.25),
    ("Register", "REG", 0.15),
    ("Port", "PRT", 0.10),
]

CRITICAL_FRACTION = 0.18


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def pick_cell_type(rng: random.Random):
    r = rng.random()
    cumulative = 0.0
    for cell_type, prefix, prob in CELL_TYPES:
        cumulative += prob
        if r < cumulative:
            return cell_type, prefix
    return CELL_TYPES[-1][0], CELL_TYPES[-1][1]


def generate_node(node_id: int, is_critical: bool, rng: random.Random):
    cell_type, prefix = pick_cell_type(rng)

    if is_critical:
        logic_depth = rng.randint(6, 12)
        fanout = rng.randint(4, 15)
        fan_in = rng.randint(1, 5)
        slack_ns = round(rng.uniform(-0.08, 0.005), 6)
        congestion_score = round(rng.uniform(0.45, 0.95), 4)
        cell_delay_ps = rng.randint(25, 60)
    else:
        logic_depth = rng.randint(1, 8)
        fanout = rng.randint(1, 8)
        fan_in = rng.randint(1, 4)
        slack_ns = round(rng.uniform(0.005, 0.15), 6)
        congestion_score = round(rng.uniform(0.05, 0.50), 4)
        cell_delay_ps = rng.randint(5, 45)

    drive_strength = rng.choice([1, 2, 4, 8, 16])
    cell_area_um2 = round(0.3 + drive_strength * rng.uniform(0.15, 0.35), 3)
    name = f"{prefix}_{drive_strength}_D{logic_depth:02d}_{node_id:05d}"

    return {
        "node_id": node_id,
        "name": name,
        "cell_type": cell_type,
        "logic_depth": logic_depth,
        "fanout": fanout,
        "fan_in": fan_in,
        "slack_ns": slack_ns,
        "cell_delay_ps": cell_delay_ps,
        "drive_strength": drive_strength,
        "cell_area_um2": cell_area_um2,
        "congestion_score": congestion_score,
        "is_critical": 1 if is_critical else 0,
    }


def generate_edges(nodes: list[dict], avg_per_node: int, rng: random.Random,
                   extra_edge_attrs: bool = False):
    n = len(nodes)
    critical_set = {nd["node_id"] for nd in nodes if nd["is_critical"] == 1}
    node_ids = [nd["node_id"] for nd in nodes]

    edges: list[dict] = []
    seen: set[tuple[int, int]] = set()

    lo = max(1, avg_per_node - 2)
    hi = avg_per_node + 2

    for nd in nodes:
        src = nd["node_id"]
        num_edges = rng.randint(lo, hi)
        attempts = 0
        added = 0
        while added < num_edges and attempts < num_edges * 4:
            attempts += 1
            dst = rng.choice(node_ids)
            if dst == src:
                continue
            key = (src, dst)
            if key in seen:
                continue
            seen.add(key)

            wire_length_um = round(rng.uniform(5.0, 500.0), 2)
            wire_cap_ff = round(wire_length_um * rng.uniform(0.08, 0.25), 2)

            edge_critical = 1 if (src in critical_set and dst in critical_set) else 0

            edge = {
                "src_id": src,
                "dst_id": dst,
                "wire_cap_ff": wire_cap_ff,
                "wire_length_um": wire_length_um,
                "is_critical": edge_critical,
            }

            if extra_edge_attrs:
                edge["routing_layer"] = rng.choice(["M1", "M2", "M3", "M4", "M5"])
                edge["resistance_ohm"] = round(rng.uniform(0.5, 50.0), 2)
                edge["coupling_cap_ff"] = round(rng.uniform(0.01, 2.0), 4)

            added += 1
            edges.append(edge)

    return edges


def reindex_nodes(nodes: list[dict]):
    for idx, nd in enumerate(nodes):
        nd["node_id"] = idx
        parts = nd["name"].rsplit("_", 1)
        nd["name"] = f"{parts[0]}_{idx:05d}"


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  {path.relative_to(OUT_DIR)}: {len(rows)} rows")


NODE_FIELDS = [
    "node_id", "name", "cell_type", "logic_depth", "fanout", "fan_in",
    "slack_ns", "cell_delay_ps", "drive_strength", "cell_area_um2",
    "congestion_score", "is_critical",
]
EDGE_FIELDS = ["src_id", "dst_id", "wire_cap_ff", "wire_length_um", "is_critical"]
EDGE_FIELDS_EXTRA = EDGE_FIELDS + ["routing_layer", "resistance_ohm", "coupling_cap_ff"]


def make_nodes_and_edges(n_nodes: int, rng: random.Random,
                         avg_edges: int = 4, extra_edge_attrs: bool = False,
                         train_ratio: float = 0.8):
    """Generate nodes + edges, split into train/test."""
    num_critical = int(n_nodes * CRITICAL_FRACTION)
    critical_ids = set(rng.sample(range(n_nodes), num_critical))
    all_nodes = [generate_node(i, i in critical_ids, rng) for i in range(n_nodes)]

    split = int(n_nodes * train_ratio)
    train_nodes = all_nodes[:split]
    test_nodes = all_nodes[split:]

    reindex_nodes(train_nodes)
    reindex_nodes(test_nodes)

    train_edges = generate_edges(train_nodes, avg_edges, rng, extra_edge_attrs)
    test_edges = generate_edges(test_nodes, avg_edges, rng, extra_edge_attrs)

    return train_nodes, test_nodes, train_edges, test_edges


def inject_missing_and_outliers(nodes: list[dict], rng: random.Random, missing_pct: float = 0.05):
    """Add ~5% missing values (empty strings) and inject outliers into numeric columns."""
    numeric_cols = ["logic_depth", "fanout", "fan_in", "slack_ns",
                    "cell_delay_ps", "drive_strength", "cell_area_um2", "congestion_score"]

    n = len(nodes)
    n_missing_per_col = max(1, int(n * missing_pct))

    for col in numeric_cols:
        # Inject missing values
        missing_indices = rng.sample(range(n), n_missing_per_col)
        for idx in missing_indices:
            nodes[idx][col] = ""

    # Inject outliers (extreme values) in ~2% of non-missing rows
    n_outliers = max(1, int(n * 0.02))
    for col in ["fanout", "cell_delay_ps", "cell_area_um2", "congestion_score"]:
        outlier_indices = rng.sample(range(n), n_outliers)
        for idx in outlier_indices:
            if nodes[idx][col] == "":
                continue
            if col == "fanout":
                nodes[idx][col] = rng.randint(50, 200)
            elif col == "cell_delay_ps":
                nodes[idx][col] = rng.randint(200, 500)
            elif col == "cell_area_um2":
                nodes[idx][col] = round(rng.uniform(50.0, 200.0), 3)
            elif col == "congestion_score":
                nodes[idx][col] = round(rng.uniform(5.0, 20.0), 4)

    # Also make cell_type have some missing values
    for idx in rng.sample(range(n), max(1, int(n * missing_pct))):
        nodes[idx]["cell_type"] = ""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rng = random.Random(SEED)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ====================================================================
    # 1. Original large-scale mock dataset (30K nodes)
    # ====================================================================
    print("=" * 60)
    print("1. Original mock dataset (30K nodes)")
    print("=" * 60)

    TOTAL = 30_000
    TRAIN = 21_000
    num_crit = int(TOTAL * CRITICAL_FRACTION)
    crit_ids = set(rng.sample(range(TOTAL), num_crit))
    all_nodes = [generate_node(i, i in crit_ids, rng) for i in range(TOTAL)]

    train_nodes = all_nodes[:TRAIN]
    test_nodes = all_nodes[TRAIN:]
    reindex_nodes(train_nodes)
    reindex_nodes(test_nodes)

    train_edges = generate_edges(train_nodes, 6, rng)
    test_edges = generate_edges(test_nodes, 6, rng)

    write_csv(OUT_DIR / "nodes_train.csv", NODE_FIELDS, train_nodes)
    write_csv(OUT_DIR / "nodes_test.csv", NODE_FIELDS, test_nodes)
    write_csv(OUT_DIR / "edges_train.csv", EDGE_FIELDS, train_edges)
    write_csv(OUT_DIR / "edges_test.csv", EDGE_FIELDS, test_edges)

    tc = sum(1 for n in train_nodes if n["is_critical"] == 1)
    print(f"  Train: {len(train_nodes)} nodes ({tc} critical), {len(train_edges)} edges")
    print(f"  Test:  {len(test_nodes)} nodes, {len(test_edges)} edges")

    # ====================================================================
    # 2. demo_basic — 400 nodes, clean, single graph
    # ====================================================================
    print("\n" + "=" * 60)
    print("2. demo_basic (400 nodes, clean)")
    print("=" * 60)

    rng_basic = random.Random(SEED + 1)
    tr_n, te_n, tr_e, te_e = make_nodes_and_edges(400, rng_basic, avg_edges=4)

    demo_dir = OUT_DIR / "demo_basic"
    write_csv(demo_dir / "nodes_train.csv", NODE_FIELDS, tr_n)
    write_csv(demo_dir / "nodes_test.csv", NODE_FIELDS, te_n)
    write_csv(demo_dir / "edges_train.csv", EDGE_FIELDS, tr_e)
    write_csv(demo_dir / "edges_test.csv", EDGE_FIELDS, te_e)
    print(f"  Train: {len(tr_n)} nodes, {len(tr_e)} edges | Test: {len(te_n)} nodes, {len(te_e)} edges")

    # ====================================================================
    # 3. demo_edge_attrs — 330 nodes, extra edge features
    # ====================================================================
    print("\n" + "=" * 60)
    print("3. demo_edge_attrs (330 nodes, extra edge features)")
    print("=" * 60)

    rng_edge = random.Random(SEED + 2)
    tr_n, te_n, tr_e, te_e = make_nodes_and_edges(330, rng_edge, avg_edges=4, extra_edge_attrs=True)

    demo_dir = OUT_DIR / "demo_edge_attrs"
    write_csv(demo_dir / "nodes_train.csv", NODE_FIELDS, tr_n)
    write_csv(demo_dir / "nodes_test.csv", NODE_FIELDS, te_n)
    write_csv(demo_dir / "edges_train.csv", EDGE_FIELDS_EXTRA, tr_e)
    write_csv(demo_dir / "edges_test.csv", EDGE_FIELDS_EXTRA, te_e)
    print(f"  Train: {len(tr_n)} nodes, {len(tr_e)} edges | Test: {len(te_n)} nodes, {len(te_e)} edges")

    # ====================================================================
    # 4. demo_multigraph — 3 subgraphs (~120 nodes each)
    # ====================================================================
    print("\n" + "=" * 60)
    print("4. demo_multigraph (3 subgraphs)")
    print("=" * 60)

    rng_multi = random.Random(SEED + 3)
    graph_sizes = [120, 115, 115]  # ~350 total
    graph_names = ["graph_A", "graph_B", "graph_C"]

    for gname, gsize in zip(graph_names, graph_sizes):
        tr_n, te_n, tr_e, te_e = make_nodes_and_edges(gsize, rng_multi, avg_edges=4)
        gdir = OUT_DIR / "demo_multigraph" / gname
        write_csv(gdir / "nodes_train.csv", NODE_FIELDS, tr_n)
        write_csv(gdir / "edges_train.csv", EDGE_FIELDS, tr_e)
        # Multigraph: no separate test files (auto-split in _ingest)
        print(f"  {gname}: {len(tr_n)} nodes, {len(tr_e)} edges")

    # ====================================================================
    # 5. demo_dirty — 400 nodes, ~5% missing + outliers
    # ====================================================================
    print("\n" + "=" * 60)
    print("5. demo_dirty (400 nodes, missing values + outliers)")
    print("=" * 60)

    rng_dirty = random.Random(SEED + 4)
    tr_n, te_n, tr_e, te_e = make_nodes_and_edges(400, rng_dirty, avg_edges=4)

    # Inject missing values and outliers
    inject_missing_and_outliers(tr_n, rng_dirty, missing_pct=0.05)
    inject_missing_and_outliers(te_n, rng_dirty, missing_pct=0.05)

    demo_dir = OUT_DIR / "demo_dirty"
    write_csv(demo_dir / "nodes_train.csv", NODE_FIELDS, tr_n)
    write_csv(demo_dir / "nodes_test.csv", NODE_FIELDS, te_n)
    write_csv(demo_dir / "edges_train.csv", EDGE_FIELDS, tr_e)
    write_csv(demo_dir / "edges_test.csv", EDGE_FIELDS, te_e)

    # Count missing
    missing_train = sum(1 for n in tr_n for v in n.values() if v == "")
    missing_test = sum(1 for n in te_n for v in n.values() if v == "")
    print(f"  Train: {len(tr_n)} nodes, {len(tr_e)} edges | missing cells: {missing_train}")
    print(f"  Test:  {len(te_n)} nodes, {len(te_e)} edges | missing cells: {missing_test}")

    # ====================================================================
    # 6. demo_small_multigraph — 10 graphs, ~20 nodes each
    # ====================================================================
    print("\n" + "=" * 60)
    print("6. demo_small_multigraph (10 graphs, ~20 nodes each)")
    print("=" * 60)

    rng_sm = random.Random(SEED + 5)
    sm_graph_sizes = [18, 20, 22, 19, 21, 20, 23, 17, 20, 22]  # ~202 total
    sm_graph_names = [f"graph_{i+1:02d}" for i in range(10)]

    for gname, gsize in zip(sm_graph_names, sm_graph_sizes):
        nodes = []
        num_crit = max(1, int(gsize * CRITICAL_FRACTION))
        crit_ids = set(rng_sm.sample(range(gsize), num_crit))
        for i in range(gsize):
            nodes.append(generate_node(i, i in crit_ids, rng_sm))
        edges = generate_edges(nodes, 3, rng_sm)

        gdir = OUT_DIR / "demo_small_multigraph" / gname
        write_csv(gdir / "nodes_train.csv", NODE_FIELDS, nodes)
        write_csv(gdir / "edges_train.csv", EDGE_FIELDS, edges)
        print(f"  {gname}: {len(nodes)} nodes, {len(edges)} edges")

    print("\n" + "=" * 60)
    print("Done! All datasets generated.")
    print("=" * 60)


if __name__ == "__main__":
    main()
