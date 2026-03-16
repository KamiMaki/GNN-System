import io
import uuid
import zipfile
import random
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.core import store
from app.schemas.api_models import (
    ConfirmDataRequest,
    CorrelationRequest,
    CreateProjectRequest,
    UpdateProjectRequest,
    DatasetSummary,
    GenericExploreData,
    ImputationRequest,
    ImputationResult,
    LabelValidationRequest,
    LabelValidationResult,
    ProjectDetail,
    ProjectSummary,
    StartTrainingRequest,
    TaskStatus,
    TrainingEstimate,
    Report,
)
from app.routers._mock_training import run_mock_training

router = APIRouter(prefix="/projects", tags=["projects"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _project_or_404(project_id: str) -> dict:
    project = store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _task_to_status(task: dict, project_id: str) -> TaskStatus:
    return TaskStatus(
        task_id=task["task_id"],
        project_id=project_id,
        status=task["status"],
        progress=task.get("progress", 0),
        current_trial=task.get("current_trial"),
        total_trials=task.get("total_trials"),
        device=task.get("device"),
        results=task.get("results"),
        best_config=task.get("best_config"),
        started_at=task.get("started_at"),
        completed_at=task.get("completed_at"),
    )


def _to_summary(p: dict) -> ProjectSummary:
    return ProjectSummary(
        project_id=p["project_id"],
        name=p["name"],
        tags=p.get("tags", []),
        created_at=p["created_at"],
        updated_at=p.get("updated_at", p["created_at"]),
        current_step=p.get("current_step", 1),
        status=p.get("status", "created"),
        dataset_id=p.get("dataset_id"),
        task_id=p.get("task_id"),
    )


# ── Mock Data Generators ──

MOCK_NODE_COLUMNS = [
    {"name": "node_id", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 400},
    {"name": "name", "dtype": "categorical", "missing_count": 0, "missing_pct": 0.0, "unique_count": 400},
    {"name": "cell_type", "dtype": "categorical", "missing_count": 0, "missing_pct": 0.0, "unique_count": 4},
    {"name": "logic_depth", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 8},
    {"name": "fanout", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 14},
    {"name": "fan_in", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 7},
    {"name": "slack_ns", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 400},
    {"name": "cell_delay_ps", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 400},
    {"name": "drive_strength", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 5},
    {"name": "cell_area_um2", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 400},
    {"name": "congestion_score", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 10},
    {"name": "is_critical", "dtype": "categorical", "missing_count": 0, "missing_pct": 0.0, "unique_count": 2},
]

MOCK_EDGE_COLUMNS = [
    {"name": "src_id", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 350},
    {"name": "dst_id", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 380},
    {"name": "wire_cap_ff", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 800},
    {"name": "wire_length_um", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 800},
]

MOCK_DIRTY_COLUMNS = [
    {"name": "node_id", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 400},
    {"name": "name", "dtype": "categorical", "missing_count": 0, "missing_pct": 0.0, "unique_count": 400},
    {"name": "cell_type", "dtype": "categorical", "missing_count": 5, "missing_pct": 1.25, "unique_count": 4},
    {"name": "logic_depth", "dtype": "numeric", "missing_count": 12, "missing_pct": 3.0, "unique_count": 8},
    {"name": "fanout", "dtype": "numeric", "missing_count": 8, "missing_pct": 2.0, "unique_count": 14},
    {"name": "fan_in", "dtype": "numeric", "missing_count": 3, "missing_pct": 0.75, "unique_count": 7},
    {"name": "slack_ns", "dtype": "numeric", "missing_count": 15, "missing_pct": 3.75, "unique_count": 385},
    {"name": "cell_delay_ps", "dtype": "numeric", "missing_count": 7, "missing_pct": 1.75, "unique_count": 393},
    {"name": "drive_strength", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 5},
    {"name": "cell_area_um2", "dtype": "numeric", "missing_count": 0, "missing_pct": 0.0, "unique_count": 400},
    {"name": "congestion_score", "dtype": "numeric", "missing_count": 10, "missing_pct": 2.5, "unique_count": 10},
    {"name": "is_critical", "dtype": "categorical", "missing_count": 0, "missing_pct": 0.0, "unique_count": 2},
]

CORRELATION_COLS = ["logic_depth", "fanout", "fan_in", "slack_ns", "cell_delay_ps", "drive_strength", "cell_area_um2", "congestion_score"]

MOCK_CORRELATION = [
    {"x": "logic_depth", "y": "logic_depth", "value": 1.0},
    {"x": "logic_depth", "y": "fanout", "value": 0.42},
    {"x": "logic_depth", "y": "slack_ns", "value": -0.68},
    {"x": "logic_depth", "y": "congestion_score", "value": 0.72},
    {"x": "fanout", "y": "logic_depth", "value": 0.42},
    {"x": "fanout", "y": "fanout", "value": 1.0},
    {"x": "fanout", "y": "slack_ns", "value": -0.35},
    {"x": "fanout", "y": "congestion_score", "value": 0.55},
    {"x": "slack_ns", "y": "logic_depth", "value": -0.68},
    {"x": "slack_ns", "y": "fanout", "value": -0.35},
    {"x": "slack_ns", "y": "slack_ns", "value": 1.0},
    {"x": "slack_ns", "y": "congestion_score", "value": -0.48},
    {"x": "congestion_score", "y": "logic_depth", "value": 0.72},
    {"x": "congestion_score", "y": "fanout", "value": 0.55},
    {"x": "congestion_score", "y": "slack_ns", "value": -0.48},
    {"x": "congestion_score", "y": "congestion_score", "value": 1.0},
    {"x": "fan_in", "y": "fan_in", "value": 1.0},
    {"x": "fan_in", "y": "fanout", "value": 0.31},
    {"x": "fanout", "y": "fan_in", "value": 0.31},
    {"x": "cell_delay_ps", "y": "cell_delay_ps", "value": 1.0},
    {"x": "cell_delay_ps", "y": "logic_depth", "value": 0.58},
    {"x": "logic_depth", "y": "cell_delay_ps", "value": 0.58},
    {"x": "drive_strength", "y": "drive_strength", "value": 1.0},
    {"x": "cell_area_um2", "y": "cell_area_um2", "value": 1.0},
    {"x": "cell_area_um2", "y": "drive_strength", "value": 0.65},
    {"x": "drive_strength", "y": "cell_area_um2", "value": 0.65},
]


def _mock_explore(demo_id: str = "basic") -> dict:
    columns = MOCK_DIRTY_COLUMNS if demo_id == "dirty" else MOCK_NODE_COLUMNS
    return {
        "num_nodes": 400,
        "num_edges": 800,
        "columns": columns,
        "edge_columns": MOCK_EDGE_COLUMNS,
        "feature_correlation": MOCK_CORRELATION,
        "correlation_columns": CORRELATION_COLS,
    }


# ── CRUD ──

@router.post("/", response_model=ProjectSummary)
async def create_project(body: CreateProjectRequest):
    project_id = str(uuid.uuid4())
    now = _now_iso()
    record = {
        "project_id": project_id,
        "name": body.name,
        "tags": body.tags,
        "created_at": now,
        "updated_at": now,
        "current_step": 1,
        "status": "created",
        "dataset_id": None,
        "task_type": None,
        "label_column": None,
        "imputation_log": [],
        "training_config": None,
        "task_id": None,
        "task_ids": [],
        "_demo_id": None,
    }
    store.put_project(project_id, record)
    return _to_summary(record)


@router.get("/", response_model=list[ProjectSummary])
async def list_projects_endpoint():
    projects = store.list_projects()
    return [_to_summary(p) for p in projects]


# ── Demo Datasets (must be before /{project_id} routes) ──

DEMO_DATASETS = [
    {
        "id": "basic",
        "name": "Basic Circuit",
        "description": "Simple node classification with clean data (400 nodes)",
        "nodes": 400,
        "edges": 800,
        "tags": ["single-graph", "clean"],
    },
    {
        "id": "edge_attrs",
        "name": "Edge Attributes",
        "description": "Graph with extra edge features: routing layer, resistance, coupling capacitance",
        "nodes": 330,
        "edges": 660,
        "tags": ["edge-features"],
    },
    {
        "id": "multigraph",
        "name": "Multi-Graph",
        "description": "3 separate circuit graphs (graph_A, graph_B, graph_C)",
        "nodes": 350,
        "edges": 700,
        "tags": ["multi-graph"],
    },
    {
        "id": "dirty",
        "name": "Dirty Data",
        "description": "Missing values (~5%), outliers, and mixed-type columns for testing error handling",
        "nodes": 400,
        "edges": 800,
        "tags": ["missing-data", "outliers"],
    },
]


@router.get("/demo-datasets")
async def list_demo_datasets():
    return DEMO_DATASETS


# ── Sample Data (must be before /{project_id} routes) ──

@router.get("/sample-data")
async def download_sample_data():
    """Generate and return a zip file with example nodes.csv and edges.csv."""
    random.seed(42)

    # Build CSV strings directly (no pandas needed)
    node_headers = "node_id,name,cell_type,logic_depth,fanout,fan_in,slack_ns,cell_delay_ps,drive_strength,cell_area_um2,congestion_score,is_critical"
    cell_types = ["Logic"] * 20 + ["Buffer"] * 15 + ["Register"] * 10 + ["Port"] * 5
    node_rows = [node_headers]
    for i in range(50):
        node_rows.append(
            f"{i+1},cell_{i+1},{cell_types[i]},{i%8+1},{max(1,(i*3)%15)},{max(1,(i*2)%8)},"
            f"{round(-0.5+i*0.02,3)},{round(10+i*0.5,1)},{round(1+(i%5)*0.5,1)},"
            f"{round(0.5+i*0.1,2)},{round((i%10)*0.1,2)},{1 if i<15 else 0}"
        )
    nodes_csv = "\n".join(node_rows)

    edge_headers = "src_id,dst_id,wire_cap_ff,wire_length_um"
    edge_rows = [edge_headers]
    for i in range(1, 51):
        n_edges = random.randint(1, 3)
        for _ in range(n_edges):
            dst = random.randint(1, 50)
            if dst != i:
                edge_rows.append(
                    f"{i},{dst},{round(random.uniform(0.1,5.0),2)},{round(random.uniform(1.0,100.0),1)}"
                )
    edges_csv = "\n".join(edge_rows)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("nodes.csv", nodes_csv)
        zf.writestr("edges.csv", edges_csv)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=sample_graph_data.zip"},
    )


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: str):
    p = _project_or_404(project_id)

    detail = ProjectDetail(
        project_id=p["project_id"],
        name=p["name"],
        tags=p.get("tags", []),
        created_at=p["created_at"],
        current_step=p.get("current_step", 1),
        status=p.get("status", "created"),
        dataset_id=p.get("dataset_id"),
        task_id=p.get("task_id"),
        task_type=p.get("task_type"),
        label_column=p.get("label_column"),
    )

    if p.get("dataset_id"):
        ds = store.get_dataset(p["dataset_id"])
        if ds:
            detail.dataset_summary = DatasetSummary(
                dataset_id=ds["dataset_id"],
                name=ds["name"],
                num_nodes=ds["num_nodes"],
                num_edges=ds["num_edges"],
                num_features=ds.get("num_features", 0),
                num_classes=ds.get("num_classes", 0),
                is_directed=ds.get("is_directed", True),
                task_type=ds.get("task_type", "node_classification"),
            )

    if p.get("task_id"):
        task = store.get_task(p["task_id"])
        if task:
            detail.task_status = _task_to_status(task, project_id)

    return detail


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    _project_or_404(project_id)
    store.delete_project(project_id)
    return {"detail": "Project deleted"}


@router.patch("/{project_id}", response_model=ProjectSummary)
async def update_project(project_id: str, body: UpdateProjectRequest):
    _project_or_404(project_id)
    updates: dict = {"updated_at": _now_iso()}
    if body.name is not None:
        updates["name"] = body.name
    if body.tags is not None:
        updates["tags"] = body.tags
    store.update_project(project_id, **updates)
    return _to_summary(store.get_project(project_id))


# ── Step 1: Upload Data ──

@router.post("/{project_id}/load-demo", response_model=DatasetSummary)
async def load_demo_data(project_id: str, demo_id: str = Query(default="basic")):
    """Load a built-in demo dataset (mock)."""
    _project_or_404(project_id)

    DEMO_INFO = {
        "basic": ("demo-basic", 400, 800),
        "edge_attrs": ("demo-edge_attrs", 330, 660),
        "multigraph": ("demo-multigraph (3 graphs)", 350, 700),
        "dirty": ("demo-dirty", 400, 800),
    }

    if demo_id not in DEMO_INFO:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid demo_id '{demo_id}'. Must be one of: {', '.join(DEMO_INFO)}",
        )

    name, num_nodes, num_edges = DEMO_INFO[demo_id]
    has_edge_attrs = demo_id == "edge_attrs"

    dataset_id = str(uuid.uuid4())
    ds_record = {
        "dataset_id": dataset_id,
        "name": name,
        "num_nodes": num_nodes,
        "num_edges": num_edges,
        "num_features": 8,
        "num_classes": 0,
        "is_directed": True,
        "task_type": "pending",
        "explore_stats": _mock_explore(demo_id),
        "_demo_id": demo_id,
    }
    store.put_dataset(dataset_id, ds_record)

    store.update_project(
        project_id,
        dataset_id=dataset_id,
        current_step=2,
        status="data_uploaded",
        _demo_id=demo_id,
    )

    return DatasetSummary(
        dataset_id=dataset_id,
        name=name,
        num_nodes=num_nodes,
        num_edges=num_edges,
        num_features=8,
        num_classes=0,
        is_directed=True,
        task_type="pending",
        has_edge_attrs=has_edge_attrs,
    )


@router.post("/{project_id}/upload", response_model=DatasetSummary)
async def upload_project_data(
    project_id: str,
    nodes_file: UploadFile = File(...),
    edges_file: UploadFile = File(...),
    dataset_name: str = Form(default=""),
    nodes_test_file: UploadFile = File(None),
    edges_test_file: UploadFile = File(None),
):
    """Upload data (mock) - accepts files but returns mock summary."""
    _project_or_404(project_id)

    name = dataset_name or (nodes_file.filename or "unnamed").replace(".csv", "")
    dataset_id = str(uuid.uuid4())

    ds_record = {
        "dataset_id": dataset_id,
        "name": name,
        "num_nodes": 400,
        "num_edges": 800,
        "num_features": 8,
        "num_classes": 0,
        "is_directed": True,
        "task_type": "pending",
        "explore_stats": _mock_explore(),
    }
    store.put_dataset(dataset_id, ds_record)

    store.update_project(
        project_id,
        dataset_id=dataset_id,
        current_step=2,
        status="data_uploaded",
    )

    return DatasetSummary(
        dataset_id=dataset_id,
        name=name,
        num_nodes=400,
        num_edges=800,
        num_features=8,
        num_classes=0,
        is_directed=True,
        task_type="pending",
    )


@router.post("/{project_id}/upload-folder", response_model=DatasetSummary)
async def upload_project_folder(
    project_id: str,
    files: list[UploadFile] = File(...),
    dataset_name: str = Form(default=""),
):
    """Upload folder (mock) - accepts files but returns mock summary."""
    _project_or_404(project_id)

    name = dataset_name or "uploaded-graphs"
    dataset_id = str(uuid.uuid4())

    ds_record = {
        "dataset_id": dataset_id,
        "name": name,
        "num_nodes": 350,
        "num_edges": 700,
        "num_features": 8,
        "num_classes": 0,
        "is_directed": True,
        "task_type": "pending",
        "explore_stats": _mock_explore(),
    }
    store.put_dataset(dataset_id, ds_record)

    store.update_project(
        project_id,
        dataset_id=dataset_id,
        current_step=2,
        status="data_uploaded",
    )

    return DatasetSummary(
        dataset_id=dataset_id,
        name=name,
        num_nodes=350,
        num_edges=700,
        num_features=8,
        num_classes=0,
        is_directed=True,
        task_type="pending",
    )


# ── Step 2: Data Analysis ──

@router.get("/{project_id}/explore", response_model=GenericExploreData)
async def explore_project_data(project_id: str):
    project = _project_or_404(project_id)
    ds_id = project.get("dataset_id")
    if not ds_id:
        raise HTTPException(status_code=400, detail="No dataset uploaded for this project")
    ds = store.get_dataset(ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds.get("explore_stats", _mock_explore())


@router.get("/{project_id}/columns/{column_name}")
async def analyze_column_endpoint(
    project_id: str,
    column_name: str,
    override_type: Optional[str] = Query(None),
):
    _project_or_404(project_id)

    # Determine column type
    numeric_cols = {"node_id", "logic_depth", "fanout", "fan_in", "slack_ns",
                    "cell_delay_ps", "drive_strength", "cell_area_um2", "congestion_score",
                    "wire_cap_ff", "wire_length_um"}
    categorical_cols = {"name", "cell_type", "is_critical"}

    col_type = override_type
    if not col_type:
        if column_name in numeric_cols:
            col_type = "numeric"
        elif column_name in categorical_cols:
            col_type = "categorical"
        else:
            col_type = "numeric"

    if col_type == "numeric":
        return _mock_numeric_stats(column_name)
    else:
        return _mock_categorical_stats(column_name)


def _mock_numeric_stats(column_name: str) -> dict:
    stats_map = {
        "logic_depth": {"mean": 4.5, "median": 4.0, "std": 2.3, "min": 1, "max": 8, "q1": 2, "q3": 6, "outlier_count": 0},
        "fanout": {"mean": 5.2, "median": 4.0, "std": 3.8, "min": 1, "max": 14, "q1": 2, "q3": 8, "outlier_count": 3},
        "fan_in": {"mean": 3.1, "median": 3.0, "std": 1.9, "min": 1, "max": 7, "q1": 2, "q3": 5, "outlier_count": 0},
        "slack_ns": {"mean": 0.12, "median": 0.15, "std": 0.45, "min": -0.5, "max": 0.98, "q1": -0.15, "q3": 0.42, "outlier_count": 5},
        "cell_delay_ps": {"mean": 22.5, "median": 22.0, "std": 7.2, "min": 10, "max": 35, "q1": 16, "q3": 29, "outlier_count": 2},
        "drive_strength": {"mean": 2.0, "median": 2.0, "std": 0.7, "min": 1.0, "max": 3.0, "q1": 1.5, "q3": 2.5, "outlier_count": 0},
        "cell_area_um2": {"mean": 3.0, "median": 2.8, "std": 1.5, "min": 0.5, "max": 5.5, "q1": 1.8, "q3": 4.0, "outlier_count": 1},
        "congestion_score": {"mean": 0.45, "median": 0.45, "std": 0.29, "min": 0.0, "max": 0.9, "q1": 0.2, "q3": 0.7, "outlier_count": 0},
    }

    base = stats_map.get(column_name, {
        "mean": 50.0, "median": 48.0, "std": 15.0, "min": 0, "max": 100,
        "q1": 35, "q3": 65, "outlier_count": 2
    })

    # Generate distribution bins
    range_min = base["min"]
    range_max = base["max"]
    step = (range_max - range_min) / 10
    distribution = []
    for i in range(10):
        low = round(range_min + step * i, 2)
        high = round(range_min + step * (i + 1), 2)
        # Bell curve-ish distribution
        dist_from_center = abs(i - 4.5)
        count = max(5, int(60 - dist_from_center * 10 + random.randint(-5, 5)))
        distribution.append({"range": f"{low}~{high}", "count": count})

    return {
        "column": column_name,
        "dtype": "numeric",
        **base,
        "distribution": distribution,
    }


def _mock_categorical_stats(column_name: str) -> dict:
    if column_name == "cell_type":
        value_counts = [
            {"name": "Logic", "count": 200},
            {"name": "Buffer", "count": 100},
            {"name": "Register", "count": 70},
            {"name": "Port", "count": 30},
        ]
        return {"column": column_name, "dtype": "categorical", "value_counts": value_counts, "top_value": "Logic", "top_count": 200}
    elif column_name == "is_critical":
        value_counts = [{"name": "0", "count": 280}, {"name": "1", "count": 120}]
        return {"column": column_name, "dtype": "categorical", "value_counts": value_counts, "top_value": "0", "top_count": 280}
    else:
        value_counts = [{"name": f"val_{i}", "count": 100 - i * 10} for i in range(5)]
        return {"column": column_name, "dtype": "categorical", "value_counts": value_counts, "top_value": "val_0", "top_count": 100}


@router.post("/{project_id}/correlation")
async def get_correlation_endpoint(project_id: str, body: CorrelationRequest):
    _project_or_404(project_id)

    # Filter mock correlation to requested columns
    requested = set(body.columns)
    result = [
        entry for entry in MOCK_CORRELATION
        if entry["x"] in requested and entry["y"] in requested
    ]

    # Fill in missing pairs with small random values
    for x in body.columns:
        for y in body.columns:
            if not any(e["x"] == x and e["y"] == y for e in result):
                val = 1.0 if x == y else round(random.uniform(-0.3, 0.3), 2)
                result.append({"x": x, "y": y, "value": val})

    return result


@router.post("/{project_id}/validate-label", response_model=LabelValidationResult)
async def validate_label_endpoint(project_id: str, body: LabelValidationRequest):
    _project_or_404(project_id)

    is_classification = "classification" in body.task_type

    if is_classification:
        return LabelValidationResult(
            valid=True,
            message=f"Column '{body.label_column}' is valid for {body.task_type}",
            num_classes=2,
            class_distribution=[
                {"label": "0", "count": 280},
                {"label": "1", "count": 120},
            ],
            is_continuous=False,
        )
    else:
        return LabelValidationResult(
            valid=True,
            message=f"Column '{body.label_column}' is valid for {body.task_type}",
            value_range={"min": 0.0, "max": 0.9, "mean": 0.45, "std": 0.29},
            is_continuous=True,
        )


@router.post("/{project_id}/impute", response_model=ImputationResult)
async def impute_missing_endpoint(project_id: str, body: ImputationRequest):
    project = _project_or_404(project_id)

    # Return mock imputation result
    filled_count = random.randint(5, 20)

    # Log imputation
    log = project.get("imputation_log", [])
    log.append({"column": body.column, "method": body.method, "filled_count": filled_count})
    store.update_project(project_id, imputation_log=log)

    # Update explore stats to show 0 missing for this column
    ds_id = project.get("dataset_id")
    if ds_id:
        ds = store.get_dataset(ds_id)
        if ds and "explore_stats" in ds:
            for col in ds["explore_stats"].get("columns", []):
                if col["name"] == body.column:
                    col["missing_count"] = 0
                    col["missing_pct"] = 0.0
            store.put_dataset(ds_id, ds)

    return ImputationResult(
        column=body.column,
        filled_count=filled_count,
        method=body.method,
    )


@router.post("/{project_id}/confirm", response_model=ProjectSummary)
async def confirm_data(project_id: str, body: ConfirmDataRequest):
    project = _project_or_404(project_id)
    ds_id = project.get("dataset_id")
    if not ds_id:
        raise HTTPException(status_code=400, detail="No dataset uploaded for this project")

    store.update_project(
        project_id,
        task_type=body.task_type,
        label_column=body.label_column,
        current_step=3,
        status="data_confirmed",
        updated_at=_now_iso(),
    )

    # Update dataset
    ds = store.get_dataset(ds_id)
    if ds:
        num_classes = 2 if "classification" in body.task_type else 1
        ds["task_type"] = body.task_type
        ds["num_classes"] = num_classes
        store.put_dataset(ds_id, ds)

    return _to_summary(store.get_project(project_id))


# ── Step 3: Training ──

@router.get("/{project_id}/estimate", response_model=TrainingEstimate)
async def estimate_training_time(
    project_id: str,
    n_trials: int = Query(default=150),
):
    _project_or_404(project_id)
    # Mock estimate: ~2 seconds per trial on CPU
    estimated = round(n_trials * 0.5, 1)
    return TrainingEstimate(estimated_seconds=estimated, device="cpu")


@router.post("/{project_id}/train", response_model=TaskStatus)
async def start_training(
    project_id: str,
    body: StartTrainingRequest,
    background_tasks: BackgroundTasks,
):
    project = _project_or_404(project_id)

    if project.get("current_step", 1) < 3:
        raise HTTPException(status_code=400, detail="Data must be confirmed before training")

    task_id = str(uuid.uuid4())
    task_type = project.get("task_type", "node_classification")
    started_at = _now_iso()

    task_record = {
        "task_id": task_id,
        "project_id": project_id,
        "dataset_id": project.get("dataset_id"),
        "task_type": task_type,
        "label_column": project.get("label_column"),
        "status": "QUEUED",
        "progress": 0,
        "current_trial": 0,
        "total_trials": body.n_trials,
        "device": "cpu",
        "results": None,
        "report": None,
        "history": [],
        "error": None,
        "best_config": None,
        "models": body.models if body.models else None,
        "n_trials": body.n_trials,
        "started_at": started_at,
        "completed_at": None,
    }
    store.put_task(task_id, task_record)

    task_ids = project.get("task_ids", [])
    task_ids.append(task_id)

    store.update_project(
        project_id,
        task_id=task_id,
        task_ids=task_ids,
        training_config={"models": body.models, "n_trials": body.n_trials},
        current_step=3,
        status="training",
    )

    background_tasks.add_task(run_mock_training, task_id)

    return TaskStatus(
        task_id=task_id,
        project_id=project_id,
        status="QUEUED",
        progress=0,
        current_trial=0,
        total_trials=body.n_trials,
        device="cpu",
        started_at=started_at,
    )


@router.get("/{project_id}/status", response_model=TaskStatus)
async def get_project_status(project_id: str):
    project = _project_or_404(project_id)
    task_id = project.get("task_id")
    if not task_id:
        raise HTTPException(status_code=400, detail="No training task for this project")

    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return _task_to_status(task, project_id)


# ── Experiment History ──

@router.get("/{project_id}/experiments", response_model=list[TaskStatus])
async def list_experiments(project_id: str):
    project = _project_or_404(project_id)
    task_ids = project.get("task_ids", [])
    results = []
    for tid in task_ids:
        task = store.get_task(tid)
        if task:
            results.append(_task_to_status(task, project_id))
    return results


# ── Step 4: Report ──

@router.get("/{project_id}/report", response_model=Report)
async def get_project_report(project_id: str):
    project = _project_or_404(project_id)
    task_id = project.get("task_id")
    if not task_id:
        raise HTTPException(status_code=400, detail="No training task for this project")

    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Training not completed yet")

    report = task.get("report")
    if not report:
        raise HTTPException(status_code=404, detail="Report not available")

    return report


@router.get("/{project_id}/report/{task_id}", response_model=Report)
async def get_experiment_report(project_id: str, task_id: str):
    project = _project_or_404(project_id)
    if task_id not in project.get("task_ids", []):
        raise HTTPException(status_code=404, detail="Task not found for this project")
    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Training not completed yet")
    report = task.get("report")
    if not report:
        raise HTTPException(status_code=404, detail="Report not available")
    return report
