"""Tests for Excel template ingestion (V2 simplified schema — 2026-04-25).

Schema: one sheet per level (Node / Edge / Graph), no Type column in data sheets,
homogeneous only.  Parameter sheet still has a Type column but must declare a
single Type per Level.
"""
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
        "X_1": [0.1, 0.2, 0.3, 0.4, 0.5],
        "X_2": [1.0, 2.0, 3.0, 4.0, 5.0],
        "label": [0, 1, 0, 1, 0],
    })
    edges = pd.DataFrame({
        "Graph_ID": [1, 1],
        "Source_Node_ID": [0, 1],
        "Target_Node_ID": [1, 2],
        "E_1": [0.5, 0.7],
    })
    return _build_workbook({
        "Parameter": parameter,
        "Node": nodes,
        "Edge": edges,
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
        "X_1": [0.1, 0.2, 0.3, 0.4],
    })
    graph = pd.DataFrame({
        "Graph_ID": [1, 2],
        "X_30": [0.5, 0.7],
        "graph_score": [3.14, 2.71],  # continuous → regression
    })
    return _build_workbook({
        "Parameter": parameter,
        "Node": nodes,
        "Graph": graph,
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
    assert result["is_heterogeneous"] is False


def test_parse_excel_graph_regression():
    result = parse_excel_file(_graph_y_regression_workbook(), "g")
    assert result["task_type"] == "graph_regression"
    assert result["label_column"] == "graph_score"
    assert result["label_weight"] == 1.0  # default when Weight blank
    assert result["graph_df"] is not None
    assert result["is_heterogeneous"] is False


def test_parse_excel_missing_parameter_sheet():
    bad = _build_workbook({"Node": pd.DataFrame({"Node": [0]})})
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
        "Parameter": parameter, "Node": nodes, "Edge": edges,
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
        "Node": nodes,
        "Graph": graph,
    })
    with pytest.raises(ValueError, match="Multi-task"):
        parse_excel_file(wb)


def test_parse_excel_no_y_raises():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
    ])
    nodes = pd.DataFrame({"Node": [0], "X_1": [0.1]})
    wb = _build_workbook({"Parameter": parameter, "Node": nodes})
    with pytest.raises(ValueError, match="at least one Y row"):
        parse_excel_file(wb)


def test_parse_excel_missing_node_sheet():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label"},
    ])
    wb = _build_workbook({"Parameter": parameter})
    with pytest.raises(ValueError, match="'Node' sheet"):
        parse_excel_file(wb)


def test_parse_excel_label_column_missing_in_data():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label"},
    ])
    # Data sheet exists but lacks declared label column
    nodes = pd.DataFrame({"Node": [0], "X_1": [0.1]})
    wb = _build_workbook({"Parameter": parameter, "Node": nodes})
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
    wb = _build_workbook({"Parameter": parameter, "Node": nodes})
    result = parse_excel_file(wb)
    assert result["task_type"] == "node_regression"


# ── New tests for simplified V2 schema (2026-04-25) ───────────────


def test_single_sheet_homogeneous():
    """Node/Edge/Graph sheets without Type column, single-type Parameter → success."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "feat_a"},
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "feat_b"},
        {"XY": "X", "Level": "Edge", "Type": "default", "Parameter": "weight"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "score"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 1],
        "Node": [0, 1, 2],
        "feat_a": [0.1, 0.2, 0.3],
        "feat_b": [1.0, 2.0, 3.0],
    })
    edges = pd.DataFrame({
        "Graph_ID": [1, 1],
        "Source_Node_ID": [0, 1],
        "Target_Node_ID": [1, 2],
        "weight": [0.5, 0.8],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "score": [42.7]})
    wb = _build_workbook({
        "Parameter": parameter,
        "Node": nodes,
        "Edge": edges,
        "Graph": graph,
    })
    result = parse_excel_file(wb, "test-homo")
    assert result["task_type"] == "graph_regression"
    assert result["label_column"] == "score"
    assert result["is_heterogeneous"] is False
    assert len(result["nodes_df"]) == 3
    assert len(result["edges_df"]) == 2
    assert list(result["node_dfs"].keys()) == ["default"]
    assert list(result["edge_dfs"].keys()) == ["default"]
    assert result["canonical_edges"] == [("default", "default", "default")]
    assert result["node_dfs"]["default"]["_node_type"].unique().tolist() == ["default"]
    assert result["edge_dfs"]["default"]["_edge_type"].unique().tolist() == ["default"]


def test_multi_type_parameter_raises():
    """Parameter sheet with 2 Type values for Level=Node → ValueError with 'Heterogeneous'."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "x"},
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "y"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "z"},
    ])
    nodes = pd.DataFrame({"Node": [0, 1], "x": [0.1, 0.2]})
    graph = pd.DataFrame({"Graph_ID": [1], "z": [0.5]})
    wb = _build_workbook({
        "Parameter": parameter, "Node": nodes, "Graph": graph,
    })
    with pytest.raises(ValueError, match="Heterogeneous"):
        parse_excel_file(wb)
