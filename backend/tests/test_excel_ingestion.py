"""Tests for Excel template ingestion (Phase 1)."""
from __future__ import annotations

import io

import pandas as pd
import pytest

from app.data.excel_ingestion import parse_excel_file
from app.data.excel_spec import parse_parameter_sheet


def _build_workbook(sheets: dict[str, pd.DataFrame]) -> bytes:
    """Materialise a dict of DataFrames as .xlsx bytes."""
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for name, df in sheets.items():
            df.to_excel(writer, sheet_name=name, index=False)
    buf.seek(0)
    return buf.read()


def _node_y_classification_workbook() -> bytes:
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1", "Weight": None},
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_2", "Weight": None},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label", "Weight": 2.0},
        {"XY": "X", "Level": "Edge", "Type": "default", "Parameter": "E_1", "Weight": None},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1] * 5,
        "Node": [0, 1, 2, 3, 4],
        "Type": ["default"] * 5,
        "X_1": [0.1, 0.2, 0.3, 0.4, 0.5],
        "X_2": [1.0, 2.0, 3.0, 4.0, 5.0],
        "label": [0, 1, 0, 1, 0],
    })
    edges = pd.DataFrame({
        "Graph_ID": [1, 1],
        "Source_Node_ID": [0, 1],
        "Target_Node_ID": [1, 2],
        "Edge_Type": ["default"] * 2,
        "E_1": [0.5, 0.7],
    })
    return _build_workbook({
        "Parameter": parameter,
        "Node_default": nodes,
        "Edge_default": edges,
    })


def _graph_y_regression_workbook() -> bytes:
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1", "Weight": None},
        {"XY": "X", "Level": "Graph", "Type": "default", "Parameter": "X_30", "Weight": None},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "graph_score", "Weight": None},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 2, 2],
        "Node": [0, 1, 0, 1],
        "Type": ["default"] * 4,
        "X_1": [0.1, 0.2, 0.3, 0.4],
    })
    graph = pd.DataFrame({
        "Graph_ID": [1, 2],
        "X_30": [0.5, 0.7],
        "graph_score": [3.14, 2.71],  # continuous → regression
    })
    return _build_workbook({
        "Parameter": parameter,
        "Node_default": nodes,
        "Graph_default": graph,
    })


# ── parse_parameter_sheet ──────────────────────────────────────────


def test_parse_parameter_sheet_success():
    df = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1", "Weight": None},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label", "Weight": 2.5},
    ])
    spec = parse_parameter_sheet(df)
    assert len(spec.entries) == 2
    assert spec.y_levels() == ["Node"]
    assert spec.x_columns("Node", "default") == ["X_1"]
    assert spec.y_columns("Node", "default") == ["label"]
    payload = spec.to_payload()
    assert payload["entries"][1]["weight"] == 2.5


def test_parse_parameter_sheet_missing_columns():
    df = pd.DataFrame([{"XY": "X", "Level": "Node"}])
    with pytest.raises(ValueError, match="missing required columns"):
        parse_parameter_sheet(df)


def test_parse_parameter_sheet_invalid_xy():
    df = pd.DataFrame([
        {"XY": "Z", "Level": "Node", "Type": "default", "Parameter": "X_1"},
    ])
    with pytest.raises(ValueError, match="XY must be 'X' or 'Y'"):
        parse_parameter_sheet(df)


def test_parse_parameter_sheet_invalid_level():
    df = pd.DataFrame([
        {"XY": "X", "Level": "Hyperedge", "Type": "default", "Parameter": "X_1"},
    ])
    with pytest.raises(ValueError, match="Level must be"):
        parse_parameter_sheet(df)


def test_parse_parameter_sheet_blank_rows_skipped():
    df = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": None, "Level": None, "Type": None, "Parameter": None},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label"},
    ])
    spec = parse_parameter_sheet(df)
    assert len(spec.entries) == 2


def test_parse_parameter_sheet_weight_non_numeric():
    df = pd.DataFrame([
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label", "Weight": "high"},
    ])
    with pytest.raises(ValueError, match="Weight must be numeric"):
        parse_parameter_sheet(df)


# ── parse_excel_file ──────────────────────────────────────────────


def test_parse_excel_node_classification():
    result = parse_excel_file(_node_y_classification_workbook(), "my-dataset")
    assert result["task_type"] == "node_classification"
    assert result["label_column"] == "label"
    assert result["label_weight"] == 2.0
    assert result["name"] == "my-dataset"
    assert "node_id" in result["nodes_df"].columns  # Node → node_id normalisation
    assert "src_id" in result["edges_df"].columns
    assert "dst_id" in result["edges_df"].columns
    assert len(result["nodes_df"]) == 5


def test_parse_excel_graph_regression():
    result = parse_excel_file(_graph_y_regression_workbook(), "g")
    assert result["task_type"] == "graph_regression"
    assert result["label_column"] == "graph_score"
    assert result["label_weight"] == 1.0  # default when Weight blank
    assert result["graph_df"] is not None


def test_parse_excel_missing_parameter_sheet():
    bad = _build_workbook({"Node_default": pd.DataFrame({"Node": [0]})})
    with pytest.raises(ValueError, match="missing the required 'Parameter' sheet"):
        parse_excel_file(bad)


def test_parse_excel_edge_y_deferred():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Edge", "Type": "default", "Parameter": "edge_label"},
    ])
    nodes = pd.DataFrame({"Node": [0, 1], "X_1": [0.1, 0.2]})
    edges = pd.DataFrame({
        "Source_Node_ID": [0], "Target_Node_ID": [1], "edge_label": [1],
    })
    wb = _build_workbook({
        "Parameter": parameter, "Node_default": nodes, "Edge_default": edges,
    })
    with pytest.raises(ValueError, match="Edge-level prediction"):
        parse_excel_file(wb)


def test_parse_excel_multi_y_levels_deferred():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "node_label"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "graph_label"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1],
        "Node": [0, 1],
        "X_1": [0.1, 0.2],
        "node_label": [0, 1],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "graph_label": [1]})
    wb = _build_workbook({
        "Parameter": parameter,
        "Node_default": nodes,
        "Graph_default": graph,
    })
    with pytest.raises(ValueError, match="Multi-task"):
        parse_excel_file(wb)


def test_parse_excel_heterogeneous_is_supported():
    """Phase 2: multiple Types per Level now accepted (heterogeneous graph)."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "X_1"},
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "X_2"},
        {"XY": "X", "Level": "Edge", "Type": "cell2pin", "Parameter": "w"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "score"},
    ])
    nodes_cell = pd.DataFrame({"Graph_ID": [1, 1], "Node": [0, 1], "X_1": [0.1, 0.2]})
    nodes_pin = pd.DataFrame({"Graph_ID": [1, 1], "Node": [2, 3], "X_2": [0.3, 0.4]})
    edges = pd.DataFrame({
        "Graph_ID": [1], "Source_Node_ID": [0], "Target_Node_ID": [2],
        "Source_Node_Type": ["cell"], "Target_Node_Type": ["pin"], "w": [0.5],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "score": [1.5]})
    wb = _build_workbook({
        "Parameter": parameter,
        "Node_cell": nodes_cell,
        "Node_pin": nodes_pin,
        "Edge_cell2pin": edges,
        "Graph_default": graph,
    })
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is True
    assert set(result["node_dfs"].keys()) == {"cell", "pin"}
    assert set(result["edge_dfs"].keys()) == {"cell2pin"}
    assert result["canonical_edges"] == [("cell", "cell2pin", "pin")]
    assert result["task_type"] == "graph_regression"
    assert result["label_column"] == "score"
    # Unified views still populated.
    assert len(result["nodes_df"]) == 4


def test_parse_excel_hetero_edge_defaults_to_single_node_type():
    """Homogeneous edges without explicit src/dst_type columns default to the node type."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "X", "Level": "Edge", "Type": "default", "Parameter": "w"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "y"},
    ])
    nodes = pd.DataFrame({"Graph_ID": [1, 1], "Node": [0, 1], "X_1": [0.1, 0.2]})
    edges = pd.DataFrame({
        "Graph_ID": [1], "Source_Node_ID": [0], "Target_Node_ID": [1], "w": [0.5],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "y": [0.9]})
    wb = _build_workbook({
        "Parameter": parameter, "Node_default": nodes,
        "Edge_default": edges, "Graph_default": graph,
    })
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is False
    assert result["canonical_edges"] == [("default", "default", "default")]


def test_parse_excel_no_y_raises():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
    ])
    nodes = pd.DataFrame({"Node": [0], "X_1": [0.1]})
    wb = _build_workbook({"Parameter": parameter, "Node_default": nodes})
    with pytest.raises(ValueError, match="at least one Y row"):
        parse_excel_file(wb)


def test_parse_excel_missing_data_sheet():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label"},
    ])
    # No Node_default sheet
    wb = _build_workbook({"Parameter": parameter})
    with pytest.raises(ValueError, match="Node_default"):
        parse_excel_file(wb)


def test_parse_excel_label_column_missing_in_data():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label"},
    ])
    # Data sheet exists but lacks declared label column
    nodes = pd.DataFrame({"Node": [0], "X_1": [0.1]})
    wb = _build_workbook({"Parameter": parameter, "Node_default": nodes})
    with pytest.raises(ValueError, match="Label column 'label'"):
        parse_excel_file(wb)


def test_parse_excel_continuous_node_y_is_regression():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "score"},
    ])
    nodes = pd.DataFrame({
        "Node": [0, 1, 2, 3],
        "X_1": [0.1, 0.2, 0.3, 0.4],
        "score": [0.15, 0.42, -0.33, 1.7],  # non-integer → regression
    })
    wb = _build_workbook({"Parameter": parameter, "Node_default": nodes})
    result = parse_excel_file(wb)
    assert result["task_type"] == "node_regression"
