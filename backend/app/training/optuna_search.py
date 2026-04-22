"""Optuna hyperparameter search with per-trial early stopping."""
from __future__ import annotations

from typing import Optional

import optuna
import pytorch_lightning as pl
import torch
from torch_geometric.data import Data
from torch_geometric.loader import DataLoader

from app.core.config import settings
from app.models.factory import get_model, HOMO_REGISTRY as MODEL_REGISTRY
from app.training.callbacks import TrialProgressCallback


def _trainer_kwargs(accelerator: str, precision: str) -> dict:
    return {
        "max_epochs": settings.MAX_HPO_EPOCHS,
        "accelerator": accelerator,
        "devices": 1,
        "precision": precision,
        "gradient_clip_val": settings.GRADIENT_CLIP,
        "enable_progress_bar": False,
        "enable_model_summary": False,
        "enable_checkpointing": False,
        "logger": False,
    }


def run_hpo(
    train_data: Data,
    val_data: Data,
    num_features: int,
    n_trials: int = 20,
    class_weights: torch.Tensor | None = None,
    task_type: str = "node_classification",
    models: Optional[list[str]] = None,
    task_id: Optional[str] = None,
    accelerator: str = "auto",
    precision: str = "32-true",
) -> dict:
    """Run Optuna HPO. Returns best hyperparameter dict + leaderboard.

    Each trial uses an `EarlyStopping` callback on ``val_loss`` so bad
    configurations abort quickly. The study also uses a ``MedianPruner``.
    """
    is_regression = task_type.endswith("regression")
    num_classes = 1 if is_regression else 2

    available_models = list(MODEL_REGISTRY.keys())
    if models:
        search_models = [m for m in models if m in available_models] or available_models
    else:
        search_models = available_models

    def objective(trial: optuna.Trial) -> float:
        model_name = trial.suggest_categorical("model", search_models)
        hidden_dim = trial.suggest_categorical("hidden_dim", [32, 64, 128, 256])
        num_layers = trial.suggest_int("num_layers", 2, 5)
        dropout = trial.suggest_float("dropout", 0.1, 0.5)
        lr = trial.suggest_float("lr", 1e-4, 1e-2, log=True)

        model_kwargs = dict(
            num_features=num_features, num_classes=num_classes,
            hidden_dim=hidden_dim, num_layers=num_layers,
            dropout=dropout, lr=lr, task_type=task_type,
        )
        if not is_regression:
            model_kwargs["class_weights"] = class_weights

        model = get_model(model_name, **model_kwargs)

        train_loader = DataLoader([train_data], batch_size=1, shuffle=False)
        val_loader = DataLoader([val_data], batch_size=1, shuffle=False)

        early_stop = pl.callbacks.EarlyStopping(
            monitor="val_loss", patience=settings.HPO_PATIENCE, mode="min",
        )
        trainer = pl.Trainer(
            callbacks=[early_stop], **_trainer_kwargs(accelerator, precision),
        )
        trainer.fit(model, train_loader, val_loader)

        val_loss = trainer.callback_metrics.get("val_loss", torch.tensor(float("inf")))
        return float(val_loss)

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    pruner = optuna.pruners.MedianPruner(n_startup_trials=5)
    study = optuna.create_study(direction="minimize", pruner=pruner)

    callbacks = []
    if task_id:
        callbacks.append(TrialProgressCallback(task_id, n_trials=n_trials))

    study.optimize(objective, n_trials=n_trials, timeout=600, callbacks=callbacks)

    best = study.best_params
    leaderboard = []
    for trial in study.trials:
        if trial.state == optuna.trial.TrialState.COMPLETE:
            leaderboard.append({
                "trial": trial.number,
                "model": trial.params.get("model", "unknown"),
                "hidden_dim": trial.params.get("hidden_dim", 0),
                "num_layers": trial.params.get("num_layers", 0),
                "dropout": round(trial.params.get("dropout", 0.0), 3),
                "lr": round(trial.params.get("lr", 0.0), 6),
                "val_loss": round(trial.value, 4) if trial.value is not None else float("inf"),
            })
    leaderboard.sort(key=lambda x: x["val_loss"])

    return {
        "model_name": best["model"],
        "hidden_dim": best["hidden_dim"],
        "num_layers": best["num_layers"],
        "dropout": best["dropout"],
        "lr": best["lr"],
        "leaderboard": leaderboard[:10],
    }
