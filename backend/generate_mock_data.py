"""Generate large-scale mock data CSVs for the LayoutXpert GNN backend.

Produces 30,000 nodes (21K train / 9K test) with ~6 edges per node on average,
split proportionally across train/test sets.

Run with:
    cd backend && uv run python generate_mock_data.py
"""

import csv
import os
import random
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SEED = 42
TOTAL_NODES = 30_000
TRAIN_NODES = 21_000
TEST_NODES = TOTAL_NODES - TRAIN_NODES  # 9,000

AVG_EDGES_PER_NODE = 6  # target ~180K total edges

# Cell-type distribution
CELL_TYPES = [
    ("Logic", "LOG", 0.50),
    ("Buffer", "BUF", 0.25),
    ("Register", "REG", 0.15),
    ("Port", "PRT", 0.10),
]

# Critical-node fraction
CRITICAL_FRACTION = 0.18  # ~18%

OUT_DIR = Path(__file__).resolve().parent / "mock_data"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def pick_cell_type(rng: random.Random):
    """Return (cell_type, prefix) according to distribution."""
    r = rng.random()
    cumulative = 0.0
    for cell_type, prefix, prob in CELL_TYPES:
        cumulative += prob
        if r < cumulative:
            return cell_type, prefix
    return CELL_TYPES[-1][0], CELL_TYPES[-1][1]


def generate_node(node_id: int, is_critical: bool, rng: random.Random):
    """Generate a single node row as a dict."""
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


def generate_edges(nodes: list[dict], rng: random.Random):
    """Generate edges for a list of nodes.

    Each node gets between 3 and 10 outgoing edges (avg ~6).
    Edge is_critical = 1 only when BOTH endpoints are critical.
    """
    n = len(nodes)
    critical_set = {nd["node_id"] for nd in nodes if nd["is_critical"] == 1}
    node_ids = [nd["node_id"] for nd in nodes]

    edges: list[dict] = []
    seen: set[tuple[int, int]] = set()

    for nd in nodes:
        src = nd["node_id"]
        num_edges = rng.randint(3, 10)
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

            edges.append({
                "src_id": src,
                "dst_id": dst,
                "wire_cap_ff": wire_cap_ff,
                "wire_length_um": wire_length_um,
                "is_critical": edge_critical,
            })
            added += 1

    return edges


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rng = random.Random(SEED)

    print(f"Generating {TOTAL_NODES} nodes ({TRAIN_NODES} train / {TEST_NODES} test) ...")

    # Decide which node ids are critical
    all_ids = list(range(TOTAL_NODES))
    num_critical = int(TOTAL_NODES * CRITICAL_FRACTION)
    critical_ids = set(rng.sample(all_ids, num_critical))

    # Generate all nodes
    all_nodes = [generate_node(i, i in critical_ids, rng) for i in range(TOTAL_NODES)]

    train_nodes = all_nodes[:TRAIN_NODES]
    test_nodes = all_nodes[TRAIN_NODES:]

    # Re-index test nodes so node_id starts at 0 within the test split
    for idx, nd in enumerate(test_nodes):
        nd["node_id"] = idx
        # Fix name to reflect new id
        parts = nd["name"].rsplit("_", 1)
        nd["name"] = f"{parts[0]}_{idx:05d}"

    # Re-index train nodes (already 0-based, but be explicit)
    for idx, nd in enumerate(train_nodes):
        nd["node_id"] = idx
        parts = nd["name"].rsplit("_", 1)
        nd["name"] = f"{parts[0]}_{idx:05d}"

    print("Generating edges ...")
    train_edges = generate_edges(train_nodes, rng)
    test_edges = generate_edges(test_nodes, rng)

    # Write CSVs
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    node_fields = [
        "node_id", "name", "cell_type", "logic_depth", "fanout", "fan_in",
        "slack_ns", "cell_delay_ps", "drive_strength", "cell_area_um2",
        "congestion_score", "is_critical",
    ]
    edge_fields = ["src_id", "dst_id", "wire_cap_ff", "wire_length_um", "is_critical"]

    def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"  Wrote {path.name}: {len(rows)} rows")

    write_csv(OUT_DIR / "nodes_train.csv", node_fields, train_nodes)
    write_csv(OUT_DIR / "nodes_test.csv", node_fields, test_nodes)
    write_csv(OUT_DIR / "edges_train.csv", edge_fields, train_edges)
    write_csv(OUT_DIR / "edges_test.csv", edge_fields, test_edges)

    # Summary stats
    train_crit = sum(1 for n in train_nodes if n["is_critical"] == 1)
    test_crit = sum(1 for n in test_nodes if n["is_critical"] == 1)
    train_edge_crit = sum(1 for e in train_edges if e["is_critical"] == 1)
    test_edge_crit = sum(1 for e in test_edges if e["is_critical"] == 1)

    print("\n--- Summary ---")
    print(f"Train nodes: {len(train_nodes)}  (critical: {train_crit}, {train_crit/len(train_nodes)*100:.1f}%)")
    print(f"Test  nodes: {len(test_nodes)}  (critical: {test_crit}, {test_crit/len(test_nodes)*100:.1f}%)")
    print(f"Train edges: {len(train_edges)}  (critical: {train_edge_crit})")
    print(f"Test  edges: {len(test_edges)}  (critical: {test_edge_crit})")
    print(f"Avg edges/node (train): {len(train_edges)/len(train_nodes):.1f}")
    print(f"Avg edges/node (test):  {len(test_edges)/len(test_nodes):.1f}")
    print("\nDone.")


if __name__ == "__main__":
    main()
