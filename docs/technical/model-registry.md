# Technical Documentation: Model Registry & Evaluation

## What Changed

### New Files
- `frontend/app/projects/[id]/models/page.tsx` — Model Registry UI page

### Modified Files
- `backend/app/core/store.py` — Added model registry in-memory store
- `backend/app/core/config.py` — Added `MODELS_DIR` path
- `backend/app/schemas/api_models.py` — Added model registry schemas
- `backend/app/training/pipeline.py` — Auto-save and register models after training
- `backend/app/routers/projects.py` — Added model registry and evaluation endpoints
- `frontend/src/lib/api.ts` — Added model registry API types and functions
- `frontend/src/components/AppHeader.tsx` — Extended pipeline to 5 steps
- `frontend/app/projects/[id]/evaluate/page.tsx` — Added Model Registry nav button
- `frontend/app/projects/[id]/train/page.tsx` — Added Model Registry button

## Why

Previously, trained models existed only in memory during the training task's lifecycle. Once the server restarted or the task reference was lost, the trained model was gone. Users had no way to:
1. Persist trained models for later use
2. Evaluate a model against new unseen data
3. Compare and manage multiple trained models

## How It Works

### Model Persistence Flow

```
Training completes
  → torch.save(state_dict + config) → storage/models/{task_id}.pt
  → store.put_model_record() → in-memory registry
  → Frontend can list, inspect, evaluate, delete
```

### Model File Format (.pt)

Each saved checkpoint contains:
```python
{
    "state_dict": model.state_dict(),     # PyTorch weights
    "model_name": "gcn",                   # Architecture identifier
    "num_features": 11,                    # Input dimension
    "num_classes": 2,                      # Output dimension
    "task_type": "node_classification",    # Task type
    "label_column": "is_critical",         # Target column name
    "hidden_dim": 128,                     # Hidden layer size
    "num_layers": 3,                       # Number of GNN layers
    "dropout": 0.3,                        # Dropout rate
    "lr": 0.001,                           # Learning rate
}
```

### Evaluation with New Data

```
POST /api/v1/projects/{id}/models/{model_id}/evaluate
  → Upload nodes.csv + edges.csv
  → Load checkpoint from disk
  → Reconstruct model with saved config
  → Load state_dict
  → Parse CSV → dataframes_to_pyg_dynamic()
  → model.eval() → inference
  → Compute metrics (classification or regression)
  → Return EvaluationResult (metrics + confusion matrix / residual plot)
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{id}/models` | List all registered models |
| GET | `/projects/{id}/models/{model_id}` | Get model details |
| PATCH | `/projects/{id}/models/{model_id}` | Update name/description |
| DELETE | `/projects/{id}/models/{model_id}` | Delete model + file |
| POST | `/projects/{id}/models/{model_id}/evaluate` | Evaluate with new data |

### Frontend Navigation

The pipeline stepper now has 5 steps:
```
Upload → Analysis → Training → Evaluation → Models
```
Step 5 (Models) unlocks when project status is "completed".

## Usage

### Listing Models
```typescript
const models = await listProjectModels(projectId);
```

### Evaluating with New Data
```typescript
const result = await evaluateModelWithData(projectId, modelId, nodesFile, edgesFile);
// result.metrics — SplitMetrics
// result.confusion_matrix — ConfusionMatrix (classification)
// result.residual_data — scatter plot data (regression)
```

## Caveats

1. **In-memory registry**: Model metadata is stored in-memory (like all other data in this system). The `.pt` files on disk survive restarts, but the registry index does not. A future enhancement could scan `MODELS_DIR` on startup to rebuild the registry.
2. **Schema compatibility**: When evaluating with new data, the uploaded CSV must have the same feature columns and label column as the training data. The system will raise a 422 error if columns don't match.
3. **Scaler not persisted**: The StandardScaler used during training is not saved with the model. New evaluation data gets its own scaler fit, which may cause slight metric differences. For production use, the scaler should be persisted alongside the model.
