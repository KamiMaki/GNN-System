"""Router-level smoke tests for the Excel upload endpoint."""
from __future__ import annotations

import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core import store
from app.main import app


@pytest.fixture(autouse=True)
def clean_store():
    store.datasets.clear()
    store.projects.clear()
    store.tasks.clear()
    yield
    store.datasets.clear()
    store.projects.clear()
    store.tasks.clear()


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


def _valid_excel_bytes() -> bytes:
    parameter = pd.DataFrame([
        {"XY": "X", "Level": "Node", "Type": "default", "Parameter": "X_1", "Weight": None},
        {"XY": "Y", "Level": "Node", "Type": "default", "Parameter": "label", "Weight": None},
    ])
    nodes = pd.DataFrame({
        "Graph_ID": [1] * 6,
        "Node": [0, 1, 2, 3, 4, 5],
        "X_1": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        "label": [0, 1, 0, 1, 0, 1],
    })
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        parameter.to_excel(w, sheet_name="Parameter", index=False)
        nodes.to_excel(w, sheet_name="Node_default", index=False)
    buf.seek(0)
    return buf.read()


def _create_project(client) -> str:
    resp = client.post("/api/v1/projects/", json={"name": "excel-test", "tags": []})
    assert resp.status_code == 200, resp.text
    return resp.json()["project_id"]


def test_sample_excel_download(client):
    resp = client.get("/api/v1/projects/sample-excel")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert len(resp.content) > 0


def test_upload_excel_success(client):
    project_id = _create_project(client)
    files = {
        "file": ("template.xlsx", _valid_excel_bytes(),
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }
    resp = client.post(
        f"/api/v1/projects/{project_id}/upload-excel",
        files=files,
        data={"dataset_name": "my-data"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["declared_task_type"] == "node_classification"
    assert body["declared_label_column"] == "label"
    assert body["num_nodes"] == 6
    assert body["schema_spec"]["entries"][1]["xy"] == "Y"

    # Project should have advanced to step 3 (data_confirmed) automatically.
    proj = client.get(f"/api/v1/projects/{project_id}").json()
    assert proj["current_step"] == 3
    assert proj["task_type"] == "node_classification"
    assert proj["label_column"] == "label"


def test_upload_excel_invalid_file(client):
    project_id = _create_project(client)
    files = {
        "file": ("bogus.xlsx", b"not an excel file",
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }
    resp = client.post(
        f"/api/v1/projects/{project_id}/upload-excel", files=files,
    )
    assert resp.status_code == 422
    assert "read Excel file" in resp.json()["detail"]


def test_upload_excel_unknown_project(client):
    files = {
        "file": ("template.xlsx", _valid_excel_bytes(),
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }
    resp = client.post("/api/v1/projects/does-not-exist/upload-excel", files=files)
    assert resp.status_code == 404
