import threading
from typing import Any


_lock = threading.Lock()

# Key: dataset_id (str), Value: dict with pyg_train, pyg_test, explore_stats, etc.
datasets: dict[str, Any] = {}

# Key: task_id (str), Value: dict with status, progress, results, report, explain, etc.
tasks: dict[str, Any] = {}

# Key: project_id (str), Value: dict with name, tags, current_step, status, etc.
projects: dict[str, Any] = {}

# Key: experiment_id (str), Value: dict with experiment data
experiments: dict[str, Any] = {}

# Key: model_id (str), Value: dict with model metadata, file path, etc.
models: dict[str, Any] = {}

# Training history for time estimation: list of {num_nodes, n_trials, duration_seconds}
training_history: list[dict] = []


def get_dataset(dataset_id: str) -> dict | None:
    with _lock:
        return datasets.get(dataset_id)


def put_dataset(dataset_id: str, record: dict) -> None:
    with _lock:
        datasets[dataset_id] = record


def get_task(task_id: str) -> dict | None:
    with _lock:
        return tasks.get(task_id)


def put_task(task_id: str, record: dict) -> None:
    with _lock:
        tasks[task_id] = record


def update_task(task_id: str, **kwargs: Any) -> None:
    with _lock:
        if task_id in tasks:
            tasks[task_id].update(kwargs)


# ── Project CRUD ──

def get_project(project_id: str) -> dict | None:
    with _lock:
        return projects.get(project_id)


def put_project(project_id: str, record: dict) -> None:
    with _lock:
        projects[project_id] = record


def update_project(project_id: str, **kwargs: Any) -> None:
    with _lock:
        if project_id in projects:
            projects[project_id].update(kwargs)


def list_projects() -> list[dict]:
    with _lock:
        return list(projects.values())


def delete_project(project_id: str) -> bool:
    with _lock:
        if project_id in projects:
            del projects[project_id]
            return True
        return False


# ── Experiment CRUD ──

def get_experiment(experiment_id: str) -> dict | None:
    with _lock:
        return experiments.get(experiment_id)


def put_experiment(experiment_id: str, record: dict) -> None:
    with _lock:
        experiments[experiment_id] = record


def update_experiment(experiment_id: str, **kwargs: Any) -> None:
    with _lock:
        if experiment_id in experiments:
            experiments[experiment_id].update(kwargs)


def list_experiments(project_id: str) -> list[dict]:
    with _lock:
        return [e for e in experiments.values() if e.get("project_id") == project_id]


def delete_experiment(experiment_id: str) -> bool:
    with _lock:
        if experiment_id in experiments:
            del experiments[experiment_id]
            return True
        return False


# ── Training history for estimation ──

def add_training_record(record: dict) -> None:
    with _lock:
        training_history.append(record)


def get_training_history() -> list[dict]:
    with _lock:
        return list(training_history)


# ── Model Registry CRUD ──

def get_model_record(model_id: str) -> dict | None:
    with _lock:
        return models.get(model_id)


def put_model_record(model_id: str, record: dict) -> None:
    with _lock:
        models[model_id] = record


def list_model_records(project_id: str | None = None) -> list[dict]:
    with _lock:
        if project_id:
            return [m for m in models.values() if m.get("project_id") == project_id]
        return list(models.values())


def delete_model_record(model_id: str) -> bool:
    with _lock:
        if model_id in models:
            del models[model_id]
            return True
        return False
