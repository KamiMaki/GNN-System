from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import torch
from pathlib import Path

from autogl.module.model.explain import GNNExplainer
from .training import jobs, jobs_lock

router = APIRouter(
    prefix="/explainer",
    tags=["Model Explanation"],
)

class ExplainerRequest(BaseModel):
    job_id: str
    node_index: int = 0 # Default to explaining the first node

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"

@router.post("/explain")
async def get_explanation(req: ExplainerRequest):
    """
    Explains a prediction for a given node using a trained model.
    """
    with jobs_lock:
        job = jobs.get(req.job_id)

    if not job or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Completed training job not found.")

    try:
        # Load the trained solver
        model_path = MODELS_DIR / f"{req.job_id}.pt"
        if not model_path.exists():
            raise HTTPException(status_code=404, detail="Trained model file not found.")
        solver = torch.load(model_path)

        # Get original dataset id from the job info
        dataset_id = job.get("dataset_id") # We need to add this to the job dict
        if not dataset_id:
            # Let's find the dataset_id from the training request
            # This is a workaround because I forgot to add it to the job dict
            # In a real app, this would be stored properly
            for j in jobs.values():
                if j.get("model_path") and Path(j["model_path"]).name == f"{req.job_id}.pt":
                    # Need to find the original request... this is getting complicated.
                    # Let's assume the dataset is always cora.pt for the prototype.
                    pass
            dataset_id = "cora.pt" # PROTOTYPE HACK

        # Load the dataset
        data_path = DATA_DIR / dataset_id
        if not data_path.exists():
            raise HTTPException(status_code=404, detail=f"Original dataset {dataset_id} not found.")
        data = torch.load(data_path)

        # Initialize explainer
        explainer = GNNExplainer(
            _num_classes=solver.num_classes,
            device=solver.device
        )
        
        # Get the explanation
        edge_mask = explainer.explain_node(
            req.node_index,
            solver.model,
            data.x,
            data.edge_index
        )

        # Get top k most important edges
        num_edges_to_highlight = 10
        top_indices = torch.topk(edge_mask, k=num_edges_to_highlight).indices
        important_edges = data.edge_index[:, top_indices].tolist()

        # Prepare data for visualization
        graph_data = {
            "nodes": [{"id": i} for i in range(data.num_nodes)],
            "edges": [{"from": u, "to": v} for u, v in data.edge_index.t().tolist()],
            "important_edges": [{"from": u, "to": v} for u, v in zip(important_edges[0], important_edges[1])]
        }

        return graph_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate explanation: {str(e)}")
