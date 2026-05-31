"""Tests for the TransformerConv model family (homogeneous + heterogeneous)."""
from __future__ import annotations

import pytest

torch = pytest.importorskip("torch")

from app.models.factory import get_model, HOMO_REGISTRY, HETERO_BACKBONES
from app.models.transformer import TransformerClassifier
from app.models.hetero_wrapper import HeteroGraphRegressor


# ── registry wiring ───────────────────────────────────────────────────

def test_transformer_registered_homo():
    assert HOMO_REGISTRY.get("transformer") is TransformerClassifier


def test_transformer_registered_hetero_backbone():
    assert "transformer" in HETERO_BACKBONES


def test_factory_returns_transformer_classifier():
    model = get_model(
        "transformer", num_features=4, num_classes=2,
        task_type="node_classification", hidden_dim=8, num_layers=2,
        num_heads=4, dropout=0.0, lr=1e-3,
    )
    assert isinstance(model, TransformerClassifier)


# ── homogeneous output shapes ─────────────────────────────────────────

def _toy_graph():
    x = torch.randn(5, 4)
    edge_index = torch.tensor([[0, 1, 2, 3], [1, 2, 3, 4]], dtype=torch.long)
    return x, edge_index


def test_transformer_node_single_target_shape():
    model = get_model(
        "transformer", num_features=4, num_classes=1,
        task_type="node_regression", hidden_dim=8, num_layers=2,
        num_heads=4, dropout=0.0, lr=1e-3, num_targets=1,
    )
    x, edge_index = _toy_graph()
    model.eval()
    with torch.no_grad():
        out = model(x, edge_index, None, batch=None)
    assert out.shape == (5,), f"single-Y node output must be (N,), got {tuple(out.shape)}"


def test_transformer_node_multi_target_shape():
    model = get_model(
        "transformer", num_features=4, num_classes=1,
        task_type="node_regression", hidden_dim=8, num_layers=2,
        num_heads=4, dropout=0.0, lr=1e-3, num_targets=3,
        loss_weights=torch.tensor([1.0, 2.0, 0.5]),
    )
    x, edge_index = _toy_graph()
    model.eval()
    with torch.no_grad():
        out = model(x, edge_index, None, batch=None)
    assert out.shape == (5, 3), f"multi-Y node output must be (N, T), got {tuple(out.shape)}"
    assert model.loss_weights.shape == (3,)


def test_transformer_graph_multi_target_shape():
    model = get_model(
        "transformer", num_features=4, num_classes=1,
        task_type="graph_regression", hidden_dim=8, num_layers=2,
        num_heads=4, dropout=0.0, lr=1e-3, num_targets=2,
    )
    x = torch.randn(6, 4)
    edge_index = torch.tensor([[0, 1, 3, 4], [1, 2, 4, 5]], dtype=torch.long)
    batch = torch.tensor([0, 0, 0, 1, 1, 1])
    model.eval()
    with torch.no_grad():
        out = model(x, edge_index, None, batch=batch)
    assert out.shape == (2, 2), f"multi-Y graph output must be (B, T), got {tuple(out.shape)}"


def test_transformer_classification_shape():
    model = get_model(
        "transformer", num_features=4, num_classes=3,
        task_type="node_classification", hidden_dim=8, num_layers=2,
        num_heads=4, dropout=0.0, lr=1e-3, num_targets=1,
    )
    x, edge_index = _toy_graph()
    model.eval()
    with torch.no_grad():
        out = model(x, edge_index, None, batch=None)
    assert out.shape == (5, 3)


# ── heterogeneous backbone ────────────────────────────────────────────

def test_transformer_hetero_backbone_forward():
    """get_model('transformer', metadata=...) lifts via to_hetero and runs."""
    HeteroData = pytest.importorskip("torch_geometric.data").HeteroData
    Batch = pytest.importorskip("torch_geometric.data").Batch

    metadata = (["a", "b"], [("a", "to", "b"), ("b", "to", "a")])
    model = get_model(
        "transformer", num_features=4, num_classes=1,
        task_type="graph_regression", metadata=metadata,
        hidden_dim=16, num_layers=2, dropout=0.0, lr=1e-3, num_targets=2,
    )
    assert isinstance(model, HeteroGraphRegressor)
    assert model.hparams.conv == "transformer"

    def _make():
        d = HeteroData()
        d["a"].x = torch.randn(3, 4)
        d["b"].x = torch.randn(2, 5)  # different feat dim — lazy init handles it
        d["a", "to", "b"].edge_index = torch.tensor([[0, 1, 2], [0, 1, 0]], dtype=torch.long)
        d["b", "to", "a"].edge_index = torch.tensor([[0, 1, 0], [0, 1, 2]], dtype=torch.long)
        d.y = torch.randn(1, 2)  # graph-level multi-Y target
        return d

    batch = Batch.from_data_list([_make(), _make()])
    x_dict = {nt: batch[nt].x for nt in batch.node_types}
    edge_index_dict = {et: batch[et].edge_index for et in batch.edge_types}
    batch_dict = {nt: batch[nt].batch for nt in batch.node_types}

    model.eval()
    with torch.no_grad():
        out = model(x_dict, edge_index_dict, batch_dict)
    assert out.shape == (2, 2), f"hetero graph multi-Y output must be (B, T), got {tuple(out.shape)}"
