# Using the Transformer model

GraphX.AI now includes a **Transformer** GNN (a graph transformer based on
multi-head attention) alongside GCN, GAT, GraphSAGE, GIN, and MLP.

## What it is, in plain terms

The Transformer model lets every node "pay attention" to its neighbours with
multiple independent attention heads, similar to the attention used in language
models but applied to graph edges. In practice it is a strong, general-purpose
choice — especially when relationships between distant parts of a graph matter.

## How to use it

You don't need to do anything special:

1. Go through the normal pipeline: **Create → Upload → Explore → Confirm**.
2. On the **Train** page you'll see **TRANSFORMER** in the model list.
   - Leave the default (all models selected) to let AutoML compare Transformer
     against the others and keep whichever scores best, **or**
   - tick only **TRANSFORMER** to train just that family.
3. Click **Start Training**. The Transformer participates in the Optuna
   hyper-parameter search exactly like the other models, and it can win the
   leaderboard on the Evaluate page.

## When to pick it

- **Good default** for both homogeneous and heterogeneous graphs.
- Works for every task type: node/graph × classification/regression, including
  multi-target (multi-Y) regression.
- If you want the system to decide, just keep "select all" — AutoML will only
  surface the Transformer if it actually outperforms the alternatives.

## Notes / limits

- For **heterogeneous** datasets the available models are GAT, GraphSAGE, and
  Transformer (GCN, GIN, and MLP are not supported for heterogeneous graphs).
- The Transformer (like the other models in this platform) trains on node features
  and graph structure; it does not use edge attributes.
- There is nothing extra to configure — hidden size, layers, heads, learning rate,
  and dropout are all tuned automatically during training.
