"""Mock training simulation - replaces real ML pipeline with timed progress updates."""

import asyncio
import time
import random
from datetime import datetime, timezone

from app.core import store


def _mock_report(task_type: str) -> dict:
    """Generate a realistic-looking mock report."""
    is_classification = "classification" in task_type

    if is_classification:
        train_metrics = {
            "accuracy": 0.934,
            "f1_score": 0.928,
            "precision": 0.941,
            "recall": 0.916,
            "mse": None,
            "mae": None,
            "r2_score": None,
        }
        test_metrics = {
            "accuracy": 0.891,
            "f1_score": 0.882,
            "precision": 0.903,
            "recall": 0.862,
            "mse": None,
            "mae": None,
            "r2_score": None,
        }
        confusion_matrix = {
            "labels": ["0", "1"],
            "matrix": [[142, 18], [25, 115]],
        }
        residual_data = None
    else:
        train_metrics = {
            "accuracy": None,
            "f1_score": None,
            "precision": None,
            "recall": None,
            "mse": 0.0142,
            "mae": 0.0891,
            "r2_score": 0.923,
        }
        test_metrics = {
            "accuracy": None,
            "f1_score": None,
            "precision": None,
            "recall": None,
            "mse": 0.0198,
            "mae": 0.1053,
            "r2_score": 0.887,
        }
        confusion_matrix = None
        residual_data = [
            {"actual": round(random.uniform(0, 1), 3), "predicted": round(random.uniform(0, 1), 3)}
            for _ in range(50)
        ]

    # Generate training history (30 epochs)
    history = []
    base_loss = 0.85
    for epoch in range(1, 31):
        loss = max(0.05, base_loss * (0.88 ** epoch) + random.uniform(-0.02, 0.02))
        val_loss = max(0.08, base_loss * (0.86 ** epoch) + random.uniform(-0.03, 0.03))
        entry = {"epoch": epoch, "loss": round(loss, 4), "val_loss": round(val_loss, 4)}
        if is_classification:
            entry["accuracy"] = round(min(0.95, 0.5 + epoch * 0.015 + random.uniform(-0.01, 0.01)), 4)
        history.append(entry)

    # Leaderboard (top 10 trials)
    models = ["GCN", "GAT", "GraphSAGE", "GIN", "MLP"]
    leaderboard = []
    for i in range(10):
        model = models[i % 5]
        leaderboard.append({
            "trial": i + 1,
            "model": model,
            "hidden_dim": random.choice([32, 64, 128, 256]),
            "num_layers": random.randint(2, 5),
            "dropout": round(random.uniform(0.1, 0.5), 2),
            "lr": round(random.uniform(0.0001, 0.01), 4),
            "val_loss": round(0.08 + i * 0.012 + random.uniform(0, 0.01), 4),
        })
    leaderboard.sort(key=lambda x: x["val_loss"])

    return {
        "task_type": task_type,
        "train_metrics": train_metrics,
        "val_metrics": None,
        "test_metrics": test_metrics,
        "history": history,
        "confusion_matrix": confusion_matrix,
        "residual_data": residual_data,
        "best_config": {
            "model_name": "GAT",
            "hidden_dim": 128,
            "num_layers": 3,
            "dropout": 0.3,
            "lr": 0.001,
        },
        "leaderboard": leaderboard,
    }


async def run_mock_training(task_id: str):
    """Simulate training progress over ~15 seconds."""
    task = store.get_task(task_id)
    if not task:
        return

    task_type = task.get("task_type", "node_classification")
    total_trials = task.get("total_trials", 30)

    # Preprocessing phase
    store.update_task(task_id, status="PREPROCESSING", progress=5)
    await asyncio.sleep(1)

    store.update_task(task_id, status="TRAINING", progress=10)

    # Simulate trials
    steps = min(total_trials, 20)
    for i in range(1, steps + 1):
        progress = 10 + int(80 * i / steps)
        store.update_task(
            task_id,
            progress=progress,
            current_trial=int(total_trials * i / steps),
        )
        await asyncio.sleep(0.5)

    # Complete
    report = _mock_report(task_type)
    results = {
        "train_metrics": report["train_metrics"],
        "test_metrics": report["test_metrics"],
        "training_time_seconds": 14.5,
    }

    store.update_task(
        task_id,
        status="COMPLETED",
        progress=100,
        current_trial=total_trials,
        results=results,
        report=report,
        best_config=report["best_config"],
        completed_at=datetime.now(timezone.utc).isoformat(),
    )

    # Update project status if linked
    project_id = task.get("project_id")
    if project_id:
        store.update_project(project_id, current_step=4, status="completed")
