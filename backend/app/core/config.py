from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    STORAGE_DIR: Path = Path(__file__).resolve().parent.parent.parent / "storage"
    MODELS_DIR: Path = Path(__file__).resolve().parent.parent.parent / "storage" / "models"
    DEMO_DATA_DIR: Path = Path(__file__).resolve().parent.parent.parent / "demo_data"
    MAX_EPOCHS: int = 50
    PATIENCE: int = 10
    OPTUNA_TRIALS: int = 150


settings = Settings()
