from app.core.config import settings
from app.data.ingestion import parse_csv_pair
from app.data.pyg_converter import dataframes_to_pyg
from app.data.feature_engineering import compute_explore_stats


MOCK_DATASET_ID = "mock-circuit-v1"


def load_mock_dataset() -> dict:
    """Load the 4 mock CSVs and return a complete dataset record."""
    train = parse_csv_pair(
        nodes_csv=settings.MOCK_DATA_DIR / "nodes_train.csv",
        edges_csv=settings.MOCK_DATA_DIR / "edges_train.csv",
        dataset_name="Circuit Mock Dataset",
    )
    test = parse_csv_pair(
        nodes_csv=settings.MOCK_DATA_DIR / "nodes_test.csv",
        edges_csv=settings.MOCK_DATA_DIR / "edges_test.csv",
        dataset_name="Circuit Mock Dataset",
    )

    pyg_train, scaler = dataframes_to_pyg(train["nodes_df"], train["edges_df"], fit_scaler=True)
    pyg_test, _ = dataframes_to_pyg(test["nodes_df"], test["edges_df"], scaler=scaler, fit_scaler=False)

    explore_stats = compute_explore_stats(train["nodes_df"], train["edges_df"])

    return {
        "dataset_id": MOCK_DATASET_ID,
        "name": "Circuit Mock Dataset",
        "num_nodes": len(train["nodes_df"]) + len(test["nodes_df"]),
        "num_edges": len(train["edges_df"]) + len(test["edges_df"]),
        "num_features": int(pyg_train.x.shape[1]),
        "num_classes": 2,
        "is_directed": True,
        "pyg_train": pyg_train,
        "pyg_test": pyg_test,
        "scaler": scaler,
        "nodes_df_train": train["nodes_df"],
        "nodes_df_test": test["nodes_df"],
        "edges_df_train": train["edges_df"],
        "edges_df_test": test["edges_df"],
        "explore_stats": explore_stats,
        "task_type": "node_classification",
    }
