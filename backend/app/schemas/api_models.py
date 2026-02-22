from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Literal, Union


# ── Dataset ──

class DatasetSummary(BaseModel):
    dataset_id: str
    name: str
    num_nodes: int
    num_edges: int
    num_features: int
    num_classes: int
    is_directed: bool
    task_type: str = "node_classification"
    has_edge_attrs: bool = False


# ── Generic Explore (new) ──

class ColumnInfo(BaseModel):
    name: str
    dtype: str  # "numeric", "categorical", "boolean"
    missing_count: int
    missing_pct: float
    unique_count: int


class GenericExploreData(BaseModel):
    num_nodes: int
    num_edges: int
    columns: list[ColumnInfo]
    edge_columns: list[ColumnInfo] = []
    feature_correlation: list[dict]  # [{x: str, y: str, value: float}]
    correlation_columns: list[str]


class NumericColumnStats(BaseModel):
    column: str
    dtype: Literal["numeric"] = "numeric"
    mean: float
    median: float
    std: float
    min: float
    max: float
    q1: float
    q3: float
    outlier_count: int
    distribution: list[dict]  # [{range: str, count: int}]


class CategoricalColumnStats(BaseModel):
    column: str
    dtype: Literal["categorical"] = "categorical"
    value_counts: list[dict]  # [{name: str, count: int}]
    top_value: str
    top_count: int


# ── Label Validation ──

class LabelValidationRequest(BaseModel):
    task_type: str
    label_column: str


class LabelValidationResult(BaseModel):
    valid: bool
    message: str
    num_classes: Optional[int] = None
    class_distribution: Optional[list[dict]] = None  # [{label: str, count: int}]
    value_range: Optional[dict] = None  # {min, max, mean, std}
    is_continuous: Optional[bool] = None


# ── Imputation ──

class ImputationRequest(BaseModel):
    column: str
    method: Literal["mean", "median", "zero"]


class ImputationResult(BaseModel):
    column: str
    filled_count: int
    method: str


# ── Data Confirmation (gate Step 2 → Step 3) ──

class ConfirmDataRequest(BaseModel):
    task_type: str
    label_column: str


# ── Correlation Request ──

class CorrelationRequest(BaseModel):
    columns: list[str]


# ── Project ──

class CreateProjectRequest(BaseModel):
    name: str
    tags: list[str] = []


class ProjectSummary(BaseModel):
    project_id: str
    name: str
    tags: list[str]
    created_at: str
    current_step: int
    status: str
    dataset_id: Optional[str] = None
    task_id: Optional[str] = None


class ProjectDetail(ProjectSummary):
    task_type: Optional[str] = None
    label_column: Optional[str] = None
    dataset_summary: Optional[DatasetSummary] = None
    task_status: Optional["TaskStatus"] = None


# ── Legacy Explore (kept for backward compat) ──

class ExploreData(BaseModel):
    fanout_dist: list[dict]
    slack_dist: list[dict]
    cell_type_dist: list[dict]
    feature_correlation: list[dict]
    critical_paths_table: list[dict]
    radar_data: list[dict]


# ── Metrics & Training ──

class SplitMetrics(BaseModel):
    accuracy: Optional[float] = None
    f1_score: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    mse: Optional[float] = None
    mae: Optional[float] = None
    r2_score: Optional[float] = None


class TaskResults(BaseModel):
    train_metrics: SplitMetrics
    test_metrics: SplitMetrics
    training_time_seconds: float


class BestConfig(BaseModel):
    model_name: str
    hidden_dim: int
    num_layers: int
    dropout: float
    lr: float


class LeaderboardEntry(BaseModel):
    trial: int
    model: str
    hidden_dim: int
    num_layers: int
    dropout: float
    lr: float
    val_loss: float


class TaskStatus(BaseModel):
    task_id: str
    project_id: Optional[str] = None
    status: Literal["QUEUED", "PREPROCESSING", "TRAINING", "COMPLETED", "FAILED"]
    progress: int
    current_trial: Optional[int] = None
    total_trials: Optional[int] = None
    device: Optional[str] = None
    results: Optional[TaskResults] = None
    best_config: Optional[BestConfig] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class EpochHistory(BaseModel):
    epoch: int
    loss: float
    val_loss: float
    accuracy: Optional[float] = None


class ConfusionRow(BaseModel):
    actual: str
    predicted_negative: int
    predicted_positive: int


class Report(BaseModel):
    task_type: str = "node_classification"
    train_metrics: SplitMetrics
    val_metrics: Optional[SplitMetrics] = None
    test_metrics: SplitMetrics
    history: list[EpochHistory]
    confusion_matrix: Optional[list[ConfusionRow]] = None
    residual_data: Optional[list[dict]] = None  # [{actual, predicted}] for regression
    best_config: Optional[BestConfig] = None
    leaderboard: Optional[list[LeaderboardEntry]] = None


# ── Training Config ──

class StartTrainingRequest(BaseModel):
    models: list[str] = []  # empty = Auto (all models)
    n_trials: int = 150


class TrainingEstimate(BaseModel):
    estimated_seconds: float
    device: str


# ── Legacy Task Creation (kept for backward compat) ──

class CreateTaskRequest(BaseModel):
    dataset_id: str
    task_type: str = "node_classification"


# Rebuild model to resolve forward reference
ProjectDetail.model_rebuild()
