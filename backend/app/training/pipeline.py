import time

import numpy as np
import torch
import pytorch_lightning as pl
from torch_geometric.loader import DataLoader
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    mean_squared_error, mean_absolute_error, r2_score,
    confusion_matrix as sklearn_confusion_matrix,
)

from pathlib import Path

from app.core import store
from app.core.config import settings
from app.models.factory import get_model
from app.training.optuna_search import run_hpo
from app.training.callbacks import ProgressCallback
from app.data.pyg_converter import dataframes_to_pyg, dataframes_to_pyg_dynamic


def _compute_classification_metrics(y_true, preds):
    """Compute classification metrics for a split."""
    avg = "binary" if len(set(y_true)) <= 2 else "macro"
    return {
        "accuracy": round(float(accuracy_score(y_true, preds)), 4),
        "f1_score": round(float(f1_score(y_true, preds, average=avg, zero_division=0)), 4),
        "precision": round(float(precision_score(y_true, preds, average=avg, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, preds, average=avg, zero_division=0)), 4),
    }


def _compute_regression_metrics(y_true, y_pred):
    """Compute regression metrics for a split."""
    return {
        "mse": round(float(mean_squared_error(y_true, y_pred)), 4),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "r2_score": round(float(r2_score(y_true, y_pred)), 4),
    }


def _predict(model, data, task_type):
    """Run model inference on a Data object. Returns numpy arrays (preds/outputs, y_true)."""
    is_graph = task_type.startswith("graph")
    model.eval()
    with torch.no_grad():
        if is_graph:
            batch_tensor = torch.zeros(data.x.size(0), dtype=torch.long)
            out = model(data.x, data.edge_index, data.edge_attr, batch=batch_tensor)
        else:
            out = model(data.x, data.edge_index, data.edge_attr)

    y_true = data.y.numpy()
    if task_type.endswith("regression"):
        y_pred = out.numpy()
    else:
        y_pred = out.argmax(dim=-1).numpy()
    return y_pred, y_true


def run_training_task(task_id: str) -> None:
    """Background thread entry point. Runs the full training pipeline."""
    try:
        task = store.get_task(task_id)
        dataset = store.get_dataset(task["dataset_id"])
        project_id = task.get("project_id")
        label_column = task.get("label_column")
        task_type = task.get("task_type", dataset.get("task_type", "node_classification"))
        models_filter = task.get("models")
        n_trials = task.get("n_trials", settings.OPTUNA_TRIALS)

        device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cuda":
            cuda_version = torch.version.cuda or "unknown"
            gpu_name = torch.cuda.get_device_name(0)
            store.update_task(task_id, device=f"cuda ({gpu_name}, CUDA {cuda_version})")
        else:
            store.update_task(task_id, device=device)

        # --- PREPROCESSING ---
        store.update_task(task_id, status="PREPROCESSING", progress=5)

        # Determine if we need dynamic or legacy PyG conversion
        if label_column and "pyg_train" not in dataset:
            # Dynamic conversion (new project-based flow)
            train_data, scaler, feature_names = dataframes_to_pyg_dynamic(
                dataset["nodes_df_train"],
                dataset["edges_df_train"],
                label_column=label_column,
                task_type=task_type,
                fit_scaler=True,
            )
            test_data, _, _ = dataframes_to_pyg_dynamic(
                dataset["nodes_df_test"],
                dataset["edges_df_test"],
                label_column=label_column,
                task_type=task_type,
                scaler=scaler,
                fit_scaler=False,
            )
            num_classes = getattr(train_data, "num_classes", 2)
        elif "pyg_train" in dataset:
            # Legacy pre-converted data
            train_data = dataset["pyg_train"]
            test_data = dataset["pyg_test"]
            num_classes = dataset.get("num_classes", 2)
        else:
            raise ValueError("Dataset has no PyG data and no label_column specified")

        num_features = int(train_data.x.shape[1])
        is_regression = task_type.endswith("regression")
        is_classification = not is_regression
        if is_regression:
            num_classes = 1

        # Class weights for imbalanced labels (classification only)
        class_weights = None
        if is_classification:
            labels = train_data.y.numpy()
            unique_labels = np.unique(labels)
            if len(unique_labels) == 2:
                n_total = len(labels)
                n_pos = int((labels == 1).sum())
                n_neg = n_total - n_pos
                weight_neg = n_total / (2.0 * max(n_neg, 1))
                weight_pos = n_total / (2.0 * max(n_pos, 1))
                class_weights = torch.tensor([weight_neg, weight_pos], dtype=torch.float)

        store.update_task(task_id, progress=10)

        # --- HPO ---
        store.update_task(task_id, progress=15, status="TRAINING")
        best_config = run_hpo(
            train_data=train_data,
            val_data=test_data,
            num_features=num_features,
            n_trials=n_trials,
            class_weights=class_weights,
            task_type=task_type,
            models=models_filter,
            task_id=task_id,
        )
        store.update_task(task_id, progress=50, best_config=best_config)

        # --- TRAINING ---
        progress_cb = ProgressCallback(task_id, max_epochs=settings.MAX_EPOCHS, task_type=task_type)
        early_stop = pl.callbacks.EarlyStopping(
            monitor="val_loss", patience=settings.PATIENCE, mode="min"
        )

        model_kwargs = dict(
            num_features=num_features,
            num_classes=num_classes,
            hidden_dim=best_config["hidden_dim"],
            num_layers=best_config["num_layers"],
            dropout=best_config["dropout"],
            lr=best_config["lr"],
            task_type=task_type,
        )
        if is_classification and class_weights is not None:
            model_kwargs["class_weights"] = class_weights

        model = get_model(best_config["model_name"], **model_kwargs)

        train_loader = DataLoader([train_data], batch_size=1, shuffle=False)
        val_loader = DataLoader([test_data], batch_size=1, shuffle=False)

        trainer = pl.Trainer(
            max_epochs=settings.MAX_EPOCHS,
            callbacks=[progress_cb, early_stop],
            enable_progress_bar=False,
            enable_checkpointing=False,
            logger=False,
        )

        t_start = time.time()
        trainer.fit(model, train_loader, val_loader)
        training_time = time.time() - t_start

        # --- EVALUATION ---
        train_preds, train_y_true = _predict(model, train_data, task_type)
        test_preds, test_y_true = _predict(model, test_data, task_type)

        if is_regression:
            train_metrics = _compute_regression_metrics(train_y_true, train_preds)
            test_metrics = _compute_regression_metrics(test_y_true, test_preds)
        else:
            train_metrics = _compute_classification_metrics(train_y_true, train_preds)
            test_metrics = _compute_classification_metrics(test_y_true, test_preds)

        # Val metrics = test metrics (test is used as validation during training)
        val_metrics = dict(test_metrics)

        # Confusion matrix (classification only) — NxN multiclass format
        confusion_matrix = None
        if is_classification:
            unique_labels = sorted(set(test_y_true.tolist()) | set(test_preds.tolist()))
            cm = sklearn_confusion_matrix(test_y_true, test_preds, labels=unique_labels)
            confusion_matrix = {
                "labels": [str(lbl) for lbl in unique_labels],
                "matrix": cm.tolist(),
            }

        # Residual data (regression only)
        residual_data = None
        if is_regression:
            # Sample up to 500 points for scatter plot
            indices = np.random.choice(len(test_y_true), min(500, len(test_y_true)), replace=False)
            residual_data = [
                {"actual": round(float(test_y_true[i]), 4), "predicted": round(float(test_preds[i]), 4)}
                for i in indices
            ]

        # Per-node predictions on test set
        node_predictions = []
        test_node_ids = dataset.get("nodes_df_test", None)
        for i in range(len(test_y_true)):
            nid = str(test_node_ids["node_id"].iloc[i]) if test_node_ids is not None and len(test_node_ids) > i else str(i)
            pred_entry = {
                "node_id": nid,
                "true_label": round(float(test_y_true[i]), 4) if is_regression else str(int(test_y_true[i])),
                "predicted_label": round(float(test_preds[i]), 4) if is_regression else str(int(test_preds[i])),
            }
            if is_classification:
                pred_entry["correct"] = bool(test_y_true[i] == test_preds[i])
            node_predictions.append(pred_entry)

        report = {
            "task_type": task_type,
            "train_metrics": train_metrics,
            "val_metrics": val_metrics,
            "test_metrics": test_metrics,
            "history": progress_cb.history,
            "confusion_matrix": confusion_matrix,
            "residual_data": residual_data,
            "node_predictions": node_predictions,
            "best_config": {
                "model_name": best_config["model_name"],
                "hidden_dim": best_config["hidden_dim"],
                "num_layers": best_config["num_layers"],
                "dropout": round(best_config["dropout"], 3),
                "lr": round(best_config["lr"], 6),
            },
            "leaderboard": best_config.get("leaderboard", []),
        }

        results = {
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
            "training_time_seconds": round(training_time, 1),
        }

        from datetime import datetime, timezone
        store.update_task(
            task_id,
            status="COMPLETED",
            progress=100,
            results=results,
            best_config={
                "model_name": best_config["model_name"],
                "hidden_dim": best_config["hidden_dim"],
                "num_layers": best_config["num_layers"],
                "dropout": round(best_config["dropout"], 3),
                "lr": round(best_config["lr"], 6),
            },
            report=report,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Save model to disk for model registry
        models_dir = Path(settings.MODELS_DIR)
        models_dir.mkdir(parents=True, exist_ok=True)
        model_file = models_dir / f"{task_id}.pt"
        torch.save({
            "state_dict": model.state_dict(),
            "model_name": best_config["model_name"],
            "num_features": num_features,
            "num_classes": num_classes,
            "task_type": task_type,
            "label_column": label_column,
            "hidden_dim": best_config["hidden_dim"],
            "num_layers": best_config["num_layers"],
            "dropout": best_config["dropout"],
            "lr": best_config["lr"],
        }, str(model_file))

        # Auto-register model
        model_id = task_id  # use task_id as model_id for simplicity
        store.put_model_record(model_id, {
            "model_id": model_id,
            "project_id": project_id or "",
            "task_id": task_id,
            "name": f"{best_config['model_name'].upper()} - {task_type}",
            "model_name": best_config["model_name"],
            "task_type": task_type,
            "label_column": label_column,
            "num_features": num_features,
            "num_classes": num_classes,
            "best_config": {
                "model_name": best_config["model_name"],
                "hidden_dim": best_config["hidden_dim"],
                "num_layers": best_config["num_layers"],
                "dropout": round(best_config["dropout"], 3),
                "lr": round(best_config["lr"], 6),
            },
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
            "file_path": str(model_file),
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "description": "",
        })

        # Record training history for time estimation
        store.add_training_record({
            "num_nodes": dataset.get("num_nodes", 0),
            "n_trials": n_trials,
            "duration_seconds": round(training_time, 1),
        })

        # Update project status if applicable
        if project_id:
            store.update_project(project_id, current_step=4, status="completed")

    except Exception as e:
        import logging
        logging.exception("Training task %s failed", task_id)
        store.update_task(task_id, status="FAILED", progress=0, error="Training failed. Check server logs for details.")
        if task.get("project_id"):
            store.update_project(task["project_id"], status="failed")
