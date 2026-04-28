"""Tests for Excel template ingestion (V3 schema — 2026-04-26).

Schema: one sheet per level (Node / Edge / Graph).
Data sheets MAY have a Type column:
    - Absent or single-valued → homogeneous (single key "default").
    - Multi-valued → heterogeneous; rows split into per-type DataFrames.
Parameter sheet may declare multiple Type values per Level for hetero graphs.
"""
from __future__ import annotations

import io

import pandas as pd
import pytest

from app.data.excel_ingestion import parse_excel_file
from app.data.excel_spec import parse_parameter_sheet, validate_hetero_consistency


def _build_workbook(sheets: dict[str, pd.DataFrame]) -> bytes:
    """Materialise a dict of DataFrames as .xlsx bytes."""
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for name, df in sheets.items():
            df.to_excel(writer, sheet_name=name, index=False)
    buf.seek(0)
    return buf.read()


def _node_y_classification_workbook() -> bytes:
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
    return _build_workbook({"Node": nodes, "Edge": edges})


def _graph_y_regression_workbook() -> bytes:
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
    return _build_workbook({"Node": nodes, "Graph": graph})


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
    assert result["label_weight"] == 1.0
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
    assert result["label_weight"] == 1.0
    assert result["graph_df"] is not None
    assert result["is_heterogeneous"] is False


def test_parse_excel_parameter_sheet_is_ignored():
    """A Parameter sheet, if present, is silently ignored."""
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "ignored"},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "ignored_label"},
    ])
    nodes = pd.DataFrame({
        "Node": [0, 1, 2],
        "X_1": [0.1, 0.2, 0.3],
        "label": [0, 1, 0],
    })
    wb = _build_workbook({"Parameter": parameter, "Node": nodes})
    result = parse_excel_file(wb)
    assert result["task_type"] == "node_classification"
    assert result["label_column"] == "label"


def test_parse_excel_no_label_raises():
    """When neither Graph nor Node sheet exposes a label column, raise."""
    nodes = pd.DataFrame({"Node": [0], "X_1": [0.1]})
    wb = _build_workbook({"Node": nodes})
    with pytest.raises(ValueError, match="Could not infer a label column"):
        parse_excel_file(wb)


def test_parse_excel_missing_node_sheet():
    wb = _build_workbook({
        "Graph": pd.DataFrame({"Graph_ID": [1], "y": [0.5]}),
    })
    with pytest.raises(ValueError, match="'Node' sheet"):
        parse_excel_file(wb)


def test_parse_excel_continuous_node_y_is_regression():
    nodes = pd.DataFrame({
        "Node": [0, 1, 2, 3],
        "X_1": [0.1, 0.2, 0.3, 0.4],
        "score": [0.15, 0.42, -0.33, 1.7],  # non-integer → regression
    })
    wb = _build_workbook({"Node": nodes})
    result = parse_excel_file(wb)
    assert result["task_type"] == "node_regression"


# ── New tests for simplified V2 schema (2026-04-25) ───────────────


def test_single_sheet_homogeneous():
    """Node/Edge/Graph sheets without Type column → success, label inferred from Graph."""
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
    wb = _build_workbook({"Node": nodes, "Edge": edges, "Graph": graph})
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


def test_in_sheet_type_column_splits_into_node_dfs():
    """Node sheet with 2 distinct Type values → node_dfs has 2 keys, is_heterogeneous=True."""
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 1],
        "Node": [0, 1, 2],
        "Type": ["cell", "cell", "pin"],
        "feat_x": [0.1, 0.2, 0.0],
        "feat_w": [0.0, 0.0, 0.5],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "target_z": [0.5]})
    wb = _build_workbook({"Node": nodes, "Graph": graph})
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is True
    assert set(result["node_dfs"].keys()) == {"cell", "pin"}
    assert len(result["node_dfs"]["cell"]) == 2
    assert len(result["node_dfs"]["pin"]) == 1
    assert result["node_dfs"]["cell"]["_node_type"].unique().tolist() == ["cell"]
    assert result["node_dfs"]["pin"]["_node_type"].unique().tolist() == ["pin"]
    assert len(result["nodes_df"]) == 3
    assert result["label_column"] == "target_z"


def test_homogeneous_still_works_without_type_column():
    """Node/Edge sheets without Type column → single 'default' key, is_heterogeneous=False."""
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 1],
        "Node": [0, 1, 2],
        "feat_a": [0.1, 0.2, 0.3],
    })
    edges = pd.DataFrame({
        "Graph_ID": [1, 1],
        "Source_Node_ID": [0, 1],
        "Target_Node_ID": [1, 2],
        "weight": [0.5, 0.8],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "score": [42.7]})
    wb = _build_workbook({"Node": nodes, "Edge": edges, "Graph": graph})
    result = parse_excel_file(wb, "homo-no-type")
    assert result["is_heterogeneous"] is False
    assert list(result["node_dfs"].keys()) == ["default"]
    assert list(result["edge_dfs"].keys()) == ["default"]
    assert result["node_dfs"]["default"]["_node_type"].unique().tolist() == ["default"]
    assert result["edge_dfs"]["default"]["_edge_type"].unique().tolist() == ["default"]


def test_shared_feature_across_types():
    """A shared column like 'area' lives in the unified Node sheet, so after
    Type-splitting it appears in BOTH per-type sub-frames with each type's
    respective values (NaN for rows where the type doesn't use the column).
    """
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 1, 1],
        "Node": [0, 1, 2, 3],
        "Type": ["cell", "cell", "pin", "pin"],
        "area": [1.0, 2.0, 3.0, 4.0],
        "cell_only": [10.0, 20.0, None, None],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "score": [42.5]})
    wb = _build_workbook({"Node": nodes, "Graph": graph})
    result = parse_excel_file(wb, "shared")
    assert result["is_heterogeneous"] is True
    assert set(result["node_dfs"].keys()) == {"cell", "pin"}
    assert "area" in result["node_dfs"]["cell"].columns
    assert "area" in result["node_dfs"]["pin"].columns
    assert "cell_only" in result["node_dfs"]["cell"].columns
    assert list(result["node_dfs"]["cell"]["area"]) == [1.0, 2.0]
    assert list(result["node_dfs"]["pin"]["area"]) == [3.0, 4.0]
    assert list(result["node_dfs"]["cell"]["cell_only"]) == [10.0, 20.0]
    assert result["node_dfs"]["pin"]["cell_only"].isna().all()

    # Inferred spec: area appears for BOTH cell and pin (non-NaN in each);
    # cell_only is only registered for cell (all-NaN in pin sub-frame).
    spec = result["spec"]
    assert "area" in spec.x_columns("Node", "cell")
    assert "area" in spec.x_columns("Node", "pin")
    assert "cell_only" in spec.x_columns("Node", "cell")
    assert "cell_only" not in spec.x_columns("Node", "pin")


def test_canonical_edges_only_from_observed_triples():
    """canonical_edges should reflect only (src_type, rel, dst_type) actually
    present in edge data, not Cartesian product over node/edge types."""
    nodes = pd.DataFrame({
        "Graph_ID": [1] * 6,
        "Node":     [0, 1, 2, 3, 4, 5],
        "Type":     ["cell", "cell", "pin", "pin", "net", "net"],
        "f1": [1.0, 2.0, None, None, None, None],
        "f2": [None, None, 3.0, 4.0, None, None],
        "f3": [None, None, None, None, 5.0, 6.0],
    })
    edges = pd.DataFrame({
        "Graph_ID":      [1, 1, 1, 1],
        "Source_Node_ID":[0, 1, 2, 3],
        "Target_Node_ID":[2, 3, 4, 5],
        "Type":          ["cell_pin", "cell_pin", "pin_net", "pin_net"],
        "ew": [0.1, 0.2, None, None],
        "wl": [None, None, 10.0, 20.0],
    })
    graph = pd.DataFrame({"Graph_ID": [1], "y": [42.0]})
    wb = _build_workbook({"Node": nodes, "Edge": edges, "Graph": graph})
    result = parse_excel_file(wb)
    assert result["is_heterogeneous"] is True
    triples = set(map(tuple, result["canonical_edges"]))
    assert triples == {("cell", "cell_pin", "pin"), ("pin", "pin_net", "net")}, \
        f"Expected only observed triples, got {triples}"


# ── Step 1 new tests (sheet optionality + type fallback + warnings) ───────────


def test_type_empty_fallback_default():
    """Parameter sheet row with empty Type → type_ becomes 'default', no raise."""
    df = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": None, "Parameter": "X_1"},
        {"XY": "Y", "Level": "Node", "Type": None, "Parameter": "label"},
    ])
    spec = parse_parameter_sheet(df)
    assert all(e.type_ == "default" for e in spec.entries)
    assert len(spec.entries) == 2


def test_validate_consistency_returns_warnings_not_raises():
    """Declared type not in data sheet → returns list with 1 warning, does not raise."""
    df = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "x"},
        {"XY": "X", "Level": "Node", "Type": "ghost", "Parameter": "y"},
        {"XY": "Y", "Level": "Graph", "Type": "default", "Parameter": "z"},
    ])
    spec = parse_parameter_sheet(df)
    # Only "cell" is observed in data sheet; "ghost" is declared but absent
    warnings = validate_hetero_consistency(spec, {"Node": ["cell"]})
    assert isinstance(warnings, list)
    assert len(warnings) == 1
    assert "ghost" in warnings[0]


def test_typo_fuzzy_match_within_distance():
    """Declared 'CAPP', observed 'CAP' → warning contains 'may be a typo for'."""
    df = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "CAPP", "Parameter": "f"},
        {"XY": "Y", "Level": "Node", "Type": "CAPP", "Parameter": "label"},
    ])
    spec = parse_parameter_sheet(df)
    warnings = validate_hetero_consistency(spec, {"Node": ["CAP"]})
    assert any("may be a typo for" in w for w in warnings), \
        f"Expected typo hint in warnings, got: {warnings}"


def test_no_edge_sheet_passes():
    """Workbook with only Node sheet (no Edge) → parse succeeds."""
    nodes = pd.DataFrame({
        "Node": [0, 1, 2],
        "X_1": [0.1, 0.2, 0.3],
        "label": [0, 1, 0],
    })
    wb = _build_workbook({"Node": nodes})
    result = parse_excel_file(wb)
    assert result["task_type"] == "node_classification"
    assert result["edge_dfs"] == {}


def test_no_graph_sheet_node_task():
    """No Graph sheet → label inferred from Node sheet, graph_df is None."""
    nodes = pd.DataFrame({
        "Graph_ID": [1, 1, 2, 2],
        "Node": [0, 1, 0, 1],
        "X_1": [0.1, 0.2, 0.3, 0.4],
        "label": [0, 1, 1, 0],
    })
    wb = _build_workbook({"Node": nodes})
    result = parse_excel_file(wb)
    assert result["task_type"] == "node_classification"
    assert result["graph_df"] is None
    assert result["schema_warnings"] == []
