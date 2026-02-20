import pytorch_lightning as pl

from app.models.gcn import GCNClassifier
from app.models.gat import GATClassifier
from app.models.sage import SAGEClassifier
from app.models.gin import GINClassifier
from app.models.mlp import MLPClassifier


MODEL_REGISTRY: dict[str, type[pl.LightningModule]] = {
    "gcn": GCNClassifier,
    "gat": GATClassifier,
    "sage": SAGEClassifier,
    "gin": GINClassifier,
    "mlp": MLPClassifier,
}


def get_model(
    model_name: str,
    num_features: int,
    num_classes: int = 2,
    task_type: str = "node_classification",
    **kwargs,
) -> pl.LightningModule:
    if model_name not in MODEL_REGISTRY:
        raise ValueError(f"Unknown model: {model_name}. Choose from {list(MODEL_REGISTRY)}")
    return MODEL_REGISTRY[model_name](
        num_features=num_features,
        num_classes=num_classes,
        task_type=task_type,
        **kwargs,
    )
