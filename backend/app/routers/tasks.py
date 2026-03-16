import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.core import store
from app.schemas.api_models import Report, TaskStatus
from app.routers._mock_training import run_mock_training

router = APIRouter()


@router.post("/tasks", response_model=TaskStatus)
async def create_task(body: dict, background_tasks: BackgroundTasks):
    """Create a training task (legacy, mock). Returns immediately with QUEUED status."""
    dataset_id = body.get("dataset_id", "")
    dataset = store.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")

    task_id = str(uuid.uuid4())
    task_record = {
        "task_id": task_id,
        "dataset_id": dataset_id,
        "task_type": body.get("task_type", "node_classification"),
        "status": "QUEUED",
        "progress": 0,
        "current_trial": 0,
        "total_trials": 30,
        "device": "cpu",
        "results": None,
        "report": None,
        "history": [],
        "error": None,
        "best_config": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    }
    store.put_task(task_id, task_record)

    background_tasks.add_task(run_mock_training, task_id)

    return TaskStatus(task_id=task_id, status="QUEUED", progress=0)


@router.get("/tasks", response_model=list[TaskStatus])
async def list_tasks():
    all_tasks = store.list_tasks()
    return [
        TaskStatus(
            task_id=t["task_id"],
            status=t["status"],
            progress=t["progress"],
            current_trial=t.get("current_trial"),
            total_trials=t.get("total_trials"),
            device=t.get("device"),
            results=t.get("results"),
            best_config=t.get("best_config"),
        )
        for t in all_tasks
    ]


@router.get("/tasks/{task_id}", response_model=TaskStatus)
async def get_task(task_id: str):
    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatus(
        task_id=task["task_id"],
        status=task["status"],
        progress=task["progress"],
        current_trial=task.get("current_trial"),
        total_trials=task.get("total_trials"),
        device=task.get("device"),
        results=task.get("results"),
        best_config=task.get("best_config"),
    )


@router.get("/tasks/{task_id}/report", response_model=Report)
async def get_report(task_id: str):
    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["status"] != "COMPLETED":
        raise HTTPException(status_code=409, detail=f"Task not completed: {task['status']}")
    if not task.get("report"):
        raise HTTPException(status_code=404, detail="Report not available")
    return task["report"]
