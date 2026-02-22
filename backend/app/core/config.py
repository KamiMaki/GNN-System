from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MOCK_DATA_DIR: Path = Path(__file__).resolve().parent.parent.parent / "mock_data"
    STORAGE_DIR: Path = Path(__file__).resolve().parent.parent.parent / "storage"
    DEFAULT_TASK_TYPE: str = "node_classification"
    MAX_EPOCHS: int = 50
    PATIENCE: int = 10
    OPTUNA_TRIALS: int = 150
    NUMERIC_FEATURES: list[str] = [
        "logic_depth", "fanout", "fan_in",
        "cell_delay_ps", "drive_strength",
        "cell_area_um2", "congestion_score",
    ]
    CELL_TYPES: list[str] = ["Logic", "Buffer", "Register", "Port"]
    LABEL_COLUMN: str = "is_critical"
    REGRESSION_LABEL: str = "congestion_score"

    # MongoDB
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB: str = "layoutxpert"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PROGRESS_DB: int = 2

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"


settings = Settings()
