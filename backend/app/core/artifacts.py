"""Artifact storage layer for non-JSON-serializable objects.

Handles PyG Data, pandas DataFrames, and sklearn Scalers by persisting
them to the filesystem under storage/datasets/<dataset_id>/.
"""

import pickle
import shutil
from pathlib import Path

import pandas as pd
import torch

from app.core.config import settings

ARTIFACT_ROOT: Path = settings.STORAGE_DIR / "datasets"


def save_dataset_artifacts(dataset_id: str, artifacts: dict) -> str:
    """Save non-serializable objects to disk. Returns the artifact directory path."""
    path = ARTIFACT_ROOT / dataset_id
    path.mkdir(parents=True, exist_ok=True)

    # DataFrames → parquet
    for key in (
        "nodes_df_train", "nodes_df_test",
        "edges_df_train", "edges_df_test",
        "nodes_df", "edges_df",
    ):
        if key in artifacts and artifacts[key] is not None:
            artifacts[key].to_parquet(path / f"{key}.parquet")

    # Scaler → pickle
    if "scaler" in artifacts and artifacts["scaler"] is not None:
        with open(path / "scaler.pkl", "wb") as f:
            pickle.dump(artifacts["scaler"], f)

    # PyG Data → torch.save
    for key in ("pyg_train", "pyg_test"):
        if key in artifacts and artifacts[key] is not None:
            torch.save(artifacts[key], path / f"{key}.pt")

    # PyG data list (multi-graph)
    for key in ("pyg_train_list", "pyg_test_list"):
        if key in artifacts and artifacts[key] is not None:
            torch.save(artifacts[key], path / f"{key}.pt")

    return str(path)


def load_dataframe(dataset_id: str, name: str) -> pd.DataFrame | None:
    """Load a parquet-stored DataFrame. Returns None if not found."""
    path = ARTIFACT_ROOT / dataset_id / f"{name}.parquet"
    if not path.exists():
        return None
    return pd.read_parquet(path)


def load_scaler(dataset_id: str):
    """Load a pickled scaler. Returns None if not found."""
    path = ARTIFACT_ROOT / dataset_id / "scaler.pkl"
    if not path.exists():
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


def load_pyg_data(dataset_id: str, name: str):
    """Load a torch-saved PyG Data object. Returns None if not found."""
    path = ARTIFACT_ROOT / dataset_id / f"{name}.pt"
    if not path.exists():
        return None
    return torch.load(path, weights_only=False)


def delete_dataset_artifacts(dataset_id: str) -> None:
    """Remove all artifacts for a dataset."""
    path = ARTIFACT_ROOT / dataset_id
    if path.exists():
        shutil.rmtree(path)
