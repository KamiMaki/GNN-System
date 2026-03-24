# GraphX.AI — GNN AutoML Platform for IC Layout Analysis

<p align="center">
  <strong>Upload circuit graph data → AutoML-powered model search → Structured evaluation reports</strong>
</p>

GraphX.AI is an end-to-end **Graph Neural Network (GNN) AutoML platform** purpose-built for IC (Integrated Circuit) layout and EDA (Electronic Design Automation) data. It provides a guided 4-step workflow — from data upload to model evaluation — through a modern, responsive web interface.

---

## Use Cases

### 1. IC Layout Quality Prediction
Upload circuit netlists as node/edge CSVs, train GNN models to predict layout quality metrics (e.g., timing violations, congestion hotspots). Automatically compare 5 GNN architectures to find the best-performing model.

### 2. Cell Type Classification
Classify circuit cells (Logic, Buffer, Register, Port) based on topological and physical features. Use the built-in demo datasets to get started in minutes.

### 3. Graph-Level Property Prediction
With multi-graph support, train models that predict properties of entire circuits (e.g., power estimation, routability score) rather than individual nodes.

### 4. Rapid Prototyping & Benchmarking
Quickly benchmark multiple GNN architectures (GCN, GAT, GraphSAGE, GIN, MLP) with Optuna hyperparameter optimization — no coding required. Compare results side-by-side on the leaderboard.

### 5. Data Exploration & Quality Assessment
Explore graph topology, feature distributions, correlation heatmaps, and detect data quality issues (missing values, outliers) before training. Built-in imputation tools help clean data interactively.

### 6. Model Registry & Re-evaluation
Register trained models, manage their metadata, and re-evaluate them on new datasets — enabling continuous model monitoring and comparison across data versions.

---

## Why GraphX.AI?

| Advantage | Description |
|-----------|-------------|
| **Zero-Config Setup** | Pure in-memory storage — no database, no Docker required. `pip install` + `npm install` and you're running. |
| **Guided Workflow** | 4-step pipeline (Upload → Explore → Train → Evaluate) with validation gates between steps. Users always know what to do next. |
| **AutoML Out-of-the-Box** | Optuna-powered hyperparameter search across 5 GNN architectures (10–300 trials). No ML expertise needed. |
| **Multi-Graph Support** | Upload multiple circuit graphs per project — supports both node-level and graph-level tasks. |
| **4 Task Types** | Node Classification, Node Regression, Graph Classification, Graph Regression — covers all common GNN use cases. |
| **Smart Feature Engineering** | Auto-detects numeric/categorical columns, applies z-score normalization and one-hot encoding. Manual override available. |
| **Interactive Data Analysis** | Correlation heatmaps, distribution histograms, outlier detection, missing value imputation — all in-browser. |
| **Real-Time Training Monitor** | Live progress bar, elapsed/remaining time, trial counter, and terminal-style training log. |
| **Model Registry** | Trained models are automatically registered with full metadata. Re-evaluate on new data anytime. |
| **GPU Acceleration** | Automatic CUDA detection — seamlessly uses GPU when available, falls back to CPU. |
| **Dark Mode** | Full light/dark theme support with persistent preference. |
| **Responsive UI** | Works on desktop and mobile with adaptive layout and drawer navigation. |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  Login → Dashboard → Upload → Explore → Train → Evaluate │
│         → Model Registry                                │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                   Backend (FastAPI)                      │
│  Data Ingestion → Feature Engineering → AutoML          │
│  GCN / GAT / GraphSAGE / GIN / MLP                     │
│  Optuna HPO → PyTorch Lightning Training                │
│  Model Registry → Re-evaluation                         │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, Ant Design 5.x, Recharts, Framer Motion |
| Backend | FastAPI, Pydantic v2 |
| ML | PyTorch, PyTorch Geometric (PyG), PyTorch Lightning |
| AutoML | Optuna (hyperparameter optimization) |
| Language | TypeScript (frontend), Python 3.11 (backend) |
| Storage | In-Memory (zero-config, no database) |

---

## Quick Start

### Prerequisites

- Python 3.11+, [`uv`](https://docs.astral.sh/uv/) or `pip`
- Node.js 20+, npm

### 1. Start the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs available at **http://localhost:8000/docs** (Swagger UI).

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### 3. Try It in 5 Minutes

1. Open the browser → click **New Project** → name your project
2. On the **Upload** page, click **Load** on any demo dataset (start with **Basic Circuit**)
3. In **Data Analysis**, select a task type (e.g., `Node Classification`) and label column (e.g., `label`)
4. Click **Confirm & Proceed to Training**
5. Set the number of Optuna trials → click **Start Training**
6. After training completes, view the full evaluation report with metrics, charts, and leaderboard
7. Go to **Model Registry** to manage and re-evaluate trained models

---

## Features

### Data Management
- **Folder upload** — select a folder with node/edge CSVs; system auto-detects graph structure
- **Multi-graph support** — one folder with multiple sub-graphs (graph_A/, graph_B/, ...)
- **4 built-in demo datasets** — Basic, Edge Attributes, Multi-Graph, Dirty Data
- **Sample CSV download** — reference format for preparing your own data
- **Auto train/test split** — 80/20 split if no test files provided

### Data Exploration & Analysis
- Graph topology overview (node count, edge count)
- Per-column statistics: mean, median, std, min, max, quartiles, outlier count
- Correlation heatmap with interactive column selection
- Categorical column analysis with frequency charts
- Missing value detection and imputation (mean / median / zero)
- Manual type override (numeric ↔ categorical)
- Label validation with class distribution visualization
- Full attribute summary table

### AutoML Training
- **5 GNN architectures**: GCN, GAT, GraphSAGE, GIN, MLP (baseline)
- **Optuna HPO**: 10–300 trials, searching over model type, hidden dim, layers, dropout, learning rate
- Real-time progress: progress bar, timer, trial counter, terminal log
- Training time estimation before starting
- Experiment history with per-run metrics and status tracking

### Evaluation & Reports
- **Classification**: Accuracy, F1, Precision, Recall + Confusion Matrix
- **Regression**: MSE, MAE, R² Score + Residual Plot (Actual vs. Predicted)
- Training history chart (Loss & Accuracy over epochs)
- HPO leaderboard (Top trials with full hyperparameter details)
- Best model configuration summary
- Train / Validation / Test split metrics

### Model Registry
- Auto-registration of best model after each training run
- View model details: architecture, hyperparameters, metrics, feature info
- Edit model name and description
- **Re-evaluate on new data** — upload new CSVs to test a registered model
- Delete models when no longer needed

### UI/UX
- Ant Design component library with consistent design language
- Light/Dark mode with persistent preference (localStorage)
- Responsive layout with mobile-friendly drawer navigation
- Page transitions with Framer Motion animations
- Pipeline stepper showing current progress across all 4 steps

---

## Project Structure

```
GraphX.AI/
├── backend/                        # FastAPI backend
│   ├── app/
│   │   ├── core/                   # In-memory store, config
│   │   ├── data/                   # Ingestion, feature engineering, PyG conversion
│   │   ├── models/                 # GCN, GAT, GraphSAGE, GIN, MLP model definitions
│   │   ├── routers/                # REST endpoints (projects, datasets, tasks)
│   │   ├── schemas/                # Pydantic request/response models
│   │   └── training/               # Optuna search + PyTorch Lightning pipeline
│   ├── mock_data/                  # Built-in demo datasets
│   ├── tests/                      # pytest test suite
│   └── requirements.txt
│
├── frontend/                       # Next.js frontend
│   ├── app/
│   │   ├── login/                  # SSO-style login page
│   │   ├── dashboard/              # Project management & KPIs
│   │   └── projects/[id]/
│   │       ├── upload/             # Step 1: Data upload
│   │       ├── explore/            # Step 2: Data analysis
│   │       ├── train/              # Step 3: AutoML training
│   │       ├── evaluate/           # Step 4: Evaluation reports
│   │       └── models/             # Model Registry
│   ├── src/
│   │   ├── components/             # Shared UI components (AppHeader, Stepper, etc.)
│   │   ├── contexts/               # Auth, ColorMode, Project contexts
│   │   ├── lib/api.ts              # Typed API client
│   │   └── theme/                  # Ant Design theme configuration
│   └── package.json
│
└── docs/                           # Documentation
    ├── usage/                      # User guides
    ├── technical/                  # Technical docs
    └── changelog/                  # Change logs
```

---

## Supported GNN Models

| Model | Full Name | Description |
|-------|-----------|-------------|
| **GCN** | Graph Convolutional Network | Foundational graph convolution with neighbor aggregation |
| **GAT** | Graph Attention Network | Attention mechanism assigns different weights to neighbors |
| **GraphSAGE** | Sample and Aggregate | Scalable neighbor sampling and aggregation |
| **GIN** | Graph Isomorphism Network | Theoretically most expressive (WL-test equivalent) |
| **MLP** | Multi-Layer Perceptron | Node-features-only baseline (ignores graph structure) |

All models support node-level and graph-level tasks, and accept edge attributes as input (except MLP).

---

## Dataset Format

### Nodes CSV

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `node_id` | int / string | Yes | Unique node identifier |
| Feature columns | numeric / categorical | Yes | Any number of node features |
| Label column | numeric / string | Yes | Learning target (selected in Step 2) |

### Edges CSV

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `src_id` | int / string | Yes | Source node ID |
| `dst_id` | int / string | Yes | Destination node ID |
| Edge attributes | numeric | No | Optional edge features |

### Folder Structure

```
my_data/
├── graph_A/
│   ├── nodes_train.csv     # Required
│   ├── edges_train.csv     # Required
│   ├── nodes_test.csv      # Optional
│   └── edges_test.csv      # Optional
├── graph_B/
│   └── ...
```

> **Single graph**: Place CSVs directly in the folder (no sub-folders needed).

---

## API Reference

Full interactive API docs: **http://localhost:8000/docs**

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/projects` | Create project |
| `GET` | `/api/v1/projects` | List projects |
| `GET` | `/api/v1/projects/{id}` | Get project details |
| `PUT` | `/api/v1/projects/{id}` | Update project |
| `DELETE` | `/api/v1/projects/{id}` | Delete project |
| `POST` | `/api/v1/projects/{id}/upload-folder` | Upload data folder |
| `POST` | `/api/v1/projects/{id}/load-demo` | Load demo dataset |
| `GET` | `/api/v1/projects/{id}/explore` | Get exploration data |
| `POST` | `/api/v1/projects/{id}/impute` | Impute missing values |
| `POST` | `/api/v1/projects/{id}/confirm-data` | Confirm data settings |
| `POST` | `/api/v1/projects/{id}/training/start` | Start training |
| `GET` | `/api/v1/projects/{id}/training/status` | Get training status |
| `GET` | `/api/v1/projects/{id}/report` | Get evaluation report |
| `GET` | `/api/v1/projects/{id}/models` | List registered models |
| `POST` | `/api/v1/projects/{id}/models/{mid}/evaluate` | Re-evaluate model |
| `PUT` | `/api/v1/projects/{id}/models/{mid}` | Update model info |
| `DELETE` | `/api/v1/projects/{id}/models/{mid}` | Delete model |
| `GET` | `/api/v1/projects/demo-datasets` | List demo datasets |
| `GET` | `/api/v1/projects/sample-data` | Download sample CSV |

---

## Development

### Backend Tests

```bash
cd backend
uv run pytest tests/ -v
```

### Frontend Tests

```bash
cd frontend
npx vitest run
```

### Frontend Build

```bash
cd frontend
npm run build
```

---

## Known Limitations

- **In-memory storage** — data is not persisted across server restarts (MVP design)
- **Mock authentication** — SSO login UI exists but uses mock credentials
- **Single-user mode** — no multi-tenant support
- **Polling-based updates** — training progress uses 2-second polling, not WebSocket
- **No model export** — trained models cannot be downloaded as files yet

---

## Documentation

- [System Usage Guide](docs/usage/system-guide.md) — comprehensive step-by-step user guide (中文)
- [Model Registry Technical Docs](docs/technical/model-registry.md) — architecture and implementation details
- [Changelog](docs/changelog/) — feature change logs

---

## License

MIT
