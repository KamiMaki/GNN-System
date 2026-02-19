import uuid
import shutil
from pathlib import Path
import torch
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(
    prefix="/data",
    tags=["Data Management"],
)

# Define the base path to the data directory
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Handles uploading of a graph dataset file.
    A unique ID is generated for the dataset.
    """
    try:
        # Generate a unique ID for the dataset
        dataset_id = f"{uuid.uuid4()}.pt"
        file_path = DATA_DIR / dataset_id

        # Save the uploaded file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {"message": "Dataset uploaded successfully", "dataset_id": dataset_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")
    finally:
        file.file.close()


@router.get("/explore/{dataset_id}")
async def explore_dataset(dataset_id: str):
    """
    Loads a dataset and returns its summary statistics.
    """
    try:
        file_path = DATA_DIR / dataset_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Load the PyTorch Geometric data object
        data = torch.load(file_path)

        # Extract statistics
        stats = {
            "dataset_id": dataset_id,
            "num_nodes": data.num_nodes,
            "num_edges": data.num_edges,
            "num_features": data.num_node_features,
            "num_classes": data.y.max().item() + 1 if data.y is not None else "N/A",
            "is_directed": data.is_directed(),
            "avg_degree": data.num_edges / data.num_nodes if data.num_nodes > 0 else 0,
            "has_isolated_nodes": data.has_isolated_nodes(),
            "has_self_loops": data.has_self_loops(),
            "feature_stats": {
                 "min": data.x.min().item() if data.x is not None else None,
                 "max": data.x.max().item() if data.x is not None else None,
                 "mean": data.x.mean().item() if data.x is not None else None,
                 "std": data.x.std().item() if data.x is not None else None,
            } if data.x is not None else None
        }
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read or analyze dataset: {str(e)}")
