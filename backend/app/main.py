from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.store import put_dataset
from app.data.mock_loader import load_mock_dataset


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load mock dataset at startup
    mock_record = load_mock_dataset()
    put_dataset(mock_record["dataset_id"], mock_record)
    yield


app = FastAPI(title="LayoutXpert GNN API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","https://94bf-123-241-84-178.ngrok-free.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import datasets, tasks, projects

app.include_router(datasets.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
