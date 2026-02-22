import uuid

from fastapi import APIRouter, HTTPException

from app.core import store
from app.schemas.api_models import (
    CreateTaskRequest,
    Report,
    TaskStatus,
)
from app.training.celery_tasks import run_training_celery

router = APIRouter()


@router.post("/tasks", response_model=TaskStatus)
async def create_task(body: CreateTaskRequest):
    """Create a training task (legacy endpoint). Returns immediately with QUEUED status."""
    dataset = store.get_dataset(body.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {body.dataset_id} not found")

    task_id = str(uuid.uuid4())
    task_record = {
        "task_id": task_id,
        "dataset_id": body.dataset_id,
        "task_type": body.task_type,
        "status": "QUEUED",
        "progress": 0,
        "results": None,
        "report": None,
        "history": [],
        "error": None,
    }
    store.put_task(task_id, task_record)

    run_training_celery.delay(task_id)

    return TaskStatus(task_id=task_id, status="QUEUED", progress=0)


@router.get("/tasks", response_model=list[TaskStatus])
async def list_tasks():
    """List all tasks."""
    return [
        TaskStatus(
            task_id=t.get("task_id", t.get("_id")),
            status=t["status"],
            progress=t["progress"],
            current_trial=t.get("current_trial"),
            total_trials=t.get("total_trials"),
            device=t.get("device"),
            results=t.get("results"),
            best_config=t.get("best_config"),
        )
        for t in store.list_tasks()
    ]


@router.get("/tasks/{task_id}", response_model=TaskStatus)
async def get_task(task_id: str):
    """Get task status."""
    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatus(
        task_id=task.get("task_id", task.get("_id")),
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
    """Get training report. Only available when task is COMPLETED."""
    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["status"] != "COMPLETED":
        raise HTTPException(status_code=409, detail=f"Task not completed: {task['status']}")
    if not task.get("report"):
        raise HTTPException(status_code=404, detail="Report not available")
    return task["report"]
