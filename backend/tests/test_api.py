import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.core import store
from app.data.mock_loader import load_mock_dataset, MOCK_DATASET_ID


MOCK_DIR = Path(__file__).resolve().parent.parent / "mock_data"


@pytest.fixture(autouse=True)
def setup_store():
    """Pre-load mock dataset before each test."""
    store.datasets.clear()
    store.tasks.clear()
    store.projects.clear()
    mock = load_mock_dataset()
    store.put_dataset(mock["dataset_id"], mock)
    yield
    store.datasets.clear()
    store.tasks.clear()
    store.projects.clear()


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


def test_list_datasets(client):
    resp = client.get("/api/v1/datasets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["dataset_id"] == MOCK_DATASET_ID
    assert data[0]["num_classes"] == 2


def test_explore_dataset(client):
    resp = client.get(f"/api/v1/datasets/{MOCK_DATASET_ID}/explore")
    assert resp.status_code == 200
    data = resp.json()
    assert "fanout_dist" in data
    assert "slack_dist" in data
    assert "cell_type_dist" in data
    assert "feature_correlation" in data
    assert "critical_paths_table" in data
    assert "radar_data" in data


def test_explore_not_found(client):
    resp = client.get("/api/v1/datasets/nonexistent/explore")
    assert resp.status_code == 404


def test_upload_dataset(client):
    nodes_path = MOCK_DIR / "nodes_train.csv"
    edges_path = MOCK_DIR / "edges_train.csv"

    with open(nodes_path, "rb") as nf, open(edges_path, "rb") as ef:
        resp = client.post(
            "/api/v1/upload",
            files={
                "nodes_file": ("nodes.csv", nf, "text/csv"),
                "edges_file": ("edges.csv", ef, "text/csv"),
            },
            data={"dataset_name": "Test Upload"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Upload"
    assert data["num_features"] == 11
    assert data["num_classes"] == 2


def test_create_task(client):
    resp = client.post(
        "/api/v1/tasks",
        json={"dataset_id": MOCK_DATASET_ID, "task_type": "node_classification"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "QUEUED"
    assert data["progress"] == 0
    assert "task_id" in data


def test_create_task_bad_dataset(client):
    resp = client.post(
        "/api/v1/tasks",
        json={"dataset_id": "nonexistent", "task_type": "node_classification"},
    )
    assert resp.status_code == 404


def test_get_task_not_found(client):
    resp = client.get("/api/v1/tasks/nonexistent")
    assert resp.status_code == 404


# ── Project API Tests ──

def test_create_project(client):
    resp = client.post("/api/v1/projects/", json={"name": "Test Project", "tags": ["test", "demo"]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Project"
    assert data["tags"] == ["test", "demo"]
    assert data["current_step"] == 1
    assert data["status"] == "created"


def test_list_projects(client):
    client.post("/api/v1/projects/", json={"name": "P1", "tags": []})
    client.post("/api/v1/projects/", json={"name": "P2", "tags": []})
    resp = client.get("/api/v1/projects/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_project(client):
    create = client.post("/api/v1/projects/", json={"name": "Detail", "tags": []})
    pid = create.json()["project_id"]
    resp = client.get(f"/api/v1/projects/{pid}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Detail"


def test_delete_project(client):
    create = client.post("/api/v1/projects/", json={"name": "ToDelete", "tags": []})
    pid = create.json()["project_id"]
    resp = client.delete(f"/api/v1/projects/{pid}")
    assert resp.status_code == 200
    resp = client.get(f"/api/v1/projects/{pid}")
    assert resp.status_code == 404


def test_project_upload(client):
    create = client.post("/api/v1/projects/", json={"name": "Upload Test", "tags": []})
    pid = create.json()["project_id"]

    nodes_path = MOCK_DIR / "nodes_train.csv"
    edges_path = MOCK_DIR / "edges_train.csv"

    with open(nodes_path, "rb") as nf, open(edges_path, "rb") as ef:
        resp = client.post(
            f"/api/v1/projects/{pid}/upload",
            files={
                "nodes_file": ("nodes.csv", nf, "text/csv"),
                "edges_file": ("edges.csv", ef, "text/csv"),
            },
            data={"dataset_name": "Test"},
        )
    assert resp.status_code == 200

    # Project should advance to step 2
    project = client.get(f"/api/v1/projects/{pid}").json()
    assert project["current_step"] == 2
    assert project["status"] == "data_uploaded"


def test_project_explore(client):
    # Create + upload
    create = client.post("/api/v1/projects/", json={"name": "Explore", "tags": []})
    pid = create.json()["project_id"]

    nodes_path = MOCK_DIR / "nodes_train.csv"
    edges_path = MOCK_DIR / "edges_train.csv"
    with open(nodes_path, "rb") as nf, open(edges_path, "rb") as ef:
        client.post(
            f"/api/v1/projects/{pid}/upload",
            files={"nodes_file": ("n.csv", nf, "text/csv"), "edges_file": ("e.csv", ef, "text/csv")},
            data={"dataset_name": "Test"},
        )

    resp = client.get(f"/api/v1/projects/{pid}/explore")
    assert resp.status_code == 200
    data = resp.json()
    assert "num_nodes" in data
    assert "columns" in data
    assert len(data["columns"]) > 0


def test_sample_data(client):
    resp = client.get("/api/v1/projects/sample-data")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"
