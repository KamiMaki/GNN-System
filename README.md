# GNN Circuit Analysis System

An automated Graph Neural Network (GNN) training platform for electronic circuit analysis. Upload circuit graph data, run AutoML-powered model search, and get structured evaluation reports — all through a modern web interface.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  Login → Dashboard → Project → Upload → Explore → Train │
│                        → Evaluate → Report              │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                   Backend (FastAPI)                      │
│  Data Ingestion → Feature Engineering → AutoML          │
│  GCN / GAT / GraphSAGE / GIN / MLP                     │
│  Optuna HPO → PyTorch Lightning Training                │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Ant Design 5, Recharts, Framer Motion |
| Backend | FastAPI, PyTorch Geometric, PyTorch Lightning |
| AutoML | Optuna (hyperparameter optimisation) |
| Testing | pytest (backend), Vitest + Testing Library (frontend) |
| Python env | `uv` with Python 3.11 |

---

## Project Structure

```
GNN-System/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── core/               # In-memory store, config
│   │   ├── data/               # Ingestion, feature engineering, PyG conversion
│   │   ├── models/             # GCN, GAT, GraphSAGE, GIN, MLP
│   │   ├── routers/            # REST endpoints (projects, datasets, tasks)
│   │   ├── schemas/            # Pydantic request/response models
│   │   └── training/           # Optuna search + PyTorch Lightning callbacks
│   ├── mock_data/              # Built-in demo datasets (basic, dirty, edge-attrs, multi-graph)
│   ├── tests/                  # pytest test suite
│   ├── Dockerfile
│   └── pyproject.toml
│
└── frontend/                   # Next.js frontend
    ├── app/
    │   ├── login/              # SSO login page
    │   ├── dashboard/          # Project overview & KPIs
    │   ├── projects/[id]/      # Project-scoped pages
    │   │   ├── upload/         # CSV / GraphML file upload
    │   │   ├── explore/        # Data analysis & feature explorer
    │   │   ├── train/          # AutoML training launcher
    │   │   └── evaluate/       # Model evaluation & leaderboard
    │   ├── docs/               # In-app documentation
    │   └── api-spec/           # Live API spec viewer
    ├── src/
    │   ├── components/         # Shared UI components (AppHeader, KPICard, etc.)
    │   ├── contexts/           # Auth, colour-mode, project contexts
    │   ├── lib/api.ts          # Typed API client
    │   └── theme/              # Ant Design dark-mode theme
    └── package.json
```

---

## Quick Start

### Prerequisites

- Python 3.11+, [`uv`](https://docs.astral.sh/uv/)
- Node.js 20+, npm

### 1. Start the Backend

```bash
cd backend
uv run uvicorn app.main:app --port 8000 --reload
```

The server loads built-in demo datasets on startup (~10 s).
API docs are available at **http://localhost:8000/docs**.

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Features

### Project Management
- Create projects with name and tags
- Project dashboard with search and tag filtering
- 4-step pipeline progress tracking (Upload → Analysis → Training → Evaluation)
- Experiment history per project with status and metrics

### Data Management
- Upload node/edge CSV files (single or folder-based multi-graph)
- Automatic feature engineering: z-score normalisation + one-hot encoding for cell type
- Missing value detection and imputation (mean / median / zero)
- Graph statistics explorer with correlation heatmaps and distribution charts
- Support for 4 task types: node classification, node regression, graph classification, graph regression

### AutoML Training
- 5 GNN architectures: **GCN**, **GAT**, **GraphSAGE**, **GIN**, **MLP** (baseline)
- Optuna searches over: model type, hidden dim (32–256), layers (2–5), dropout, learning rate
- Real-time training progress via polling with time estimation
- Best config and full leaderboard returned after each run

### Evaluation & Reports
- Per-model accuracy, F1, precision, recall (classification) or MSE, MAE, R² (regression)
- Confusion matrix (classification) and residual plot (regression)
- Training history chart (loss + metrics over epochs)
- Top-100 trial leaderboard

---

## API Reference

### Project Management

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/projects/` | Create a new project |
| `GET` | `/api/v1/projects/` | List all projects |
| `GET` | `/api/v1/projects/{id}` | Get project details |
| `DELETE` | `/api/v1/projects/{id}` | Delete a project |

### Data Upload & Analysis

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/projects/{id}/upload` | Upload CSV files |
| `POST` | `/api/v1/projects/{id}/upload-folder` | Upload folder structure |
| `GET` | `/api/v1/projects/{id}/explore` | Dataset statistics & feature info |
| `GET` | `/api/v1/projects/{id}/columns/{col}` | Single column analysis |
| `POST` | `/api/v1/projects/{id}/correlation` | Compute correlation matrix |
| `POST` | `/api/v1/projects/{id}/impute` | Impute missing values |
| `POST` | `/api/v1/projects/{id}/confirm` | Confirm data settings |

### Training & Evaluation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/projects/{id}/estimate` | Estimate training time |
| `POST` | `/api/v1/projects/{id}/train` | Start AutoML training |
| `GET` | `/api/v1/projects/{id}/status` | Training progress |
| `GET` | `/api/v1/projects/{id}/experiments` | List training runs |
| `GET` | `/api/v1/projects/{id}/report` | Latest evaluation report |
| `GET` | `/api/v1/projects/{id}/report/{task_id}` | Specific run report |

### Demo Data

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/projects/demo-datasets` | List available demo datasets |
| `GET` | `/api/v1/projects/sample-data` | Download sample CSV zip |
| `POST` | `/api/v1/projects/{id}/load-demo` | Load a demo dataset |

Full interactive spec: **http://localhost:8000/docs**

---

## Dataset Format

### Node CSV (`nodes_train.csv`)

| Column | Type | Notes |
|---|---|---|
| `node_id` | string/int | Unique identifier |
| `cell_type` | categorical | `Logic`, `Buffer`, `Register`, `Port` |
| `x`, `y` | float | Placement coordinates |
| `width`, `height` | float | Cell dimensions |
| `timing_slack` | float | Timing margin |
| `fanin`, `fanout` | int | Connectivity |
| `label` | int | Ground-truth class |

### Edge CSV (`edges_train.csv`)

| Column | Type | Notes |
|---|---|---|
| `src` | string/int | Source node ID |
| `dst` | string/int | Destination node ID |

Optional test split files: `nodes_test.csv` + `edges_test.csv`. If not provided, an 80/20 train/test split is applied automatically.

---

## Development

### Run Backend Tests

```bash
cd backend
uv run pytest tests/ -v
```

### Run Frontend Tests

```bash
cd frontend
npm test              # single run (vitest)
npm run test:watch    # watch mode
npm run test:coverage # with coverage
```

### Docker (Backend)

```bash
cd backend
docker build -t gnn-system-backend .
docker run -p 8000:8000 gnn-system-backend
```

---

## Architecture Report

See [backend/GNN_System_Architecture_Report.docx.md](backend/GNN_System_Architecture_Report.docx.md) for the full system design document including module breakdown, data flow diagrams, and development timeline.

---

## License

MIT
