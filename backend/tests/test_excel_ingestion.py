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


def test_parse_parameter_sheet_y_blank_weight_defaults_to_one():
    """Blank Weight cell for a Y row → ParameterEntry.weight == 1.0 (not None)."""
    df = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1", "Weight": None},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label", "Weight": None},
    ])
    spec = parse_parameter_sheet(df)
    y_entry = next(e for e in spec.entries if e.xy == "Y")
    assert y_entry.weight == 1.0, f"Y weight default must be 1.0, got {y_entry.weight!r}"


def test_parse_parameter_sheet_y_no_weight_column_defaults_to_one():
    """Parameter sheet without a Weight column → Y rows still get weight 1.0."""
    df = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label"},
    ])
    spec = parse_parameter_sheet(df)
    y_entry = next(e for e in spec.entries if e.xy == "Y")
    assert y_entry.weight == 1.0


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
    with pytest.raises(ValueError, match="Multi-Y across different Levels"):
        parse_excel_file(wb)


# ── Multi-Y on a single Level (new in 2026-05-12) ──────────────────────

def test_parse_excel_multi_y_graph_regression():
    """Two continuous Y columns on Graph level → multi-Y regression."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1", "Weight": None},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "y1", "Weight": 2.0},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "y2", "Weight": 0.5},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 2, 2],
        "Node": [0, 1, 0, 1],
        "Type": ["default"] * 4,
        "X_1": [0.1, 0.2, 0.3, 0.4],
    })
    graph = pd.DataFrame({
        "Graph_ID": [1, 2],
        "Type": ["default", "default"],
        "y1": [3.14, 2.71],
        "y2": [1.41, 1.62],
    })
    wb = _build_workbook({
        "Parameter": parameter, "Node_default": nodes, "Graph_default": graph,
    })
    result = parse_excel_file(wb)
    assert result["task_type"] == "graph_regression"
    assert result["label_columns"] == ["y1", "y2"]
    assert result["label_weights"] == [2.0, 0.5]
    # Backwards-compat: singular fields still emitted.
    assert result["label_column"] == "y1"
    assert result["label_weight"] == 2.0


def test_parse_excel_multi_y_node_regression():
    """Two continuous Y columns on Node level → multi-Y node regression."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1", "Weight": None},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "delay", "Weight": 1.0},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "slack", "Weight": 3.0},
    ])
    nodes = pd.DataFrame({
        "Node": [0, 1, 2, 3],
        "Type": ["default"] * 4,
        "X_1": [0.1, 0.2, 0.3, 0.4],
        "delay": [0.15, 0.42, -0.33, 1.7],
        "slack": [-0.05, 0.12, 0.88, -0.4],
    })
    wb = _build_workbook({"Parameter": parameter, "Node_default": nodes})
    result = parse_excel_file(wb)
    assert result["task_type"] == "node_regression"
    assert result["label_columns"] == ["delay", "slack"]
    assert result["label_weights"] == [1.0, 3.0]


def test_parse_excel_multi_y_mixed_kinds_rejected():
    """Mixing regression + classification Y on the same Level is rejected."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "score"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "cls"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 2], "Node": [0, 0],
        "Type": ["default", "default"], "X_1": [0.1, 0.2],
    })
    graph = pd.DataFrame({
        "Graph_ID": [1, 2], "Type": ["default", "default"],
        "score": [3.14, 2.71],   # continuous
        "cls": [0, 1],            # integer few-uniques → classification
    })
    wb = _build_workbook({
        "Parameter": parameter, "Node_default": nodes, "Graph_default": graph,
    })
    with pytest.raises(ValueError, match="same kind"):
        parse_excel_file(wb)


def test_parse_excel_multi_y_classification_rejected():
    """Multi-Y classification is deferred to v2; raises with a clear message."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "cls_a"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "cls_b"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 2], "Node": [0, 0],
        "Type": ["default", "default"], "X_1": [0.1, 0.2],
    })
    graph = pd.DataFrame({
        "Graph_ID": [1, 2], "Type": ["default", "default"],
        "cls_a": [0, 1], "cls_b": [1, 0],
    })
    wb = _build_workbook({
        "Parameter": parameter, "Node_default": nodes, "Graph_default": graph,
    })
    with pytest.raises(ValueError, match="Multi-Y classification"):
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


# ── Unified single-sheet layout (new in 2026-04-24) ────────────────────

def test_parse_excel_hetero_unified_single_sheet():
    """A single `Node` / `Edge` sheet with a Type column should split correctly."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "cell_area"},
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "pin_cap"},
        {"XY": "X", "Level": "Edge", "Type": "cell2pin", "Parameter": "c2p_delay"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "score"},
    ])
    # Unified node sheet: cell rows leave pin_cap blank, pin rows leave cell_area blank.
    nodes = pd.DataFrame([
        {"Graph_ID": 1, "Node": 0, "Type": "cell", "cell_area": 1.2, "pin_cap": None},
        {"Graph_ID": 1, "Node": 1, "Type": "cell", "cell_area": 2.3, "pin_cap": None},
        {"Graph_ID": 1, "Node": 2, "Type": "pin", "cell_area": None, "pin_cap": 0.4},
        {"Graph_ID": 1, "Node": 3, "Type": "pin", "cell_area": None, "pin_cap": 0.5},
    ])
    edges = pd.DataFrame([
        {"Graph_ID": 1, "Source_Node_ID": 0, "Target_Node_ID": 2,
         "Source_Node_Type": "cell", "Target_Node_Type": "pin",
         "Type": "cell2pin", "c2p_delay": 5.0},
    ])
    graph = pd.DataFrame({"Graph_ID": [1], "Type": ["default"], "score": [1.5]})
    wb = _build_workbook({
        "Parameter": parameter,
        "Node": nodes,
        "Edge": edges,
        "Graph": graph,
    })
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is True
    assert set(result["node_dfs"].keys()) == {"cell", "pin"}
    # Per-type frames should NOT carry the other type's feature columns.
    assert "pin_cap" not in result["node_dfs"]["cell"].columns
    assert "cell_area" not in result["node_dfs"]["pin"].columns
    # Edge frame should carry its own feature.
    assert "c2p_delay" in result["edge_dfs"]["cell2pin"].columns
    assert result["canonical_edges"] == [("cell", "cell2pin", "pin")]


def test_parse_excel_graph_sheet_without_type_column():
    """Graph sheet without Type column → single declared Graph Type used."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "score"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 2, 2], "Node": [0, 1, 0, 1],
        "X_1": [0.1, 0.2, 0.3, 0.4],
    })
    # NOTE: Graph sheet intentionally has no Type column.
    graph = pd.DataFrame({"Graph_ID": [1, 2], "score": [3.14, 2.71]})
    wb = _build_workbook({"Parameter": parameter, "Node": nodes, "Graph": graph})
    result = parse_excel_file(wb)
    assert result["task_type"] == "graph_regression"
    assert result["graph_df"] is not None
    assert len(result["graph_df"]) == 2
    assert "score" in result["graph_df"].columns


def test_parse_excel_edge_sheet_without_type_column_single_type():
    """Edge sheet without Type column + single declared Edge Type → ok."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "X", "Level": "Edge", "Type": "default", "Parameter": "w"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "y"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1], "Node": [0, 1], "X_1": [0.1, 0.2],
    })
    # Edge sheet without Type column.
    edges = pd.DataFrame({
        "Graph_ID": [1], "Source_Node_ID": [0], "Target_Node_ID": [1], "w": [0.5],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "y": [0.9]})
    wb = _build_workbook({
        "Parameter": parameter, "Node": nodes, "Edge": edges, "Graph": graph,
    })
    result = parse_excel_file(wb)
    assert "default" in result["edge_dfs"]
    assert len(result["edge_dfs"]["default"]) == 1


def test_parse_excel_edge_sheet_missing_type_column_multi_type_raises():
    """Edge sheet without Type column + multiple declared Edge Types → error."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "X", "Level": "Edge", "Type": "rel_a", "Parameter": "wa"},
        {"XY": "X", "Level": "Edge", "Type": "rel_b", "Parameter": "wb"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "y"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1], "Node": [0, 1], "X_1": [0.1, 0.2],
    })
    # Edge sheet with no Type column but Parameter declares two edge Types.
    edges = pd.DataFrame({
        "Graph_ID": [1], "Source_Node_ID": [0], "Target_Node_ID": [1],
        "wa": [0.5], "wb": [0.3],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "y": [0.9]})
    wb = _build_workbook({
        "Parameter": parameter, "Node": nodes, "Edge": edges, "Graph": graph,
    })
    with pytest.raises(ValueError, match="missing a 'Type' column"):
        parse_excel_file(wb)


def test_parse_excel_multi_y_graph_without_type_column():
    """Multi-Y graph regression with Graph sheet missing Type column."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "y1", "Weight": 2.0},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "y2"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 2, 2], "Node": [0, 1, 0, 1],
        "X_1": [0.1, 0.2, 0.3, 0.4],
    })
    graph = pd.DataFrame({
        "Graph_ID": [1, 2], "y1": [3.14, 2.71], "y2": [1.41, 1.62],
    })
    wb = _build_workbook({"Parameter": parameter, "Node": nodes, "Graph": graph})
    result = parse_excel_file(wb)
    assert result["task_type"] == "graph_regression"
    assert result["label_columns"] == ["y1", "y2"]
    # First Y had explicit weight, second was blank → 1.0 default.
    assert result["label_weights"] == [2.0, 1.0]


def test_parse_excel_unified_node_without_type_column_single_type_homogeneous():
    """Single declared Node Type + Node sheet without Type column → homogeneous."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label"},
    ])
    nodes = pd.DataFrame({
        "Node": [0, 1, 2, 3],
        "X_1": [0.1, 0.2, 0.3, 0.4],
        "label": [0.5, 0.6, 0.7, 0.8],
    })
    wb = _build_workbook({"Parameter": parameter, "Node": nodes})
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is False
    assert set(result["node_dfs"].keys()) == {"default"}
    assert len(result["node_dfs"]["default"]) == 4


def test_parse_excel_node_type_column_presence_marks_heterogeneous():
    """Parameter declares multiple Node Types + Node has Type column → heterogeneous."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "ca"},
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "pc"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "y"},
    ])
    nodes = pd.DataFrame([
        {"Graph_ID": 1, "Node": 0, "Type": "cell", "ca": 1.0, "pc": None},
        {"Graph_ID": 1, "Node": 1, "Type": "pin", "ca": None, "pc": 0.1},
    ])
    graph = pd.DataFrame({"Graph_ID": [1], "y": [3.14]})
    wb = _build_workbook({"Parameter": parameter, "Node": nodes, "Graph": graph})
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is True
    assert set(result["node_dfs"].keys()) == {"cell", "pin"}


def test_parse_excel_unified_node_missing_type_column_raises():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "x"},
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "y"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "z"},
    ])
    nodes = pd.DataFrame({"Graph_ID": [1, 1], "Node": [0, 1], "x": [0.1, None]})
    graph = pd.DataFrame({"Graph_ID": [1], "z": [0.5]})
    wb = _build_workbook({
        "Parameter": parameter, "Node": nodes, "Graph": graph,
    })
    with pytest.raises(ValueError, match="missing a 'Type' column"):
        parse_excel_file(wb)


def test_parse_excel_unified_type_with_no_rows_raises():
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "x"},
        {"XY": "X", "Level": "Node", "Type": "pin", "Parameter": "y"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "z"},
    ])
    # Only cell rows present — pin rows missing.
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1], "Node": [0, 1], "Type": ["cell", "cell"],
        "x": [0.1, 0.2], "y": [None, None],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "z": [0.5]})
    wb = _build_workbook({
        "Parameter": parameter, "Node": nodes, "Graph": graph,
    })
    with pytest.raises(ValueError, match="Type='pin'"):
        parse_excel_file(wb)


# ── Parameter sheet WITHOUT Type column (Types inferred from data) ────────

def test_parse_parameter_sheet_without_type_column():
    """Parameter sheet may omit the Type column entirely; entries carry no
    Type and the spec exposes empty Type lists until ingestion resolves them
    from the data sheets."""
    df = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Parameter": "label", "Weight": 2.0},
    ])
    spec = parse_parameter_sheet(df)
    assert spec.types_declared_in_parameter_sheet is False
    assert spec.types_for_level("Node") == []
    assert all(e.type_ is None for e in spec.entries)


def test_parse_excel_no_type_in_parameter_homo():
    """Homogeneous graph: Parameter sheet omits Type, Node sheet has Type
    column with a single value. Types should be auto-discovered."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Parameter": "X_1"},
        {"XY": "X", "Level": "Node", "Parameter": "X_2"},
        {"XY": "Y", "Level": "Node", "Parameter": "label", "Weight": 1.0},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1] * 4,
        "Node": [0, 1, 2, 3],
        "Type": ["default"] * 4,
        "X_1": [0.1, 0.2, 0.3, 0.4],
        "X_2": [1.0, 2.0, 3.0, 4.0],
        "label": [0.5, 0.7, 0.9, 1.1],
    })
    wb = _build_workbook({"Parameter": parameter, "Node": nodes})
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is False
    assert set(result["node_dfs"].keys()) == {"default"}
    assert result["task_type"] == "node_regression"
    assert result["label_column"] == "label"


def test_parse_excel_no_type_in_parameter_no_type_in_data():
    """Parameter has no Type column AND data sheets have no Type column →
    a synthetic single 'default' type is used."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Graph", "Parameter": "score"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 2, 2], "Node": [0, 1, 0, 1],
        "X_1": [0.1, 0.2, 0.3, 0.4],
    })
    graph = pd.DataFrame({"Graph_ID": [1, 2], "score": [3.14, 2.71]})
    wb = _build_workbook({"Parameter": parameter, "Node": nodes, "Graph": graph})
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is False
    assert set(result["node_dfs"].keys()) == {"default"}
    assert result["task_type"] == "graph_regression"


def test_parse_excel_no_type_in_parameter_hetero_inferred():
    """Hetero: Parameter has no Type, Node sheet declares multiple Types.
    Each X parameter is auto-assigned to the Type whose slice has data."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Parameter": "cell_area"},
        {"XY": "X", "Level": "Node", "Parameter": "pin_cap"},
        {"XY": "X", "Level": "Edge", "Parameter": "c2p_delay"},
        {"XY": "Y", "Level": "Graph", "Parameter": "score"},
    ])
    nodes = pd.DataFrame([
        {"Graph_ID": 1, "Node": 0, "Type": "cell", "cell_area": 1.2, "pin_cap": None},
        {"Graph_ID": 1, "Node": 1, "Type": "cell", "cell_area": 2.3, "pin_cap": None},
        {"Graph_ID": 1, "Node": 2, "Type": "pin", "cell_area": None, "pin_cap": 0.4},
        {"Graph_ID": 1, "Node": 3, "Type": "pin", "cell_area": None, "pin_cap": 0.5},
    ])
    edges = pd.DataFrame([
        {"Graph_ID": 1, "Source_Node_ID": 0, "Target_Node_ID": 2,
         "Source_Node_Type": "cell", "Target_Node_Type": "pin",
         "Type": "cell2pin", "c2p_delay": 5.0},
    ])
    graph = pd.DataFrame({"Graph_ID": [1], "score": [1.5]})
    wb = _build_workbook({
        "Parameter": parameter, "Node": nodes, "Edge": edges, "Graph": graph,
    })
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is True
    assert set(result["node_dfs"].keys()) == {"cell", "pin"}
    assert "pin_cap" not in result["node_dfs"]["cell"].columns
    assert "cell_area" not in result["node_dfs"]["pin"].columns
    assert result["canonical_edges"] == [("cell", "cell2pin", "pin")]
    assert result["label_column"] == "score"


def test_parse_excel_no_type_in_parameter_declared_but_no_data():
    """Parameter without Type column declares a column that exists in no
    Type's slice → clear error."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Parameter": "ghost"},
        {"XY": "Y", "Level": "Graph", "Parameter": "score"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1], "Node": [0, 1], "Type": ["default", "default"],
        # No 'ghost' column anywhere.
        "X_1": [0.1, 0.2],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "score": [1.0]})
    wb = _build_workbook({"Parameter": parameter, "Node": nodes, "Graph": graph})
    with pytest.raises(ValueError, match="no Type slice"):
        parse_excel_file(wb)


# ── Edge connectivity is always loaded (no Parameter Edge row required) ──

def test_parse_excel_edge_loaded_without_parameter_entry():
    """Parameter sheet has no Edge row, but the Edge sheet exists →
    edges are still loaded for graph connectivity."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Graph", "Parameter": "score"},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 1, 1],
        "Node": [0, 1, 2, 3],
        "X_1": [0.1, 0.2, 0.3, 0.4],
    })
    edges = pd.DataFrame({
        "Graph_ID": [1, 1, 1],
        "Source_Node_ID": [0, 1, 2],
        "Target_Node_ID": [1, 2, 3],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "score": [1.0]})
    wb = _build_workbook({
        "Parameter": parameter, "Node": nodes, "Edge": edges, "Graph": graph,
    })
    result = parse_excel_file(wb)
    # Edge dataframe must be populated even though Parameter sheet declares
    # nothing about edges.
    assert "default" in result["edge_dfs"]
    assert len(result["edge_dfs"]["default"]) == 3
    # Unified edges_df should also reflect the same connectivity.
    assert len(result["edges_df"]) == 3
    assert result["canonical_edges"] == [("default", "default", "default")]


def test_parse_excel_edge_loaded_without_parameter_entry_hetero():
    """Hetero: Parameter sheet has no Edge row, but Edge sheet's Type column
    declares multiple relations → each relation produces a canonical edge."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Parameter": "cell_area"},
        {"XY": "X", "Level": "Node", "Parameter": "pin_cap"},
        {"XY": "Y", "Level": "Graph", "Parameter": "score"},
    ])
    nodes = pd.DataFrame([
        {"Graph_ID": 1, "Node": 0, "Type": "cell", "cell_area": 1.0, "pin_cap": None},
        {"Graph_ID": 1, "Node": 1, "Type": "cell", "cell_area": 2.0, "pin_cap": None},
        {"Graph_ID": 1, "Node": 2, "Type": "pin", "cell_area": None, "pin_cap": 0.1},
        {"Graph_ID": 1, "Node": 3, "Type": "pin", "cell_area": None, "pin_cap": 0.2},
    ])
    edges = pd.DataFrame([
        {"Graph_ID": 1, "Source_Node_ID": 0, "Target_Node_ID": 2,
         "Source_Node_Type": "cell", "Target_Node_Type": "pin", "Type": "cell2pin"},
        {"Graph_ID": 1, "Source_Node_ID": 2, "Target_Node_ID": 3,
         "Source_Node_Type": "pin", "Target_Node_Type": "pin", "Type": "pin2pin"},
    ])
    graph = pd.DataFrame({"Graph_ID": [1], "score": [1.5]})
    wb = _build_workbook({
        "Parameter": parameter, "Node": nodes, "Edge": edges, "Graph": graph,
    })
    result = parse_excel_file(wb)
    assert set(result["edge_dfs"].keys()) == {"cell2pin", "pin2pin"}
    assert {tuple(c) for c in result["canonical_edges"]} == {
        ("cell", "cell2pin", "pin"),
        ("pin", "pin2pin", "pin"),
    }


def test_parse_excel_no_edge_sheet_is_ok():
    """Sanity: a graph with zero edges still parses (node-only graph)."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Parameter": "label"},
    ])
    nodes = pd.DataFrame({
        "Node": [0, 1, 2, 3],
        "X_1": [0.1, 0.2, 0.3, 0.4],
        "label": [0.0, 1.0, 0.0, 1.0],
    })
    wb = _build_workbook({"Parameter": parameter, "Node": nodes})
    result = parse_excel_file(wb)
    assert result["edge_dfs"] == {}
    assert len(result["edges_df"]) == 0
