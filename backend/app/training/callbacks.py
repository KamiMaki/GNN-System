import pytorch_lightning as pl
from app.core import store


class ProgressCallback(pl.Callback):
    """Updates the task store after each epoch with progress and history."""

    def __init__(self, task_id: str, max_epochs: int, task_type: str = "node_classification"):
        self.task_id = task_id
        self.max_epochs = max_epochs
        self.task_type = task_type
        self.history: list[dict] = []

    def on_validation_epoch_end(self, trainer: pl.Trainer, pl_module: pl.LightningModule) -> None:
        epoch = trainer.current_epoch
        metrics = trainer.callback_metrics
        loss = float(metrics.get("train_loss", 0.0))
        val_loss = float(metrics.get("val_loss", 0.0))
        progress = int(((epoch + 1) / self.max_epochs) * 100)

        is_classification = not self.task_type.endswith("regression")
        acc = None
        if is_classification:
            acc = round(float(metrics.get("val_acc", metrics.get("train_acc", 0.0))), 4)

        entry = {
            "epoch": epoch + 1,
            "loss": round(loss, 4),
            "val_loss": round(val_loss, 4),
            "accuracy": acc,
        }
        self.history.append(entry)

        store.update_task(
            self.task_id,
            progress=min(50 + int(progress * 0.49), 99),  # Map 0-100% training to 50-99% overall
            status="TRAINING",
            history=list(self.history),
        )
