# Changelog: Model Registry & Evaluation

**Date:** 2026-03-17
**Type:** Feature
**Branch:** feature/antd-migration

## Summary

Added model registry functionality and new data evaluation capability, enabling trained models to be effectively managed and reused.

## Changes

### Backend

- **`backend/app/core/store.py`** — Added `models` dict and CRUD helpers (`get_model_record`, `put_model_record`, `list_model_records`, `delete_model_record`)
- **`backend/app/core/config.py`** — Added `MODELS_DIR` setting for model file persistence
- **`backend/app/schemas/api_models.py`** — Added `RegisteredModel`, `RegisterModelRequest`, `EvaluateModelRequest`, `EvaluationResult` schemas
- **`backend/app/training/pipeline.py`** — After training, saves model checkpoint to disk (`.pt` file) and auto-registers in model registry
- **`backend/app/routers/projects.py`** — Added 5 new endpoints:
  - `GET /{project_id}/models` — List registered models
  - `GET /{project_id}/models/{model_id}` — Get model details
  - `PATCH /{project_id}/models/{model_id}` — Update model name/description
  - `DELETE /{project_id}/models/{model_id}` — Delete model and file
  - `POST /{project_id}/models/{model_id}/evaluate` — Upload new data and evaluate model

### Frontend

- **`frontend/src/lib/api.ts`** — Added `RegisteredModel`, `EvaluationResult` types and 5 API functions
- **`frontend/app/projects/[id]/models/page.tsx`** — New Model Registry page with:
  - Model cards with metrics, config, and actions
  - Evaluate modal: upload new CSV data and see results (metrics, confusion matrix, residual plot)
  - Edit modal: rename/describe models
  - Detail modal: full model configuration and metrics
  - Delete with confirmation
- **`frontend/src/components/AppHeader.tsx`** — Added Step 5 "Models" to pipeline stepper
- **`frontend/app/projects/[id]/evaluate/page.tsx`** — Added "Model Registry" navigation button
- **`frontend/app/projects/[id]/train/page.tsx`** — Added "Model Registry" button after training completes
