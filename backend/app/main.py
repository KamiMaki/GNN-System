from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import data, training, explainer, demo

# Create the FastAPI app instance
app = FastAPI(
    title="AutoCircuitGNN Backend",
    description="API for managing GNN datasets, training, and explainability.",
    version="0.1.0",
)

# Define the list of origins that are allowed to make cross-origin requests.
# We'll allow our Next.js frontend which will run on localhost:3000
origins = [
    "http://localhost:3000",
]

# Add CORSMiddleware to the application instance
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

@app.get("/", tags=["Root"])
async def read_root():
    """
    Root endpoint to check if the server is running.
    """
    return {"message": "Welcome to the AutoCircuitGNN API!"}

# Add the routers
app.include_router(data.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(explainer.router, prefix="/api")
app.include_router(demo.router, prefix="/api")
