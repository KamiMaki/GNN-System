import uuid

import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core import store
from app.data.feature_engineering import compute_explore_stats
from app.data.ingestion import parse_csv_pair
from app.data.pyg_converter import dataframes_to_pyg
from app.schemas.api_models import DatasetSummary, ExploreData

router = APIRouter()


@router.post("/upload", response_model=DatasetSummary)
async def upload_dataset(
    nodes_file: UploadFile = File(...),
    edges_file: UploadFile = File(...),
    dataset_name: str = Form(default=""),
    task_type: str = Form(default="node_classification", pattern=r"^(node_classification|node_regression|graph_classification|graph_regression)$"),
    nodes_test_file: UploadFile = File(None),
    edges_test_file: UploadFile = File(None),
):
    """Upload nodes CSV + edges CSV. Returns DatasetSummary."""
    try:
        nodes_bytes = await nodes_file.read()
        edges_bytes = await edges_file.read()
        name = dataset_name or (nodes_file.filename or "unnamed").replace(".csv", "")

        parsed = parse_csv_pair(nodes_bytes, edges_bytes, name)
        explore_stats = compute_explore_stats(parsed["nodes_df"], parsed["edges_df"])

        # Determine num_classes based on task_type
        num_classes = 2 if task_type in ("node_classification", "graph_classification") else 1

        # Check if separate test files were provided
        has_test_files = (
            nodes_test_file is not None
            and edges_test_file is not None
            and nodes_test_file.filename
            and edges_test_file.filename
        )

        if has_test_files:
            # Separate test files provided
            nodes_test_bytes = await nodes_test_file.read()
            edges_test_bytes = await edges_test_file.read()
            parsed_test = parse_csv_pair(nodes_test_bytes, edges_test_bytes, name + "-test")

            pyg_train, scaler = dataframes_to_pyg(
                parsed["nodes_df"], parsed["edges_df"],
                fit_scaler=True, task_type=task_type,
            )
            pyg_test, _ = dataframes_to_pyg(
                parsed_test["nodes_df"], parsed_test["edges_df"],
                scaler=scaler, fit_scaler=False, task_type=task_type,
            )

            nodes_df_train = parsed["nodes_df"]
            nodes_df_test = parsed_test["nodes_df"]
            edges_df_train = parsed["edges_df"]
            edges_df_test = parsed_test["edges_df"]
            total_nodes = len(nodes_df_train) + len(nodes_df_test)
            total_edges = len(edges_df_train) + len(edges_df_test)
        else:
            # Auto-split 80/20
            nodes_df = parsed["nodes_df"]
            edges_df = parsed["edges_df"]
            num_nodes = len(nodes_df)

            perm = torch.randperm(num_nodes)
            split_idx = int(num_nodes * 0.8)
            train_indices = perm[:split_idx].numpy()
            test_indices = perm[split_idx:].numpy()

            nodes_df_train = nodes_df.iloc[train_indices].reset_index(drop=True)
            nodes_df_test = nodes_df.iloc[test_indices].reset_index(drop=True)

            # Filter edges: only keep edges where both src and dst are in the split
            train_node_ids = set(nodes_df_train["node_id"].values)
            test_node_ids = set(nodes_df_test["node_id"].values)

            edges_df_train = edges_df[
                edges_df["src_id"].isin(train_node_ids) & edges_df["dst_id"].isin(train_node_ids)
            ].reset_index(drop=True)
            edges_df_test = edges_df[
                edges_df["src_id"].isin(test_node_ids) & edges_df["dst_id"].isin(test_node_ids)
            ].reset_index(drop=True)

            pyg_train, scaler = dataframes_to_pyg(
                nodes_df_train, edges_df_train,
                fit_scaler=True, task_type=task_type,
            )
            pyg_test, _ = dataframes_to_pyg(
                nodes_df_test, edges_df_test,
                scaler=scaler, fit_scaler=False, task_type=task_type,
            )

            total_nodes = num_nodes
            total_edges = len(edges_df)

        dataset_id = str(uuid.uuid4())
        record = {
            "dataset_id": dataset_id,
            "name": name,
            "num_nodes": total_nodes,
            "num_edges": total_edges,
            "num_features": int(pyg_train.x.shape[1]),
            "num_classes": num_classes,
            "is_directed": True,
            "task_type": task_type,
            "pyg_train": pyg_train,
            "pyg_test": pyg_test,
            "scaler": scaler,
            "nodes_df_train": nodes_df_train,
            "nodes_df_test": nodes_df_test,
            "edges_df_train": edges_df_train,
            "edges_df_test": edges_df_test,
            "explore_stats": explore_stats,
        }
        store.put_dataset(dataset_id, record)

        return DatasetSummary(
            dataset_id=dataset_id,
            name=name,
            num_nodes=record["num_nodes"],
            num_edges=record["num_edges"],
            num_features=record["num_features"],
            num_classes=num_classes,
            is_directed=True,
            task_type=task_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/datasets", response_model=list[DatasetSummary])
async def list_datasets():
    """List all datasets."""
    all_datasets = store.list_datasets()
    return [
        DatasetSummary(
            dataset_id=d["dataset_id"],
            name=d["name"],
            num_nodes=d["num_nodes"],
            num_edges=d["num_edges"],
            num_features=d["num_features"],
            num_classes=d["num_classes"],
            is_directed=d["is_directed"],
            task_type=d.get("task_type", "node_classification"),
        )
        for d in all_datasets
    ]


@router.get("/datasets/{dataset_id}/explore", response_model=ExploreData)
async def explore_dataset(dataset_id: str):
    """Get exploration statistics for a dataset."""
    dataset = store.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset["explore_stats"]
