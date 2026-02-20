from pathlib import Path

from app.data.ingestion import parse_csv_pair
from app.data.pyg_converter import dataframes_to_pyg


MOCK_DIR = Path(__file__).resolve().parent.parent / "mock_data"


def test_dataframes_to_pyg():
    parsed = parse_csv_pair(
        nodes_csv=MOCK_DIR / "nodes_train.csv",
        edges_csv=MOCK_DIR / "edges_train.csv",
        dataset_name="test",
    )
    data, scaler = dataframes_to_pyg(parsed["nodes_df"], parsed["edges_df"], fit_scaler=True)

    # Check shapes
    num_nodes = len(parsed["nodes_df"])
    assert data.x.shape[0] == num_nodes
    assert data.x.shape[1] == 11  # 7 numeric + 4 one-hot
    assert data.y.shape[0] == num_nodes
    assert data.edge_index.shape[0] == 2
    assert data.edge_attr.shape[1] == 2  # wire_cap_ff, wire_length_um

    # Check label values are 0 or 1
    assert set(data.y.numpy().tolist()).issubset({0, 1})

    # Check scaler was fitted
    assert scaler is not None


def test_scaler_reuse():
    """Test that test data can use the train scaler."""
    train_parsed = parse_csv_pair(
        MOCK_DIR / "nodes_train.csv", MOCK_DIR / "edges_train.csv", "train"
    )
    test_parsed = parse_csv_pair(
        MOCK_DIR / "nodes_test.csv", MOCK_DIR / "edges_test.csv", "test"
    )

    _, scaler = dataframes_to_pyg(train_parsed["nodes_df"], train_parsed["edges_df"], fit_scaler=True)
    test_data, _ = dataframes_to_pyg(
        test_parsed["nodes_df"], test_parsed["edges_df"], scaler=scaler, fit_scaler=False
    )

    assert test_data.x.shape[1] == 11
    assert test_data.y.shape[0] == len(test_parsed["nodes_df"])
