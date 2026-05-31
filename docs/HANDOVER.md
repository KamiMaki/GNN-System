# GraphX.AI / LayoutXpert — Engineering Handover

> **Audience:** an engineer or AI agent who needs to understand this subsystem and
> integrate its capabilities into a larger ("main") system. Read this top-to-bottom
> once; it is self-contained. Source-of-truth cross-references are given as
> `path:` so you can drill in.

Last updated: 2026-05-31 (after the TransformerConv + cleanup pass).

---

## 1. What this is

A self-contained **Graph Neural Network (GNN) AutoML platform** for IC-layout / EDA
graph data. A user uploads an Excel workbook describing one or more graphs, the
backend runs an Optuna hyper-parameter search across a pool of GNN architectures,
trains the best one, and returns full metric reports + a reusable model. No ML
expertise is required from the user.

It is **two deployable units**:

| Unit | Tech | Role |
|------|------|------|
| `backend/` | FastAPI + Pydantic v2 + PyTorch + PyTorch Geometric + PyTorch Lightning + Optuna | REST API, data ingestion, AutoML training, model registry |
| `frontend/` | Next.js 16 (App Router) + React 19 + Ant Design 5 + Recharts + Framer Motion | Guided 6-step UI, talks to the backend over REST |

Everything runs on a single machine; CUDA is auto-detected with CPU fallback.

---

## 2. End-to-end user flow (the "pipeline")

```
Create project → Upload .xlsx → Explore (stats/schema) → Confirm task+label
   → Train (Optuna HPO → best model) → Evaluate (metrics/plots) → Predict / Register model
```

Frontend pages live under `frontend/app/projects/[id]/`:
`upload → explore → train → evaluate → predict → models`.

---

## 3. Backend module map

```
backend/app/
├── main.py                 # FastAPI app, CORS, 100 MB upload-limit middleware, router mounting
├── core/
│   ├── config.py           # Settings (training knobs, storage paths) — pydantic-settings
│   └── store.py            # In-memory, thread-locked dicts: projects/datasets/tasks/experiments/models
├── data/
│   ├── excel_spec.py       # Parameter-sheet schema (ExcelGraphSpec), hetero validation
│   ├── excel_ingestion.py  # parse_excel_file(): workbook → DataFrames + task_type + multi-Y
│   ├── feature_engineering.py  # explore stats, label validation, imputation
│   ├── pyg_converter.py        # homogeneous DataFrames → list[Data]
│   ├── pyg_converter_hetero.py # heterogeneous DataFrames → list[HeteroData]
│   └── graph_cache_sqlite.py   # SHA-256 content-hash cache of parsed graph samples
├── models/
│   ├── factory.py          # get_model(); HOMO_REGISTRY + HETERO_BACKBONES  ← extension point
│   ├── gcn.py gat.py sage.py gin.py mlp.py transformer.py   # homogeneous Lightning modules
│   ├── hetero_wrapper.py   # HeteroGraphRegressor (to_hetero lift of a homo backbone)
│   ├── loss.py             # weighted_regression_loss (multi-Y weighted MSE)
│   └── _lr.py              # build_scheduler() → ExponentialLR(gamma=0.95)
├── training/
│   ├── optuna_search.py    # run_hpo(): Optuna study, MedianPruner, per-trial early stop
│   ├── pipeline.py         # run_training_task(): preprocess → HPO → final train → report
│   ├── callbacks.py        # ProgressCallback / TrialProgressCallback → push progress to store
│   └── target_scaler.py    # TargetScaler: standardize regression targets (single + multi-Y)
├── routers/
│   ├── projects.py         # ~30 endpoints: CRUD, demo/template, explore, train, registry
│   └── tasks.py            # 3 endpoints: list tasks, get task, get task report
└── schemas/api_models.py   # All Pydantic request/response models
```

---

## 4. HTTP API surface

All routes are mounted under prefix **`/api/v1`** (see `main.py`). App title
`GraphX.AI GNN API`, version `0.4.0`.

### Projects router (`routers/projects.py`)

| Method | Path (after `/api/v1`) | Purpose | Response |
|--------|------------------------|---------|----------|
| POST   | `/projects/` | Create project | `ProjectSummary` |
| GET    | `/projects/` | List projects | `list[ProjectSummary]` |
| GET    | `/projects/{pid}` | Project detail | `ProjectDetail` |
| PATCH  | `/projects/{pid}` | Update name/tags | `ProjectSummary` |
| DELETE | `/projects/{pid}` | Delete project | `{detail}` |
| GET    | `/projects/demo-excels` | List bundled demo datasets | `list[dict]` |
| GET    | `/projects/sample-excel` | Download blank template (`graph_data_template.xlsx`) | xlsx |
| GET    | `/projects/demo-excel/{demo_id}` | Download a demo workbook | xlsx |
| POST   | `/projects/{pid}/load-demo-excel?demo_id=…` | Ingest a demo into the project | `DatasetSummary` |
| POST   | `/projects/{pid}/upload-excel` | Upload a workbook (multipart) | `DatasetSummary` |
| GET    | `/projects/{pid}/explore` | Dataset statistics | `GenericExploreData` |
| GET    | `/projects/{pid}/graph-sample?limit&graph_name` | Graph preview (cached) | nodes/edges JSON |
| GET    | `/projects/{pid}/columns/{col}?override_type` | Single-column analysis | dict |
| POST   | `/projects/{pid}/correlation` | Feature correlation matrix | dict |
| POST   | `/projects/{pid}/validate-label` | Validate a label column | `LabelValidationResult` |
| POST   | `/projects/{pid}/impute` | Impute missing values | `ImputationResult` |
| POST   | `/projects/{pid}/confirm` | Lock task_type + label | `ProjectSummary` |
| GET    | `/projects/{pid}/estimate?n_trials` | Estimate training time | `TrainingEstimate` |
| POST   | `/projects/{pid}/train` | Start async training | `TaskStatus` |
| GET    | `/projects/{pid}/status` | Current training status | `TaskStatus` |
| GET    | `/projects/{pid}/report` | Latest report | `Report` |
| GET    | `/projects/{pid}/report/{task_id}` | Report for a specific task | `Report` |
| POST   | `/projects/{pid}/experiments` | Create experiment | `ExperimentSummary` |
| GET    | `/projects/{pid}/experiments/list` | List experiments | `list[ExperimentSummary]` |
| GET    | `/projects/{pid}/experiments/{eid}` | Experiment detail | `ExperimentDetail` |
| DELETE | `/projects/{pid}/experiments/{eid}` | Delete experiment | `{detail}` |
| GET    | `/projects/{pid}/models` | List registered models | `list[RegisteredModel]` |
| GET    | `/projects/{pid}/models/{mid}` | Model detail | `RegisteredModel` |
| PATCH  | `/projects/{pid}/models/{mid}` | Update model name/desc | `RegisteredModel` |
| DELETE | `/projects/{pid}/models/{mid}` | Delete model | `{detail}` |

### Tasks router (`routers/tasks.py`)

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | `/tasks` | List all tasks | `list[TaskStatus]` |
| GET | `/tasks/{task_id}` | Task status | `TaskStatus` |
| GET | `/tasks/{task_id}/report` | Task report | `Report` |

> Request/response shapes are all in `schemas/api_models.py`. Notable: `Report`
> carries `train/val/test_metrics`, `history` (per-epoch curves), `leaderboard`,
> `residual_data`, `confusion_matrix`, and multi-Y `per_target_metrics` /
> `per_target_residuals`.

---

## 5. Data contract: the Excel workbook

A single `.xlsx` with up to four sheets (see `excel_spec.py`, `excel_ingestion.py`):

| Sheet | Required columns | Notes |
|-------|------------------|-------|
| `Parameter` | `XY`, `Level`, `Type`, `Parameter`, optional `Weight` | Declares the schema. `XY` ∈ {X feature, Y label}. `Level` ∈ {Node, Edge, Graph}. `Weight` sets per-target loss weight (default 1.0). |
| `Node` | `_graph` (multi-graph id) + declared node columns | Optional `Type` column → heterogeneous node types. |
| `Edge` | `_graph`, `src`, `dst` + optional edge columns | Optional `Type` column → heterogeneous edge types. |
| `Graph` | `_graph` + graph-level columns | Targets for `graph_*` tasks. |

Column names are matched flexibly (e.g. `Graph_ID`/`graph_id`, `src`/`Source_Node_ID`).
Ingestion infers the **task type** as `{level}_{classification|regression}` and
detects homogeneity from whether a `Type` column has >1 distinct value. Conversion
to PyG `Data` (homogeneous) or `HeteroData` (heterogeneous) happens in
`pyg_converter.py` / `pyg_converter_hetero.py`.

**Multi-Y (multi-target):** multiple `Y` rows on the *same* `Level` produce a
vector target. Currently **regression-only and single-Level**; mixed task kinds
or multi-Y classification are rejected at ingest.

---

## 6. The model layer  ← read this before adding a model

All homogeneous models are `pytorch_lightning.LightningModule`s that share one
shape contract:

```python
forward(x, edge_index, edge_attr=None, batch=None) -> Tensor
# node-level:  (N, C)            classification  |  (N,) or (N, T)  regression
# graph-level: global_mean_pool then (B, C) / (B,) / (B, T)
```

They all use `weighted_regression_loss` (`loss.py`) for regression, `cross_entropy`
for classification, Adam + `ExponentialLR` (`_lr.py`), and BatchNorm between convs.

**Registry & factory — `models/factory.py`:**

```python
HOMO_REGISTRY = {"gcn", "gat", "sage", "gin", "mlp", "transformer"}  # name → class
HETERO_BACKBONES = ("gat", "sage", "transformer")                    # to_hetero-liftable
get_model(model_name, num_features, num_classes, task_type, metadata=None, **kw)
```

- If `metadata` (a `HeteroData` metadata tuple) is passed, you get a
  `HeteroGraphRegressor` (`hetero_wrapper.py`) that lifts a backbone via
  `torch_geometric.nn.to_hetero`. Backbones not in `HETERO_BACKBONES` are
  silently mapped to `sage` with a warning. **GCN/GIN are excluded** from hetero
  (GCN assumes one relation type; GIN's inner MLP collapses on bipartite edges).
- Otherwise you get the homogeneous module from `HOMO_REGISTRY`.

**`optuna_search.py` auto-discovers** the candidate model list from
`HOMO_REGISTRY` / `HETERO_BACKBONES` — there is **no separate hardcoded list** to
maintain on the backend.

### Worked example — how TransformerConv was added (the extension recipe)

1. `models/transformer.py`: new `TransformerClassifier`, copied from the GAT
   module, swapping `GATConv → TransformerConv` (multi-head attention; emits
   `hidden_dim // num_heads` per head, concatenated). `TransformerConv` adds no
   implicit self-loops, so it also lifts under `to_hetero` without the
   `add_self_loops=False` workaround GAT needs.
2. `factory.py`: add `"transformer": TransformerClassifier` to `HOMO_REGISTRY`
   **and** `"transformer"` to `HETERO_BACKBONES`.
3. `hetero_wrapper.py`: add `"transformer": TransformerConv` to the `_HomoBackbone`
   conv map.
4. Frontend `train/page.tsx`: add `'transformer'` to `ALL_MODELS_HOMO` and
   `ALL_MODELS_HETERO`. The UI label is just `name.toUpperCase()` — no mapping
   object to touch. Everything else (HPO, training, reporting) flows automatically.
5. Tests: `tests/test_transformer_model.py` (shape + registry + hetero-lift).

That is the full surface area for a new architecture: **one module + two registry
edits (+ one frontend array + a test).**

---

## 7. Training pipeline & task lifecycle

`POST /projects/{pid}/train` creates a `QUEUED` task and schedules
`run_training_task(task_id)` via FastAPI **`BackgroundTasks`** (runs in a worker
thread — there is no external queue/worker). The task progresses through:

| Phase (`current_phase`) | `status` | progress | What happens |
|-------------------------|----------|----------|--------------|
| `preprocessing` | PREPROCESSING | ~5% | Build PyG `Data`/`HeteroData`, 60/20/20 split (graph) or pre-split (node), fit `TargetScaler` (regression). |
| `hpo` | TRAINING | 15→50% | `run_hpo()` Optuna study, `MedianPruner`, per-trial `EarlyStopping(val_loss)`. Search space: model, hidden_dim∈{32,64,128}, num_layers∈[2,4], dropout∈[0.1,0.3], lr∈[1e-5,1e-4] log. |
| `final_training` | TRAINING | 50→99% | Train best config to `MAX_EPOCHS=200`, `EarlyStopping(patience=30)`, `ModelCheckpoint` on val_mae/val_loss. |
| `completed` | COMPLETED | 100% | Inverse-scale predictions, compute metrics (regression: MSE/MAE/R²/MAPE; classification: acc/F1/precision/recall + confusion matrix), build `Report`, save checkpoint to `storage/models/{task_id}.pt`, register model. |
| `failed` | FAILED | — | Exception caught, `error` recorded on the task. |

Progress is pushed to the in-memory store by the Lightning/Optuna callbacks
(`callbacks.py`); the frontend **polls** `/status`. Reproducibility seed = 42.

---

## 8. Storage & state

- **All app state is in-memory** (`core/store.py`): module-level dicts behind a
  `threading.Lock`, holding projects, datasets (incl. parsed DataFrames),
  experiments, tasks (incl. full reports/history), and registered-model metadata.
  **It does not survive a process restart.**
- **On disk:** trained checkpoints → `backend/storage/models/{task_id}.pt`
  (`storage/` is gitignored); bundled demos → `backend/demo_data/`; the blank
  template → `backend/graph_data_template.xlsx`.
- **Tunable knobs** (`core/config.py`): `MAX_EPOCHS=200`, `MAX_HPO_EPOCHS=30`,
  `PATIENCE=30`, `HPO_PATIENCE=6`, `OPTUNA_TRIALS=150`, `GRADIENT_CLIP=1.0`,
  `PRECISION="16-mixed"`, `DETERMINISTIC_SEED=42`. Override via env vars
  (pydantic-settings).

### Bundled demo datasets (`/projects/demo-excels`)

| id | display name | file | hetero |
|----|--------------|------|--------|
| `multigraph_homo` | Multi-Graph Homogeneous | `demo_multigraph_homo.v2.xlsx` | no |
| `multigraph_homo_no_type` | Multi-Graph Homogeneous (no Type col) | `demo_multigraph_homo_no_type.xlsx` | no |
| `multigraph_multi_y` | Multi-Graph Multi-Y Regression | `demo_multigraph_multi_y.xlsx` | no |
| `multigraph_hetero` | Multi-Graph Heterogeneous | `demo_multigraph_hetero.v2.xlsx` | yes |
| `hetero_multifeature_str` | Hetero Multi-Feature (string Graph_ID) | `demo_hetero_multifeature.v3.xlsx` | yes |

---

## 9. Integrating this into a main system

This subsystem is a **REST microservice**. Recommended integration patterns:

1. **As a service (recommended).** Deploy `backend/` (see `Dockerfile` /
   `docker-compose.yml`) and call the `/api/v1` REST API from your main system.
   The contract is the Pydantic models in `schemas/api_models.py` — generate a
   client from the OpenAPI spec at `/docs` / `/openapi.json`.
2. **As a library.** Import `app.data.excel_ingestion.parse_excel_file`,
   `app.training.pipeline`, and `app.models.factory.get_model` directly if you
   only need ingestion/training without the HTTP layer.

**Things you must address for production integration:**

- **Authentication.** The backend itself has **no auth** — it only sets CORS
  (`CORS_ALLOWED_ORIGINS`). In the reference setup the *frontend* does Keycloak
  OIDC via NextAuth. If you expose the backend, put it behind your gateway/authz.
- **Persistence.** Replace the in-memory `store.py` with a real database/queue if
  you need durability, horizontal scaling, or restart-safety. The store API is
  small and centralized, so this is the main swap point.
- **Shared storage.** Checkpoints are written to the local filesystem; point
  `STORAGE_DIR`/`MODELS_DIR` at shared/object storage for multi-instance setups.
- **Background work.** Training runs in an in-process thread via `BackgroundTasks`.
  For real scale, move `run_training_task` onto a worker queue (Celery/RQ/Arq).
- **GPU.** `PRECISION="16-mixed"` assumes CUDA; CPU uses `32-true`. Set per host.

---

## 10. Known caveats / tech debt (read before changing things)

- **`backend/.git` is a nested git repository** (a directory, not a worktree
  pointer), even though the same files are tracked by the root repo. This is an
  anomaly — likely a leftover from when `backend/` was a standalone repo. It was
  **left untouched** in the 2026-05-31 cleanup because deleting a `.git` is
  destructive and may hold unique history. Investigate and remove deliberately.
- **Two demo files are not regenerated by the script.**
  `generate_excel_demos.py` produces `demo_multigraph_homo.v2.xlsx`,
  `demo_multigraph_hetero.v2.xlsx`, `demo_hetero_multifeature.v3.xlsx`. It does
  **not** produce `demo_multigraph_homo_no_type.xlsx` or
  `demo_multigraph_multi_y.xlsx`, which are registered demos used by the smoke
  tests. They currently exist only as committed binaries — do not delete them,
  and add generators if you need to reproduce them.
- **Heterogeneous training is graph-level only.** Node-level hetero prediction is
  not implemented (`hetero_wrapper.py` pools per-type then uses a linear head).
- **Multi-Y is regression-only, single-Level.** Enforced at ingest.
- **Dependency CVEs.** Both `pip-audit` (backend) and `npm audit` (frontend)
  report known advisories in transitive deps (e.g. backend: aiohttp, starlette,
  urllib3, requests; frontend: undici, ws, uuid via jest-junit). None are in
  first-party code. Plan a dependency bump + retest; most have fix versions and
  `npm audit fix` covers the frontend non-breaking ones. See the
  `2026-05-31-transformerconv-and-cleanup` changelog for the captured snapshot.

---

## 11. Build / test / lint / CVE commands

```bash
# Backend (Python 3.11+, uv-managed venv at backend/.venv)
cd backend
uv sync                                            # install deps
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
.venv/Scripts/python -m pytest -q                  # ~120 tests
uvx ruff check app tests                           # lint (config in pyproject.toml)
uvx --from pip-audit pip-audit -r <frozen-reqs>    # CVE scan of installed versions

# Frontend (Node 20+)
cd frontend
npm install
npm run dev                                        # http://localhost:3000
npm test                                           # Jest (13 suites)
npx tsc --noEmit                                   # type-check
npm run lint                                        # eslint
npm audit                                          # CVE scan
```

---

## 12. Where to look first (quick index)

| I want to… | Go to |
|------------|-------|
| Add a GNN architecture | `models/factory.py` + a new `models/*.py` (see §6 recipe) |
| Change training behavior | `training/pipeline.py`, `training/optuna_search.py`, `core/config.py` |
| Change the data format | `data/excel_spec.py`, `data/excel_ingestion.py` |
| Add/modify an endpoint | `routers/projects.py` / `routers/tasks.py` + `schemas/api_models.py` |
| Understand a response shape | `schemas/api_models.py` |
| Swap persistence | `core/store.py` (single, centralized swap point) |
| Frontend model picker | `frontend/app/projects/[id]/train/page.tsx` |
| Architectural overview | `docs/architecture/overview.md` |
```
