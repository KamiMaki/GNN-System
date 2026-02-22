import io
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import torch
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.core import store
from app.core.config import settings
from app.data.feature_engineering import (
    analyze_categorical_column,
    analyze_numeric_column,
    compute_correlation,
    compute_generic_explore,
    detect_column_type,
    impute_column,
    validate_label,
)
from app.data.ingestion import parse_csv_pair_generic
from app.data.pyg_converter import dataframes_to_pyg_dynamic
from app.schemas.api_models import (
    ConfirmDataRequest,
    CorrelationRequest,
    CreateProjectRequest,
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
from app.training.pipeline import run_training_task

router = APIRouter(prefix="/projects", tags=["projects"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _project_or_404(project_id: str) -> dict:
    project = store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _dataset_for_project(project: dict) -> dict:
    ds_id = project.get("dataset_id")
    if not ds_id:
        raise HTTPException(status_code=400, detail="No dataset uploaded for this project")
    ds = store.get_dataset(ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


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
        current_step=p.get("current_step", 1),
        status=p.get("status", "created"),
        dataset_id=p.get("dataset_id"),
        task_id=p.get("task_id"),
    )


# ── CRUD ──

@router.post("/", response_model=ProjectSummary)
async def create_project(body: CreateProjectRequest):
    project_id = str(uuid.uuid4())
    record = {
        "project_id": project_id,
        "name": body.name,
        "tags": body.tags,
        "created_at": _now_iso(),
        "current_step": 1,
        "status": "created",
        "dataset_id": None,
        "task_type": None,
        "label_column": None,
        "imputation_log": [],
        "training_config": None,
        "task_id": None,
        "task_ids": [],
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
    """List available demo datasets."""
    return DEMO_DATASETS


# ── Sample Data (must be before /{project_id} routes) ──

@router.get("/sample-data")
async def download_sample_data():
    """Generate and return a zip file with example nodes.csv and edges.csv."""
    import pandas as pd
    import random

    random.seed(42)

    nodes_data = {
        "node_id": list(range(1, 51)),
        "name": [f"cell_{i}" for i in range(1, 51)],
        "cell_type": (["Logic"] * 20 + ["Buffer"] * 15 + ["Register"] * 10 + ["Port"] * 5),
        "logic_depth": [i % 8 + 1 for i in range(50)],
        "fanout": [max(1, (i * 3) % 15) for i in range(50)],
        "fan_in": [max(1, (i * 2) % 8) for i in range(50)],
        "slack_ns": [round(-0.5 + i * 0.02, 3) for i in range(50)],
        "cell_delay_ps": [round(10 + i * 0.5, 1) for i in range(50)],
        "drive_strength": [round(1 + (i % 5) * 0.5, 1) for i in range(50)],
        "cell_area_um2": [round(0.5 + i * 0.1, 2) for i in range(50)],
        "congestion_score": [round((i % 10) * 0.1, 2) for i in range(50)],
        "is_critical": [1 if i < 15 else 0 for i in range(50)],
    }

    edges_data = {"src_id": [], "dst_id": [], "wire_cap_ff": [], "wire_length_um": []}
    for i in range(1, 51):
        n_edges = random.randint(1, 3)
        for _ in range(n_edges):
            dst = random.randint(1, 50)
            if dst != i:
                edges_data["src_id"].append(i)
                edges_data["dst_id"].append(dst)
                edges_data["wire_cap_ff"].append(round(random.uniform(0.1, 5.0), 2))
                edges_data["wire_length_um"].append(round(random.uniform(1.0, 100.0), 1))

    nodes_df = pd.DataFrame(nodes_data)
    edges_df = pd.DataFrame(edges_data)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("nodes.csv", nodes_df.to_csv(index=False))
        zf.writestr("edges.csv", edges_df.to_csv(index=False))
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

    # Attach dataset summary if available
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

    # Attach task status if available
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


# ── Step 1: Upload Data ──


def _ingest_single_graph(
    name: str,
    nodes_train_bytes: bytes,
    edges_train_bytes: bytes,
    nodes_test_bytes: bytes | None = None,
    edges_test_bytes: bytes | None = None,
) -> dict:
    """Parse and split a single graph. Returns a dataset record dict (without dataset_id)."""
    parsed = parse_csv_pair_generic(nodes_train_bytes, edges_train_bytes, name)

    if nodes_test_bytes and edges_test_bytes:
        parsed_test = parse_csv_pair_generic(nodes_test_bytes, edges_test_bytes, name + "-test")
        nodes_df_train = parsed["nodes_df"]
        nodes_df_test = parsed_test["nodes_df"]
        edges_df_train = parsed["edges_df"]
        edges_df_test = parsed_test["edges_df"]
        total_nodes = len(nodes_df_train) + len(nodes_df_test)
        total_edges = len(edges_df_train) + len(edges_df_test)
    else:
        nodes_df = parsed["nodes_df"]
        edges_df = parsed["edges_df"]
        num_nodes = len(nodes_df)

        perm = torch.randperm(num_nodes)
        split_idx = int(num_nodes * 0.8)
        train_indices = perm[:split_idx].numpy()
        test_indices = perm[split_idx:].numpy()

        nodes_df_train = nodes_df.iloc[train_indices].reset_index(drop=True)
        nodes_df_test = nodes_df.iloc[test_indices].reset_index(drop=True)

        train_node_ids = set(nodes_df_train["node_id"].values)
        test_node_ids = set(nodes_df_test["node_id"].values)

        edges_df_train = edges_df[
            edges_df["src_id"].isin(train_node_ids) & edges_df["dst_id"].isin(train_node_ids)
        ].reset_index(drop=True)
        edges_df_test = edges_df[
            edges_df["src_id"].isin(test_node_ids) & edges_df["dst_id"].isin(test_node_ids)
        ].reset_index(drop=True)

        total_nodes = num_nodes
        total_edges = len(edges_df)

    explore_stats = compute_generic_explore(nodes_df_train, edges_df_train)
    num_features = len([c for c in explore_stats["columns"] if c["dtype"] == "numeric"])

    return {
        "name": name,
        "num_nodes": total_nodes,
        "num_edges": total_edges,
        "num_features": num_features,
        "num_classes": 0,
        "is_directed": True,
        "task_type": "pending",
        "nodes_df_train": nodes_df_train,
        "nodes_df_test": nodes_df_test,
        "edges_df_train": edges_df_train,
        "edges_df_test": edges_df_test,
        "explore_stats": explore_stats,
    }


@router.post("/{project_id}/load-demo", response_model=DatasetSummary)
async def load_demo_data(project_id: str, demo_id: str = Query(default="basic")):
    """Load a built-in demo dataset into a project.

    demo_id options: basic, edge_attrs, multigraph, dirty
    """
    import pandas as pd

    _project_or_404(project_id)

    mock_dir = Path(__file__).resolve().parent.parent.parent / "mock_data"

    # Map demo_id to directory
    DEMO_DIRS = {
        "basic": mock_dir / "demo_basic",
        "edge_attrs": mock_dir / "demo_edge_attrs",
        "multigraph": mock_dir / "demo_multigraph",
        "dirty": mock_dir / "demo_dirty",
    }

    # Fallback: original mock data
    if demo_id not in DEMO_DIRS:
        demo_dir = mock_dir
    else:
        demo_dir = DEMO_DIRS[demo_id]

    if not demo_dir.exists():
        raise HTTPException(status_code=404, detail=f"Demo data '{demo_id}' not found on server")

    try:
        if demo_id == "multigraph":
            # Multi-graph: iterate subdirectories
            all_nodes_train = []
            all_edges_train = []
            graph_names = sorted([
                d.name for d in demo_dir.iterdir() if d.is_dir()
            ])
            if not graph_names:
                raise HTTPException(status_code=404, detail="No graph subdirectories found")

            for gname in graph_names:
                gdir = demo_dir / gname
                nt = gdir / "nodes_train.csv"
                et = gdir / "edges_train.csv"
                if not nt.exists() or not et.exists():
                    continue
                record = _ingest_single_graph(gname, nt.read_bytes(), et.read_bytes())
                record["nodes_df_train"]["_graph"] = gname
                record["nodes_df_test"]["_graph"] = gname
                record["edges_df_train"]["_graph"] = gname
                record["edges_df_test"]["_graph"] = gname
                all_nodes_train.append(record["nodes_df_train"])
                all_edges_train.append(record["edges_df_train"])

            merged_nodes = pd.concat(all_nodes_train, ignore_index=True)
            merged_edges = pd.concat(all_edges_train, ignore_index=True)
            explore_stats = compute_generic_explore(merged_nodes, merged_edges)
            num_features = len([c for c in explore_stats["columns"] if c["dtype"] == "numeric"])

            dataset_id = str(uuid.uuid4())
            ds_record = {
                "dataset_id": dataset_id,
                "name": f"demo-multigraph ({len(graph_names)} graphs)",
                "num_nodes": len(merged_nodes),
                "num_edges": len(merged_edges),
                "num_features": num_features,
                "num_classes": 0,
                "is_directed": True,
                "task_type": "pending",
                "nodes_df_train": merged_nodes,
                "nodes_df_test": pd.DataFrame(),
                "edges_df_train": merged_edges,
                "edges_df_test": pd.DataFrame(),
                "explore_stats": explore_stats,
                "graph_names": graph_names,
            }
            store.put_dataset(dataset_id, ds_record)

        else:
            # Single graph demo
            nodes_train_path = demo_dir / "nodes_train.csv"
            edges_train_path = demo_dir / "edges_train.csv"
            nodes_test_path = demo_dir / "nodes_test.csv"
            edges_test_path = demo_dir / "edges_test.csv"

            if not nodes_train_path.exists() or not edges_train_path.exists():
                raise HTTPException(status_code=404, detail="Demo data not found on server")

            nodes_test_bytes = nodes_test_path.read_bytes() if nodes_test_path.exists() else None
            edges_test_bytes = edges_test_path.read_bytes() if edges_test_path.exists() else None

            demo_name = f"demo-{demo_id}"
            record = _ingest_single_graph(
                demo_name,
                nodes_train_path.read_bytes(),
                edges_train_path.read_bytes(),
                nodes_test_bytes,
                edges_test_bytes,
            )

            dataset_id = str(uuid.uuid4())
            record["dataset_id"] = dataset_id
            ds_record = record

            store.put_dataset(dataset_id, ds_record)

        store.update_project(
            project_id,
            dataset_id=dataset_id,
            current_step=2,
            status="data_uploaded",
        )

        # Check for edge attrs
        has_edge_attrs = False
        edges_df = ds_record.get("edges_df_train")
        if edges_df is not None and len(edges_df.columns) > 0:
            edge_feature_cols = [c for c in edges_df.columns if c not in ("src_id", "dst_id", "_graph")]
            has_edge_attrs = len(edge_feature_cols) > 0

        return DatasetSummary(
            dataset_id=dataset_id,
            name=ds_record["name"],
            num_nodes=ds_record["num_nodes"],
            num_edges=ds_record["num_edges"],
            num_features=ds_record.get("num_features", 0),
            num_classes=0,
            is_directed=True,
            task_type="pending",
            has_edge_attrs=has_edge_attrs,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{project_id}/upload", response_model=DatasetSummary)
async def upload_project_data(
    project_id: str,
    nodes_file: UploadFile = File(...),
    edges_file: UploadFile = File(...),
    dataset_name: str = Form(default=""),
    nodes_test_file: UploadFile = File(None),
    edges_test_file: UploadFile = File(None),
):
    _project_or_404(project_id)

    try:
        nodes_bytes = await nodes_file.read()
        edges_bytes = await edges_file.read()
        name = dataset_name or nodes_file.filename.replace(".csv", "")

        has_test_files = (
            nodes_test_file is not None
            and edges_test_file is not None
            and nodes_test_file.filename
            and edges_test_file.filename
        )

        nodes_test_bytes = None
        edges_test_bytes = None
        if has_test_files:
            nodes_test_bytes = await nodes_test_file.read()
            edges_test_bytes = await edges_test_file.read()

        record = _ingest_single_graph(name, nodes_bytes, edges_bytes, nodes_test_bytes, edges_test_bytes)
        dataset_id = str(uuid.uuid4())
        record["dataset_id"] = dataset_id
        store.put_dataset(dataset_id, record)

        store.update_project(
            project_id,
            dataset_id=dataset_id,
            current_step=2,
            status="data_uploaded",
        )

        return DatasetSummary(
            dataset_id=dataset_id,
            name=record["name"],
            num_nodes=record["num_nodes"],
            num_edges=record["num_edges"],
            num_features=record["num_features"],
            num_classes=0,
            is_directed=True,
            task_type="pending",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{project_id}/upload-folder", response_model=DatasetSummary)
async def upload_project_folder(
    project_id: str,
    files: list[UploadFile] = File(...),
    dataset_name: str = Form(default=""),
):
    """Upload a folder of graph data files.

    Expected structure (via webkitdirectory):
      project_folder/
        graph_A/
          nodes_train.csv
          edges_train.csv
          nodes_test.csv   (optional)
          edges_test.csv   (optional)
        graph_B/
          ...

    Or flat (single graph):
      project_folder/
        nodes_train.csv
        edges_train.csv
    """
    import pandas as pd

    _project_or_404(project_id)

    # Organize files by their relative path
    file_map: dict[str, dict[str, bytes]] = {}  # graph_name -> {filename: bytes}
    root_files: dict[str, bytes] = {}

    for f in files:
        if not f.filename:
            continue
        # webkitdirectory gives paths like "folder/subfolder/file.csv"
        parts = f.filename.replace("\\", "/").split("/")
        content = await f.read()

        if len(parts) >= 3:
            # Has subfolder: parts[-2] is graph name, parts[-1] is filename
            graph_name = parts[-2]
            fname = parts[-1].lower()
            if graph_name not in file_map:
                file_map[graph_name] = {}
            file_map[graph_name][fname] = content
        elif len(parts) == 2:
            # Flat structure: parts[-1] is filename
            fname = parts[-1].lower()
            root_files[fname] = content
        else:
            fname = parts[0].lower()
            root_files[fname] = content

    # If only root-level files, treat as single graph
    if root_files and not file_map:
        file_map["default"] = root_files

    if not file_map:
        raise HTTPException(status_code=422, detail="No valid CSV files found in upload")

    try:
        all_nodes_train = []
        all_edges_train = []
        all_nodes_test = []
        all_edges_test = []
        graph_names = sorted(file_map.keys())

        for gname in graph_names:
            gfiles = file_map[gname]

            # Find nodes_train and edges_train files
            nodes_train_bytes = gfiles.get("nodes_train.csv") or gfiles.get("node_train.csv")
            edges_train_bytes = gfiles.get("edges_train.csv") or gfiles.get("edge_train.csv")

            if not nodes_train_bytes or not edges_train_bytes:
                raise ValueError(
                    f"Graph '{gname}' missing required files. "
                    f"Expected nodes_train.csv and edges_train.csv. "
                    f"Found: {list(gfiles.keys())}"
                )

            nodes_test_bytes = gfiles.get("nodes_test.csv") or gfiles.get("node_test.csv")
            edges_test_bytes = gfiles.get("edges_test.csv") or gfiles.get("edge_test.csv")

            record = _ingest_single_graph(
                gname,
                nodes_train_bytes,
                edges_train_bytes,
                nodes_test_bytes,
                edges_test_bytes,
            )

            # Add graph_id column so graphs can be distinguished
            record["nodes_df_train"]["_graph"] = gname
            record["nodes_df_test"]["_graph"] = gname
            record["edges_df_train"]["_graph"] = gname
            record["edges_df_test"]["_graph"] = gname

            all_nodes_train.append(record["nodes_df_train"])
            all_edges_train.append(record["edges_df_train"])
            all_nodes_test.append(record["nodes_df_test"])
            all_edges_test.append(record["edges_df_test"])

        # Merge all graphs
        merged_nodes_train = pd.concat(all_nodes_train, ignore_index=True)
        merged_edges_train = pd.concat(all_edges_train, ignore_index=True)
        merged_nodes_test = pd.concat(all_nodes_test, ignore_index=True)
        merged_edges_test = pd.concat(all_edges_test, ignore_index=True)

        merged_explore = compute_generic_explore(merged_nodes_train, merged_edges_train)
        num_features = len([c for c in merged_explore["columns"] if c["dtype"] == "numeric"])

        ds_name = dataset_name or (graph_names[0] if len(graph_names) == 1 else f"{len(graph_names)}-graphs")

        dataset_id = str(uuid.uuid4())
        record = {
            "dataset_id": dataset_id,
            "name": ds_name,
            "num_nodes": len(merged_nodes_train) + len(merged_nodes_test),
            "num_edges": len(merged_edges_train) + len(merged_edges_test),
            "num_features": num_features,
            "num_classes": 0,
            "is_directed": True,
            "task_type": "pending",
            "nodes_df_train": merged_nodes_train,
            "nodes_df_test": merged_nodes_test,
            "edges_df_train": merged_edges_train,
            "edges_df_test": merged_edges_test,
            "explore_stats": merged_explore,
            "graph_names": graph_names,
        }
        store.put_dataset(dataset_id, record)

        store.update_project(
            project_id,
            dataset_id=dataset_id,
            current_step=2,
            status="data_uploaded",
        )

        return DatasetSummary(
            dataset_id=dataset_id,
            name=ds_name,
            num_nodes=record["num_nodes"],
            num_edges=record["num_edges"],
            num_features=num_features,
            num_classes=0,
            is_directed=True,
            task_type="pending",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Step 2: Data Analysis ──

@router.get("/{project_id}/explore", response_model=GenericExploreData)
async def explore_project_data(project_id: str):
    project = _project_or_404(project_id)
    ds = _dataset_for_project(project)
    stats = ds.get("explore_stats")
    if not stats:
        raise HTTPException(status_code=400, detail="Explore stats not computed yet")
    return stats


@router.get("/{project_id}/columns/{column_name}")
async def analyze_column(
    project_id: str,
    column_name: str,
    override_type: Optional[str] = Query(None),
):
    project = _project_or_404(project_id)
    ds = _dataset_for_project(project)
    nodes_df = ds["nodes_df_train"]

    if column_name not in nodes_df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

    series = nodes_df[column_name]
    col_type = override_type or detect_column_type(series)

    if col_type == "numeric":
        return analyze_numeric_column(series)
    else:
        return analyze_categorical_column(series)


@router.post("/{project_id}/correlation")
async def get_correlation_endpoint(project_id: str, body: CorrelationRequest):
    project = _project_or_404(project_id)
    ds = _dataset_for_project(project)
    nodes_df = ds["nodes_df_train"]
    return compute_correlation(nodes_df, body.columns)


@router.post("/{project_id}/validate-label", response_model=LabelValidationResult)
async def validate_label_endpoint(project_id: str, body: LabelValidationRequest):
    project = _project_or_404(project_id)
    ds = _dataset_for_project(project)
    nodes_df = ds["nodes_df_train"]
    result = validate_label(nodes_df, body.label_column, body.task_type)
    return result


@router.post("/{project_id}/impute", response_model=ImputationResult)
async def impute_missing_endpoint(project_id: str, body: ImputationRequest):
    project = _project_or_404(project_id)
    ds = _dataset_for_project(project)

    # Impute in both train and test DataFrames
    nodes_df_train = ds["nodes_df_train"]
    nodes_df_test = ds["nodes_df_test"]

    nodes_df_train, filled_train = impute_column(nodes_df_train, body.column, body.method)
    nodes_df_test, filled_test = impute_column(nodes_df_test, body.column, body.method)

    # Update in store
    ds["nodes_df_train"] = nodes_df_train
    ds["nodes_df_test"] = nodes_df_test

    # Refresh explore stats
    ds["explore_stats"] = compute_generic_explore(nodes_df_train, ds["edges_df_train"])
    store.put_dataset(ds["dataset_id"], ds)

    # Log imputation
    project = store.get_project(project_id)
    log = project.get("imputation_log", [])
    log.append({"column": body.column, "method": body.method, "filled_count": filled_train})
    store.update_project(project_id, imputation_log=log)

    return ImputationResult(
        column=body.column,
        filled_count=filled_train,
        method=body.method,
    )


@router.post("/{project_id}/confirm", response_model=ProjectSummary)
async def confirm_data(project_id: str, body: ConfirmDataRequest):
    project = _project_or_404(project_id)
    ds = _dataset_for_project(project)

    # Validate label one more time
    result = validate_label(ds["nodes_df_train"], body.label_column, body.task_type)
    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Check for remaining missing values in label column
    label_missing = int(ds["nodes_df_train"][body.label_column].isna().sum())
    if label_missing > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Label column '{body.label_column}' still has {label_missing} missing values.",
        )

    # Update project
    store.update_project(
        project_id,
        task_type=body.task_type,
        label_column=body.label_column,
        current_step=3,
        status="data_confirmed",
    )

    # Update dataset task_type and num_classes
    num_classes = result.get("num_classes", 1) or 1
    ds["task_type"] = body.task_type
    ds["num_classes"] = num_classes
    store.put_dataset(ds["dataset_id"], ds)

    return _to_summary(store.get_project(project_id))


# ── Step 3: Training ──

@router.get("/{project_id}/estimate", response_model=TrainingEstimate)
async def estimate_training_time(
    project_id: str,
    n_trials: int = Query(default=150),
):
    project = _project_or_404(project_id)
    ds = _dataset_for_project(project)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    num_nodes = ds["num_nodes"]

    # Check historical data
    history = store.get_training_history()
    if history:
        # Average time per trial per 1000 nodes from history
        rates = []
        for h in history:
            if h.get("n_trials", 0) > 0 and h.get("num_nodes", 0) > 0:
                rate = h["duration_seconds"] / h["n_trials"] / (h["num_nodes"] / 1000)
                rates.append(rate)
        if rates:
            avg_rate = sum(rates) / len(rates)
            estimated = avg_rate * n_trials * (num_nodes / 1000)
            return TrainingEstimate(estimated_seconds=round(estimated, 1), device=device)

    # Cold start rough estimate (A100 assumption)
    if device == "cuda":
        seconds_per_trial = 2.0 + num_nodes / 10000 * 1.5
    else:
        seconds_per_trial = 8.0 + num_nodes / 10000 * 6.0

    estimated = seconds_per_trial * n_trials
    return TrainingEstimate(estimated_seconds=round(estimated, 1), device=device)


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
    task_type = project["task_type"]
    dataset_id = project["dataset_id"]
    label_column = project["label_column"]

    device = "cuda" if torch.cuda.is_available() else "cpu"

    started_at = _now_iso()
    task_record = {
        "task_id": task_id,
        "project_id": project_id,
        "dataset_id": dataset_id,
        "task_type": task_type,
        "label_column": label_column,
        "status": "QUEUED",
        "progress": 0,
        "current_trial": 0,
        "total_trials": body.n_trials,
        "device": device,
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

    # Append to task_ids list for experiment history
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

    background_tasks.add_task(run_training_task, task_id)

    return TaskStatus(
        task_id=task_id,
        project_id=project_id,
        status="QUEUED",
        progress=0,
        current_trial=0,
        total_trials=body.n_trials,
        device=device,
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
    """List all training runs for a project."""
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
    """Get report for a specific training run."""
    _project_or_404(project_id)
    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Training not completed yet")
    report = task.get("report")
    if not report:
        raise HTTPException(status_code=404, detail="Report not available")
    return report
