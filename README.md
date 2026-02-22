# GNN Circuit Analysis System

An automated Graph Neural Network (GNN) training platform for electronic circuit analysis. Upload circuit graph data, run AutoML-powered model search, and get structured evaluation reports — all through a modern web interface.

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                │
│  Login → Dashboard → Upload → Explore → Train → Report │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│                  Backend (FastAPI)                  │
│  Data Ingestion → Feature Engineering → AutoML      │
│  GCN / GAT / GraphSAGE / GIN / MLP                 │
│  Optuna HPO → PyTorch Lightning Training            │
└─────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, MUI v7, Tailwind CSS v4 |
| Backend | FastAPI, PyTorch Geometric, PyTorch Lightning |
| AutoML | Optuna (hyperparameter optimisation) |
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
│   │   ├── routers/            # REST endpoints (datasets, tasks, projects)
│   │   ├── schemas/            # Pydantic request/response models
│   │   └── training/           # Optuna search + PyTorch Lightning callbacks
│   ├── mock_data/              # Built-in 30K-node circuit dataset
│   ├── scripts/                # Demo data generation utilities
│   ├── tests/                  # pytest test suite
│   ├── Dockerfile
│   └── pyproject.toml
│
└── frontend/                   # Next.js frontend
    ├── app/
    │   ├── login/              # SSO login page
    │   ├── dashboard/          # Project overview & KPIs
    │   ├── upload/             # CSV / GraphML file upload
    │   ├── explore/            # Interactive graph explorer
    │   ├── train/              # AutoML training launcher
    │   ├── evaluate/           # Model evaluation & leaderboard
    │   ├── projects/           # Project management
    │   ├── docs/               # In-app documentation
    │   └── api-spec/           # Live API spec viewer
    ├── src/
    │   ├── components/         # Shared UI components
    │   ├── contexts/           # Auth, colour-mode, project contexts
    │   ├── lib/api.ts          # Typed API client
    │   └── theme/              # MUI dark-mode theme
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

The server loads a built-in 30,000-node circuit dataset (`mock-circuit-v1`) on startup (~10 s).
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

### Data Management
- Upload node/edge CSV files or GraphML graphs (single or folder-based multi-graph)
- Automatic feature engineering: z-score normalisation + one-hot encoding for cell type
- Graph statistics explorer with correlation heatmaps and distribution charts

### AutoML Training
- 5 GNN architectures: **GCN**, **GAT**, **GraphSAGE**, **GIN**, **MLP** (baseline)
- Optuna searches over: model type, hidden dim (32–256), layers (2–5), dropout, learning rate
- Real-time training progress via polling
- Best config and full leaderboard returned after each run

### Evaluation & Reports
- Per-model accuracy, F1, loss metrics
- Node-level explanation viewer (feature attribution)
- Exportable JSON report

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/upload` | Upload dataset CSV/GraphML |
| `GET` | `/api/v1/datasets` | List all datasets |
| `GET` | `/api/v1/datasets/{id}/explore` | Dataset statistics & feature info |
| `POST` | `/api/v1/tasks` | Start an AutoML training task |
| `GET` | `/api/v1/tasks` | List all tasks |
| `GET` | `/api/v1/tasks/{id}` | Task status & progress |
| `GET` | `/api/v1/tasks/{id}/report` | Full evaluation report |
| `GET` | `/api/v1/tasks/{id}/explain` | Node explanation / attribution |

Full interactive spec: **http://localhost:8000/docs**

---

## Dataset Format

### Node CSV (`nodes.csv`)

| Column | Type | Notes |
|---|---|---|
| `node_id` | string/int | Unique identifier |
| `cell_type` | categorical | `Logic`, `Buffer`, `Register`, `Port` |
| `x`, `y` | float | Placement coordinates |
| `width`, `height` | float | Cell dimensions |
| `timing_slack` | float | Timing margin |
| `fanin`, `fanout` | int | Connectivity |
| `label` | int | Ground-truth class |

### Edge CSV (`edges.csv`)

| Column | Type | Notes |
|---|---|---|
| `src` | string/int | Source node ID |
| `dst` | string/int | Destination node ID |

---

## Development

### Run Tests

```bash
cd backend
uv run pytest tests/ -v
```

### Frontend Tests

```bash
cd frontend
npm test
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
