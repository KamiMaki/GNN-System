import uuid
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException

from .training import jobs, jobs_lock, training_worker
from .data import DATA_DIR

router = APIRouter(
    prefix="/demo",
    tags=["Demo Mode"],
)

MOCK_DATASET_FILENAME = "cora.pt"

@router.get("/start")
async def start_demo(background_tasks: BackgroundTasks):
    """
    Starts a full demo sequence:
    1. Finds the mock 'cora.pt' dataset.
    2. Creates a "dataset_id" for it (which is just its filename for the demo).
    3. Starts a training job with that dataset.
    4. Returns the job_id to the client.
    """
    # 1. Check if mock data exists
    mock_data_path = DATA_DIR / MOCK_DATASET_FILENAME
    if not mock_data_path.exists():
        raise HTTPException(
            status_code=404, 
            detail=f"Mock data '{MOCK_DATASET_FILENAME}' not found. Please run 'generate_mock_data.py' in the backend."
        )

    # 2. Use its filename as the dataset_id for the demo
    dataset_id = MOCK_DATASET_FILENAME

    # 3. Start a training job (logic copied from training.py)
    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            "status": "queued",
            "dataset_id": dataset_id
        }
    
    background_tasks.add_task(training_worker, job_id, dataset_id)
    
    # 4. Return the job_id
    return {"message": "Demo training job started", "job_id": job_id}
