"""Training pipeline for Excel-ingested datasets.

Three clean branches based on the dataset record:

    1. task_type starts with 'graph'  + is_heterogeneous=True
       → list[HeteroData] + HeteroGraphRegressor (to_hetero)
    2. task_type starts with 'graph'  + is_heterogeneous=False
       → list[Data] + standard homo GNN (graph-level head + pooling)
    3. task_type starts with 'node'
       → single Data with train/test masks (legacy node-level flow)

All dataset records originate from ``parse_excel_file`` and are stored by the
upload-excel router.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import pytorch_lightning as pl
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    mean_squared_error, mean_absolute_error, r2_score,
    confusion_matrix as sklearn_confusion_matrix,
)
from torch_geometric.loader import DataLoader

from app.core import store
from app.core.config import settings
from app.data.pyg_converter import dataframes_to_pyg_dynamic, dataframes_to_graph_list
from app.data.pyg_converter_hetero import parsed_excel_to_hetero_list
from app.models.factory import get_model
from app.training.callbacks import ProgressCallback
from app.training.optuna_search import run_hpo


# ── metric helpers ────────────────────────────────────────────────────────

def _regression_metrics(y_true, y_pred) -> dict:
    return {
        "mse": round(float(mean_squared_error(y_true, y_pred)), 4),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "r2_score": round(float(r2_score(y_true, y_pred)), 4),
    }


def _classification_metrics(y_true, y_pred) -> dict:
    avg = "binary" if len(set(y_true.tolist())) <= 2 else "macro"
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "f1_score": round(float(f1_score(y_true, y_pred, average=avg, zero_division=0)), 4),
        "precision": round(float(precision_score(y_true, y_pred, average=avg, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, average=avg, zero_division=0)), 4),
    }


# ── data prep branches ────────────────────────────────────────────────────

def _split_list(items: list, fraction: float = 0.8) -> tuple[list, list]:
    n = len(items)
    split = max(int(n * fraction), 1)
    idx = torch.randperm(n).tolist()
    train_idx = idx[:split]
    test_idx = idx[split:] if split < n else idx[:1]  # ensure non-empty test
    return [items[i] for i in train_idx], [items[i] for i in test_idx]


def _prepare_hetero(dataset: dict) -> tuple[list, list, tuple, int]:
    parsed = {
        "node_dfs": dataset["node_dfs"],
        "edge_dfs": dataset["edge_dfs"],
        "graph_df": dataset["graph_df"],
        "label_column": dataset["label_column"],
        "canonical_edges": dataset["canonical_edges"],
    }
    data_list, _scalers, _fnames, _canonical_edges = parsed_excel_to_hetero_list(parsed)
    # Pull metadata from the actual (post-ToUndirected) HeteroData so to_hetero
    # sees every relation including the auto-added reverse edges.
    metadata = data_list[0].metadata()
    num_classes = 1 if dataset["task_type"].endswith("regression") else 2
    train, test = _split_list(data_list)
    return train, test, metadata, num_classes


def _prepare_graph_homo(dataset: dict) -> tuple[list, list, int]:
    data_list, _scalers, _fnames, num_classes = dataframes_to_graph_list(
        dataset["nodes_df"], dataset["edges_df"], dataset.get("graph_df"),
        label_column=dataset["label_column"], task_type=dataset["task_type"],
        fit_scaler=True,
    )
    train, test = _split_list(data_list)
    return train, test, num_classes


def _prepare_node(dataset: dict):
    train_data, scaler, _ = dataframes_to_pyg_dynamic(
        dataset["nodes_df_train"], dataset["edges_df_train"],
        label_column=dataset["label_column"], task_type=dataset["task_type"],
        fit_scaler=True,
    )
    test_data, _, _ = dataframes_to_pyg_dynamic(
        dataset["nodes_df_test"], dataset["edges_df_test"],
        label_column=dataset["label_column"], task_type=dataset["task_type"],
        scaler=scaler, fit_scaler=False,
    )
    num_classes = getattr(train_data, "num_classes", 2)
    return train_data, test_data, num_classes


# ── prediction helpers ────────────────────────────────────────────────────

def _predict_list(model, data_list, task_type: str, is_hetero: bool) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    loader = DataLoader(data_list, batch_size=max(len(data_list), 1))
    y_true_all = []
    y_pred_all = []
    with torch.no_grad():
        for batch in loader:
            if is_hetero:
                x_dict = {nt: batch[nt].x for nt in batch.node_types}
                ei_dict = {et: batch[et].edge_index for et in batch.edge_types}
                b_dict = {nt: batch[nt].batch for nt in batch.node_types}
                out = model(x_dict, ei_dict, b_dict)
            else:
                b = getattr(batch, "batch", None)
                out = model(batch.x, batch.edge_index,
                            getattr(batch, "edge_attr", None), batch=b)
            y_true_all.append(batch.y.cpu().numpy())
            if task_type.endswith("regression"):
                y_pred_all.append(out.detach().cpu().numpy())
            else:
                y_pred_all.append(out.argmax(dim=-1).detach().cpu().numpy())
    return np.concatenate(y_pred_all), np.concatenate(y_true_all)


def _predict_single(model, data, task_type: str) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    with torch.no_grad():
        out = model(data.x, data.edge_index,
                    getattr(data, "edge_attr", None), batch=None)
    y_true = data.y.cpu().numpy()
    if task_type.endswith("regression"):
        return out.cpu().numpy(), y_true
    return out.argmax(dim=-1).cpu().numpy(), y_true


# ── main entry point ──────────────────────────────────────────────────────

def run_training_task(task_id: str) -> None:
    """Background thread entry point."""
    try:
        task = store.get_task(task_id)
        dataset = store.get_dataset(task["dataset_id"])
        project_id = task.get("project_id")
        task_type = task.get("task_type", dataset.get("task_type"))
        n_trials = task.get("n_trials", settings.OPTUNA_TRIALS)
        models_filter = task.get("models")

        device = "cuda" if torch.cuda.is_available() else "cpu"
        store.update_task(task_id, device=device, status="PREPROCESSING", progress=5)

        is_hetero = bool(dataset.get("is_heterogeneous"))
        is_graph_task = task_type.startswith("graph")

        # ── Prepare data ──
        metadata = None
        if is_graph_task and is_hetero:
            train_items, test_items, metadata, num_classes = _prepare_hetero(dataset)
        elif is_graph_task:
            train_items, test_items, num_classes = _prepare_graph_homo(dataset)
        else:
            train_items, test_items, num_classes = _prepare_node(dataset)

        # num_features is meaningful for homogeneous paths; for hetero, to_hetero
        # uses lazy (-1) inputs so the value below is informational only.
        if isinstance(train_items, list):
            sample = train_items[0]
            if is_hetero:
                num_features = int(next(iter(sample.x_dict.values())).shape[1])
            else:
                num_features = int(sample.x.shape[1])
        else:
            num_features = int(train_items.x.shape[1])

        store.update_task(task_id, progress=15, status="TRAINING")

        # ── HPO (only for homogeneous single-Data node tasks; hetero & graph-list
        #    use fixed config to keep this change focused) ──
        if not is_graph_task:
            best_config = run_hpo(
                train_data=train_items, val_data=test_items,
                num_features=num_features, n_trials=n_trials,
                task_type=task_type, models=models_filter, task_id=task_id,
            )
        else:
            # Fixed reasonable config for graph-level tasks; Optuna can be
            # re-enabled later once hetero HPO surface is designed.
            chosen = (models_filter[0] if models_filter else "sage")
            best_config = {
                "model_name": chosen, "hidden_dim": 64, "num_layers": 3,
                "dropout": 0.2, "lr": 1e-3, "leaderboard": [],
            }

        store.update_task(task_id, progress=50, best_config=best_config)

        # ── Build model ──
        is_regression = task_type.endswith("regression")
        effective_classes = 1 if is_regression else num_classes
        model = get_model(
            best_config["model_name"],
            num_features=num_features,
            num_classes=effective_classes,
            task_type=task_type,
            metadata=metadata,
            hidden_dim=best_config["hidden_dim"],
            num_layers=best_config["num_layers"],
            dropout=best_config["dropout"],
            lr=best_config["lr"],
        )

        # ── DataLoaders ──
        if isinstance(train_items, list):
            batch_size = min(8, len(train_items)) or 1
            train_loader = DataLoader(train_items, batch_size=batch_size, shuffle=True)
            val_loader = DataLoader(test_items, batch_size=batch_size)
        else:
            train_loader = DataLoader([train_items], batch_size=1, shuffle=False)
            val_loader = DataLoader([test_items], batch_size=1, shuffle=False)

        progress_cb = ProgressCallback(task_id, max_epochs=settings.MAX_EPOCHS, task_type=task_type)
        early_stop = pl.callbacks.EarlyStopping(monitor="val_loss", patience=settings.PATIENCE, mode="min")
        trainer = pl.Trainer(
            max_epochs=settings.MAX_EPOCHS, callbacks=[progress_cb, early_stop],
            enable_progress_bar=False, enable_checkpointing=False, logger=False,
        )

        t0 = time.time()
        trainer.fit(model, train_loader, val_loader)
        train_time = time.time() - t0

        # ── Evaluation ──
        if isinstance(train_items, list):
            train_preds, train_y = _predict_list(model, train_items, task_type, is_hetero)
            test_preds, test_y = _predict_list(model, test_items, task_type, is_hetero)
        else:
            train_preds, train_y = _predict_single(model, train_items, task_type)
            test_preds, test_y = _predict_single(model, test_items, task_type)

        if is_regression:
            train_metrics = _regression_metrics(train_y, train_preds)
            test_metrics = _regression_metrics(test_y, test_preds)
            cm = None
            residual = [
                {"actual": round(float(test_y[i]), 4), "predicted": round(float(test_preds[i]), 4)}
                for i in range(min(500, len(test_y)))
            ]
        else:
            train_metrics = _classification_metrics(train_y, train_preds)
            test_metrics = _classification_metrics(test_y, test_preds)
            labels = sorted(set(test_y.tolist()) | set(test_preds.tolist()))
            cm_arr = sklearn_confusion_matrix(test_y, test_preds, labels=labels)
            cm = {"labels": [str(l) for l in labels], "matrix": cm_arr.tolist()}
            residual = None

        report = {
            "task_type": task_type,
            "train_metrics": train_metrics,
            "val_metrics": dict(test_metrics),
            "test_metrics": test_metrics,
            "history": progress_cb.history,
            "confusion_matrix": cm,
            "residual_data": residual,
            "node_predictions": [],
            "best_config": {
                "model_name": best_config["model_name"],
                "hidden_dim": best_config["hidden_dim"],
                "num_layers": best_config["num_layers"],
                "dropout": round(best_config["dropout"], 3),
                "lr": round(best_config["lr"], 6),
            },
            "leaderboard": best_config.get("leaderboard", []),
            "is_heterogeneous": is_hetero,
        }

        store.update_task(
            task_id, status="COMPLETED", progress=100,
            results={
                "train_metrics": train_metrics,
                "test_metrics": test_metrics,
                "training_time_seconds": round(train_time, 1),
            },
            best_config=report["best_config"], report=report,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Persist model for registry
        models_dir = Path(settings.MODELS_DIR)
        models_dir.mkdir(parents=True, exist_ok=True)
        model_file = models_dir / f"{task_id}.pt"
        torch.save({
            "state_dict": model.state_dict(),
            "model_name": best_config["model_name"],
            "num_features": num_features,
            "num_classes": effective_classes,
            "task_type": task_type,
            "label_column": dataset.get("label_column"),
            "hidden_dim": best_config["hidden_dim"],
            "num_layers": best_config["num_layers"],
            "dropout": best_config["dropout"],
            "lr": best_config["lr"],
            "is_heterogeneous": is_hetero,
            "metadata": metadata,
        }, str(model_file))

        store.put_model_record(task_id, {
            "model_id": task_id, "project_id": project_id or "",
            "task_id": task_id,
            "name": f"{best_config['model_name'].upper()} - {task_type}",
            "model_name": best_config["model_name"],
            "task_type": task_type,
            "label_column": dataset.get("label_column"),
            "num_features": num_features,
            "num_classes": effective_classes,
            "best_config": report["best_config"],
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
            "file_path": str(model_file),
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "description": "",
        })

        store.add_training_record({
            "num_nodes": dataset.get("num_nodes", 0),
            "n_trials": n_trials,
            "duration_seconds": round(train_time, 1),
        })

        if project_id:
            store.update_project(project_id, current_step=4, status="completed")

    except Exception:
        import logging
        logging.exception("Training task %s failed", task_id)
        store.update_task(task_id, status="FAILED", progress=0,
                          error="Training failed. Check server logs for details.")
        tk = store.get_task(task_id) or {}
        if tk.get("project_id"):
            store.update_project(tk["project_id"], status="failed")
