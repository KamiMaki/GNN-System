from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.store import get_dataset, put_dataset
from app.core.artifacts import save_dataset_artifacts
from app.data.mock_loader import load_mock_dataset

MOCK_DATASET_ID = "mock-circuit-v1"

# Keys that are file artifacts and must NOT go into MongoDB
_ARTIFACT_KEYS = (
    "pyg_train", "pyg_test", "scaler",
    "nodes_df_train", "nodes_df_test",
    "edges_df_train", "edges_df_test",
    "nodes_df", "edges_df",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only load mock dataset if not already persisted in MongoDB
    existing = get_dataset(MOCK_DATASET_ID)
    if not existing:
        mock_record = load_mock_dataset()
        # Separate artifacts from metadata
        artifact_data = {}
        for key in list(mock_record.keys()):
            if key in _ARTIFACT_KEYS:
                artifact_data[key] = mock_record.pop(key)
        if artifact_data:
            save_dataset_artifacts(mock_record["dataset_id"], artifact_data)
        put_dataset(mock_record["dataset_id"], mock_record)
    yield


app = FastAPI(title="LayoutXpert GNN API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import datasets, tasks, projects  # noqa: E402

app.include_router(datasets.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Verify MongoDB and Redis connectivity."""
    status = {"mongodb": "ok", "redis": "ok"}
    try:
        from app.core.store import _client
        _client.admin.command("ping")
    except Exception as e:
        status["mongodb"] = f"error: {e}"

    try:
        import redis
        from app.core.config import settings
        r = redis.Redis.from_url(settings.REDIS_URL)
        r.ping()
    except Exception as e:
        status["redis"] = f"error: {e}"

    ok = all(v == "ok" for v in status.values())
    from fastapi.responses import JSONResponse
    return JSONResponse(content=status, status_code=200 if ok else 503)
