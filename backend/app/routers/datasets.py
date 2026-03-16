import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core import store
from app.schemas.api_models import DatasetSummary, ExploreData

router = APIRouter()


@router.post("/upload", response_model=DatasetSummary)
async def upload_dataset(
    nodes_file: UploadFile = File(...),
    edges_file: UploadFile = File(...),
    dataset_name: str = Form(default=""),
    task_type: str = Form(
        default="node_classification",
        pattern=r"^(node_classification|node_regression|graph_classification|graph_regression)$",
    ),
    nodes_test_file: UploadFile = File(None),
    edges_test_file: UploadFile = File(None),
):
    """Upload nodes CSV + edges CSV (mock). Returns a mock DatasetSummary."""
    name = dataset_name or (nodes_file.filename or "unnamed").replace(".csv", "")
    num_classes = 2 if task_type in ("node_classification", "graph_classification") else 1

    dataset_id = str(uuid.uuid4())
    record = {
        "dataset_id": dataset_id,
        "name": name,
        "num_nodes": 400,
        "num_edges": 800,
        "num_features": 8,
        "num_classes": num_classes,
        "is_directed": True,
        "task_type": task_type,
        "explore_stats": _mock_legacy_explore(),
    }
    store.put_dataset(dataset_id, record)

    return DatasetSummary(
        dataset_id=dataset_id,
        name=name,
        num_nodes=record["num_nodes"],
        num_edges=record["num_edges"],
        num_features=record["num_features"],
        num_classes=num_classes,
        is_directed=True,
        task_type=task_type,
    )


@router.get("/datasets", response_model=list[DatasetSummary])
async def list_datasets():
    all_datasets = store.list_datasets()
    return [
        DatasetSummary(
            dataset_id=d["dataset_id"],
            name=d["name"],
            num_nodes=d["num_nodes"],
            num_edges=d["num_edges"],
            num_features=d.get("num_features", 8),
            num_classes=d.get("num_classes", 2),
            is_directed=d.get("is_directed", True),
            task_type=d.get("task_type", "node_classification"),
        )
        for d in all_datasets
    ]


@router.get("/datasets/{dataset_id}/explore", response_model=ExploreData)
async def explore_dataset(dataset_id: str):
    dataset = store.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset.get("explore_stats", _mock_legacy_explore())


def _mock_legacy_explore() -> dict:
    """Generate mock legacy explore data."""
    return {
        "fanout_dist": [
            {"range": "1-2", "count": 120},
            {"range": "3-4", "count": 95},
            {"range": "5-6", "count": 78},
            {"range": "7-8", "count": 55},
            {"range": "9+", "count": 52},
        ],
        "slack_dist": [
            {"range": "<-0.5", "count": 30},
            {"range": "-0.5~0", "count": 85},
            {"range": "0~0.5", "count": 140},
            {"range": "0.5~1.0", "count": 100},
            {"range": ">1.0", "count": 45},
        ],
        "cell_type_dist": [
            {"name": "Logic", "value": 200},
            {"name": "Buffer", "value": 100},
            {"name": "Register", "value": 70},
            {"name": "Port", "value": 30},
        ],
        "feature_correlation": [
            {"x": "fanout", "y": "logic_depth", "value": 0.42},
            {"x": "fanout", "y": "slack_ns", "value": -0.35},
            {"x": "logic_depth", "y": "slack_ns", "value": -0.68},
            {"x": "fanout", "y": "congestion_score", "value": 0.55},
            {"x": "logic_depth", "y": "congestion_score", "value": 0.72},
            {"x": "slack_ns", "y": "congestion_score", "value": -0.48},
        ],
        "critical_paths_table": [
            {"node_id": 1, "name": "cell_1", "cell_type": "Logic", "slack_ns": -0.45, "logic_depth": 7, "congestion_score": 0.92, "is_critical": 1},
            {"node_id": 15, "name": "cell_15", "cell_type": "Buffer", "slack_ns": -0.32, "logic_depth": 6, "congestion_score": 0.88, "is_critical": 1},
            {"node_id": 8, "name": "cell_8", "cell_type": "Logic", "slack_ns": -0.28, "logic_depth": 5, "congestion_score": 0.85, "is_critical": 1},
            {"node_id": 22, "name": "cell_22", "cell_type": "Register", "slack_ns": -0.15, "logic_depth": 4, "congestion_score": 0.78, "is_critical": 1},
            {"node_id": 37, "name": "cell_37", "cell_type": "Logic", "slack_ns": -0.08, "logic_depth": 3, "congestion_score": 0.71, "is_critical": 1},
        ],
        "radar_data": [
            {"subject": "Fanout", "A": 72, "fullMark": 100},
            {"subject": "Logic Depth", "A": 85, "fullMark": 100},
            {"subject": "Slack", "A": 45, "fullMark": 100},
            {"subject": "Congestion", "A": 68, "fullMark": 100},
            {"subject": "Drive Strength", "A": 55, "fullMark": 100},
        ],
    }
