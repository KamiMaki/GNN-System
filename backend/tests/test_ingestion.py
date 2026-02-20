import pytest
from pathlib import Path

from app.data.ingestion import parse_csv_pair


MOCK_DIR = Path(__file__).resolve().parent.parent / "mock_data"


def test_parse_valid_csvs():
    result = parse_csv_pair(
        nodes_csv=MOCK_DIR / "nodes_train.csv",
        edges_csv=MOCK_DIR / "edges_train.csv",
        dataset_name="test_dataset",
    )
    assert "nodes_df" in result
    assert "edges_df" in result
    assert result["name"] == "test_dataset"
    assert len(result["nodes_df"]) > 0
    assert len(result["edges_df"]) > 0
    # Check all required columns present
    assert "node_id" in result["nodes_df"].columns
    assert "is_critical" in result["nodes_df"].columns
    assert "src_id" in result["edges_df"].columns


def test_parse_missing_columns():
    """Test that missing columns raise ValueError."""
    import io
    nodes_csv = b"node_id,name\n0,test\n"
    edges_csv = b"src_id,dst_id\n0,1\n"
    with pytest.raises(ValueError, match="Missing node columns"):
        parse_csv_pair(nodes_csv, edges_csv, "bad_data")
