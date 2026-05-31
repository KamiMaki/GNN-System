# Technical: TransformerConv model family

> Audience: backend/ML developers. Companion user guide:
> [`docs/usage/transformerconv-model.md`](../usage/transformerconv-model.md).

## What Changed

**Added** (new files)
- `backend/app/models/transformer.py` — `TransformerClassifier`, a homogeneous
  `LightningModule` built on `torch_geometric.nn.TransformerConv`.
- `backend/tests/test_transformer_model.py` — registry, output-shape, and
  hetero-lift tests for the new family.

**Modified**
- `backend/app/models/factory.py` — registered `"transformer"` in `HOMO_REGISTRY`
  and added it to `HETERO_BACKBONES`.
- `backend/app/models/hetero_wrapper.py` — added `"transformer": TransformerConv`
  to the `_HomoBackbone` conv map; docstring updated.
- `frontend/app/projects/[id]/train/page.tsx` — `'transformer'` added to
  `ALL_MODELS_HOMO` and `ALL_MODELS_HETERO`.
- `README.md` — supported-task-types table + repo layout updated.

## Why

The model pool offered convolution (GCN), attention (GAT), sampling/aggregation
(GraphSAGE), isomorphism (GIN), and a structure-free baseline (MLP). It lacked a
**graph-transformer** option. `TransformerConv` brings full multi-head
self-attention message passing (Shi et al., "Masked Label Prediction"), which
often improves long-range/relational modeling on the IC-layout graphs this
platform targets — and it costs the AutoML user nothing, since Optuna will simply
include it in the search.

`TransformerConv` was also chosen because it is **bipartite-safe**: unlike GCN
(single relation assumption) and GIN (inner-MLP collapse), it message-passes
correctly when source and destination node types differ, so it can serve as a
**heterogeneous backbone** too.

## How It Works

### Module relationships

```
                         get_model(name, ..., metadata?)        ← app/models/factory.py
                          │
        metadata is None ─┤─ metadata provided
                          │                     │
        HOMO_REGISTRY[name]                HETERO_BACKBONES check
                          │                     │
        TransformerClassifier            HeteroGraphRegressor (hetero_wrapper.py)
        (app/models/transformer.py)        └─ _HomoBackbone(conv="transformer")
                          │                       └─ to_hetero(TransformerConv stack)
        shared: loss.py (weighted MSE), _lr.py (ExponentialLR)
                          │
        optuna_search.run_hpo() auto-discovers "transformer" from the registry
```

### Homogeneous module (`transformer.py`)

Structurally identical to the GAT module so it slots into the shared training
loop without special-casing:

- Each layer is `TransformerConv(in, hidden_dim // num_heads, heads=num_heads, concat=True)`,
  so the per-head output (`hidden_dim // num_heads`) concatenates back to
  `hidden_dim` — same width contract as every other backbone.
- `forward(x, edge_index, edge_attr=None, batch=None)`: conv → `BatchNorm1d` →
  ReLU → dropout per layer; `global_mean_pool` for `graph_*` tasks; the classifier
  head emits `num_classes * num_targets`; single-Y regression squeezes the last dim.
- Loss/optim are shared: `weighted_regression_loss` (regression) or
  `cross_entropy` (classification); Adam + `ExponentialLR(gamma=0.95)`.

### Heterogeneous backbone (`hetero_wrapper.py`)

`_HomoBackbone` maps `"transformer" → TransformerConv` and instantiates it with
lazy in-channels (`-1`) so `to_hetero` can wire per-node-type feature dims.

Key detail: GAT needs `add_self_loops=False` under `to_hetero` because its default
self-loop insertion is invalid across two different node types. **`TransformerConv`
takes no `add_self_loops` argument and inserts none**, so it lifts cleanly with no
workaround. With the default `heads=1, concat=True`, each conv outputs `hidden_dim`,
matching the per-type pooling + linear head sizing already in place.

## Usage

```python
from app.models.factory import get_model
import torch

# Homogeneous, graph-level, multi-target regression
model = get_model(
    "transformer",
    num_features=8, num_classes=1, task_type="graph_regression",
    hidden_dim=64, num_layers=3, num_heads=4, dropout=0.3, lr=1e-3,
    num_targets=2,
)

# Heterogeneous (pass HeteroData metadata) → HeteroGraphRegressor(conv="transformer")
metadata = (["cell", "pin"], [("cell", "to", "pin"), ("pin", "to", "cell")])
hmodel = get_model(
    "transformer", num_features=8, num_classes=1,
    task_type="graph_regression", metadata=metadata,
    hidden_dim=64, num_layers=3,
)
```

In the product, the user just ticks **TRANSFORMER** (or leaves "select all") on the
Train page; Optuna includes it in the sweep automatically — no code path is special.

## Caveats

- **`hidden_dim` should be divisible by `num_heads`.** Output width is
  `(hidden_dim // num_heads) * num_heads`; non-divisible values lose a few channels
  (integer division). The Optuna grid (`hidden_dim ∈ {32,64,128}`, default
  `num_heads=4`) is always divisible. Same constraint as the GAT module.
- **Edge attributes are not consumed.** Like the other homogeneous modules,
  `forward` ignores `edge_attr` (TransformerConv *can* use it via `edge_dim`, but
  it is intentionally left off for parity and to avoid an unknown edge-feature dim
  at construction time).
- **Hetero is graph-level only**, inheriting `HeteroGraphRegressor`'s scope.
- **FX-tracing warning under `to_hetero`** ("Found function 'dropout' with keyword
  argument 'training'…") is benign and shared with the existing GAT/SAGE hetero
  backbones — `to_hetero` bakes the dropout training flag at trace time; behavior
  is unaffected.
