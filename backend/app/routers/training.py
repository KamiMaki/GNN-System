import uuid
import time
from pathlib import Path
from threading import Lock

import torch
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from autogl.solver import AutoNodeClassifier
from autogl.datasets import utils

# In-memory storage for job status and results.
# For a production system, use Redis or a database.
jobs = {}
jobs_lock = Lock()

router = APIRouter(
    prefix="/training",
    tags=["Model Training"],
)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

class TrainingRequest(BaseModel):
    dataset_id: str
    task: str = "node_classification"
    # In the future, we can add model choices, hyperparameter ranges, etc.

def training_worker(job_id: str, dataset_id: str):
    """
    The actual training function that runs in the background.
    """
    try:
        with jobs_lock:
            jobs[job_id]["status"] = "running"
            jobs[job_id]["start_time"] = time.time()

        # Load data
        file_path = DATA_DIR / dataset_id
        if not file_path.exists():
            raise FileNotFoundError("Dataset file not found.")
        
        data = torch.load(file_path)
        
        # Fix for AutoGL compatibility if dataset is not pre-split
        if data.train_mask.dim() > 1:
            data.train_mask = data.train_mask[:, 0]
            data.val_mask = data.val_mask[:, 0]
            data.test_mask = data.test_mask[:, 0]

        # Initialize AutoGL solver
        solver = AutoNodeClassifier(
            feature_module=None,
            graph_module=None,
            model_module="gat", # Using a single model for simplicity
            hpo_module=None,
            ensemble_module=None,
        )

        # Run training
        solver.fit(data)
        
        # Evaluate on the test set
        acc = solver.evaluate(metric="acc")
        
        end_time = time.time()
        
        # Save the trained solver object itself
        model_path = MODELS_DIR / f"{job_id}.pt"
        torch.save(solver, model_path)

        # Save results
        with jobs_lock:
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["end_time"] = end_time
            jobs[job_id]["model_path"] = str(model_path)
            jobs[job_id]["results"] = {
                "accuracy": acc,
                "training_time_seconds": round(end_time - jobs[job_id]["start_time"], 2)
            }

    except Exception as e:
        with jobs_lock:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = str(e)
            jobs[job_id]["end_time"] = time.time()


@router.post("/train")
async def start_training(req: TrainingRequest, background_tasks: BackgroundTasks):
    """
    Starts a new training job in the background.
    """
    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            "status": "queued",
            "dataset_id": req.dataset_id  # Store the dataset_id
        }
    
    background_tasks.add_task(training_worker, job_id, req.dataset_id)
    
    return {"message": "Training job started", "job_id": job_id}


@router.get("/status/{job_id}")
async def get_job_status(job_id: str):
    """
    Retrieves the status and results of a training job.
    """
    with jobs_lock:
        job = jobs.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] == "completed":
        return {
            "job_id": job_id,
            "status": job["status"],
            "results": job.get("results")
        }
    elif job["status"] == "failed":
         return {
            "job_id": job_id,
            "status": job["status"],
            "error": job.get("error")
        }
    else:
        return {"job_id": job_id, "status": job["status"]}

