"""Read-only training-task endpoints.

Task creation is owned by the projects router (POST /projects/{id}/train);
this module only exposes list / get / report endpoints for convenience.
"""
from fastapi import APIRouter, HTTPException

from app.core import store
from app.schemas.api_models import Report, TaskStatus

router = APIRouter()


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
