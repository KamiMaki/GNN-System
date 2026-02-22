"""Persistent store backed by MongoDB.

Provides the same interface as the previous in-memory store so that
callers (routers, training pipeline) require minimal changes.
"""

from typing import Any

from pymongo import MongoClient

from app.core.config import settings

_client: MongoClient = MongoClient(settings.MONGO_URI)
_db = _client[settings.MONGO_DB]

# Collections
_datasets = _db["datasets"]
_tasks = _db["tasks"]
_projects = _db["projects"]
_training_history = _db["training_history"]

# Indexes (idempotent — safe to call on every import)
_tasks.create_index("project_id")
_datasets.create_index("name")


# ── Dataset CRUD ──

def get_dataset(dataset_id: str) -> dict | None:
    doc = _datasets.find_one({"_id": dataset_id})
    return doc


def put_dataset(dataset_id: str, record: dict) -> None:
    record["_id"] = dataset_id
    _datasets.replace_one({"_id": dataset_id}, record, upsert=True)


def list_datasets() -> list[dict]:
    return list(_datasets.find())


def delete_dataset(dataset_id: str) -> bool:
    result = _datasets.delete_one({"_id": dataset_id})
    return result.deleted_count > 0


# ── Task CRUD ──

def get_task(task_id: str) -> dict | None:
    return _tasks.find_one({"_id": task_id})


def put_task(task_id: str, record: dict) -> None:
    record["_id"] = task_id
    _tasks.replace_one({"_id": task_id}, record, upsert=True)


def update_task(task_id: str, **kwargs: Any) -> None:
    if kwargs:
        _tasks.update_one({"_id": task_id}, {"$set": kwargs})


def list_tasks() -> list[dict]:
    return list(_tasks.find())


def list_tasks_by_project(project_id: str) -> list[dict]:
    return list(_tasks.find({"project_id": project_id}))


# ── Project CRUD ──

def get_project(project_id: str) -> dict | None:
    return _projects.find_one({"_id": project_id})


def put_project(project_id: str, record: dict) -> None:
    record["_id"] = project_id
    _projects.replace_one({"_id": project_id}, record, upsert=True)


def update_project(project_id: str, **kwargs: Any) -> None:
    if kwargs:
        _projects.update_one({"_id": project_id}, {"$set": kwargs})


def list_projects() -> list[dict]:
    return list(_projects.find())


def delete_project(project_id: str) -> bool:
    result = _projects.delete_one({"_id": project_id})
    return result.deleted_count > 0


# ── Training history for estimation ──

def add_training_record(record: dict) -> None:
    _training_history.insert_one(record)


def get_training_history() -> list[dict]:
    return list(_training_history.find({}, {"_id": 0}))
