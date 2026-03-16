const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Common Types ──

export interface DatasetSummary {
  dataset_id: string;
  name: string;
  num_nodes: number;
  num_edges: number;
  num_features: number;
  num_classes: number;
  is_directed: boolean;
  task_type: string;
  has_edge_attrs?: boolean;
}

export interface DemoDatasetInfo {
  id: string;
  name: string;
  description: string;
  nodes: number;
  edges: number;
  tags: string[];
}

export interface SplitMetrics {
  accuracy: number | null;
  f1_score: number | null;
  precision: number | null;
  recall: number | null;
  mse: number | null;
  mae: number | null;
  r2_score: number | null;
}

export interface BestConfig {
  model_name: string;
  hidden_dim: number;
  num_layers: number;
  dropout: number;
  lr: number;
}

export interface LeaderboardEntry {
  trial: number;
  model: string;
  hidden_dim: number;
  num_layers: number;
  dropout: number;
  lr: number;
  val_loss: number;
}

// ── Project Types ──

export interface ProjectSummary {
  project_id: string;
  name: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
  current_step: number;
  status: string;
  dataset_id?: string;
  task_id?: string;
}

export interface ProjectDetail extends ProjectSummary {
  task_type?: string;
  label_column?: string;
  dataset_summary?: DatasetSummary;
  task_status?: TaskStatus;
  dataset_ids?: string[];
  experiment_ids?: string[];
}

// ── Experiment Types ──

export interface ExperimentSummary {
  experiment_id: string;
  project_id: string;
  name: string;
  dataset_id: string;
  task_type?: string;
  label_column?: string;
  current_step: number;
  status: string;
  created_at: string;
  updated_at: string;
  run_count: number;
  best_metric?: number;
  best_model?: string;
}

export interface ExperimentDetail extends ExperimentSummary {
  dataset_summary?: DatasetSummary;
  runs: TaskStatus[];
}

// ── Explore Types (generic) ──

export interface ColumnInfo {
  name: string;
  dtype: 'numeric' | 'categorical' | 'boolean';
  missing_count: number;
  missing_pct: number;
  unique_count: number;
}

export interface GenericExploreData {
  num_nodes: number;
  num_edges: number;
  columns: ColumnInfo[];
  edge_columns?: ColumnInfo[];
  feature_correlation: Array<{ x: string; y: string; value: number }>;
  correlation_columns: string[];
}

export interface NumericColumnStats {
  column: string;
  dtype: 'numeric';
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  outlier_count: number;
  distribution: Array<{ range: string; count: number }>;
}

export interface CategoricalColumnStats {
  column: string;
  dtype: 'categorical';
  value_counts: Array<{ name: string; count: number }>;
  top_value: string;
  top_count: number;
}

export type ColumnStats = NumericColumnStats | CategoricalColumnStats;

// ── Label Validation ──

export interface LabelValidationResult {
  valid: boolean;
  message: string;
  num_classes?: number;
  class_distribution?: Array<{ label: string; count: number }>;
  value_range?: { min: number; max: number; mean: number; std: number };
  is_continuous?: boolean;
}

// ── Training ──

export interface TaskStatus {
  task_id: string;
  project_id?: string;
  status: 'QUEUED' | 'PREPROCESSING' | 'TRAINING' | 'COMPLETED' | 'FAILED';
  progress: number;
  current_trial?: number;
  total_trials?: number;
  device?: string;
  results?: {
    train_metrics: SplitMetrics;
    test_metrics: SplitMetrics;
    training_time_seconds: number;
  };
  best_config?: BestConfig;
  started_at?: string;
  completed_at?: string;
}

export interface TrainingEstimate {
  estimated_seconds: number;
  device: string;
}

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

export interface Report {
  task_type: string;
  train_metrics: SplitMetrics;
  val_metrics?: SplitMetrics;
  test_metrics: SplitMetrics;
  history: Array<{ epoch: number; loss: number; val_loss: number; accuracy?: number }>;
  confusion_matrix: ConfusionMatrix | null;
  residual_data?: Array<{ actual: number; predicted: number }>;
  best_config?: BestConfig;
  leaderboard?: LeaderboardEntry[];
}

// ── Model Registry ──

export interface RegisteredModel {
  model_id: string;
  project_id: string;
  task_id: string;
  name: string;
  model_name: string;
  task_type: string;
  label_column: string;
  num_features: number;
  num_classes: number;
  best_config: BestConfig;
  train_metrics: SplitMetrics;
  test_metrics: SplitMetrics;
  file_path: string;
  registered_at: string;
  description: string;
}

export interface EvaluationResult {
  model_id: string;
  model_name: string;
  task_type: string;
  metrics: SplitMetrics;
  confusion_matrix: ConfusionMatrix | null;
  residual_data?: Array<{ actual: number; predicted: number }>;
  num_samples: number;
  evaluated_at: string;
}

// ── Legacy Explore (for backward compat) ──

export interface ExploreData {
  fanout_dist: Array<{ range: string; count: number }>;
  slack_dist: Array<{ range: string; count: number }>;
  cell_type_dist: Array<{ name: string; value: number }>;
  feature_correlation: Array<{ x: string; y: string; value: number }>;
  critical_paths_table: Array<{
    node_id: number; name: string; cell_type: string;
    slack_ns: number; logic_depth: number; congestion_score: number; is_critical: number;
  }>;
  radar_data: Array<{ subject: string; A: number; fullMark: number }>;
}

// ════════════════════════════════════════════
// Project API Functions
// ════════════════════════════════════════════

export const createProject = async (name: string, tags: string[]): Promise<ProjectSummary> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, tags }),
  });
  if (!res.ok) throw new Error(`Create project failed: ${res.statusText}`);
  return res.json();
};

export const listProjects = async (): Promise<ProjectSummary[]> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/`);
  if (!res.ok) throw new Error(`List projects failed`);
  return res.json();
};

export const getProject = async (projectId: string): Promise<ProjectDetail> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}`);
  if (!res.ok) throw new Error(`Get project failed`);
  return res.json();
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete project failed`);
};

export const updateProject = async (projectId: string, data: { name?: string; tags?: string[] }): Promise<ProjectSummary> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const uploadProjectData = async (
  projectId: string,
  nodesFile: File,
  edgesFile: File,
  datasetName: string,
  nodesTestFile?: File,
  edgesTestFile?: File,
): Promise<DatasetSummary> => {
  const formData = new FormData();
  formData.append('nodes_file', nodesFile);
  formData.append('edges_file', edgesFile);
  formData.append('dataset_name', datasetName || nodesFile.name.replace(/\.[^.]+$/, ''));
  if (nodesTestFile) formData.append('nodes_test_file', nodesTestFile);
  if (edgesTestFile) formData.append('edges_test_file', edgesTestFile);

  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Upload failed: ${res.statusText}`);
  }
  return res.json();
};

export const getProjectExplore = async (projectId: string): Promise<GenericExploreData> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/explore`);
  if (!res.ok) throw new Error(`Explore failed`);
  return res.json();
};

export const analyzeColumn = async (
  projectId: string,
  columnName: string,
  overrideType?: string,
): Promise<ColumnStats> => {
  const params = new URLSearchParams();
  if (overrideType) params.set('override_type', overrideType);
  const url = `${API_BASE}/api/v1/projects/${projectId}/columns/${columnName}${params.toString() ? '?' + params : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Analyze column failed`);
  return res.json();
};

export const getCorrelation = async (
  projectId: string,
  columns: string[],
): Promise<Array<{ x: string; y: string; value: number }>> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/correlation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columns }),
  });
  if (!res.ok) throw new Error(`Correlation failed`);
  return res.json();
};

export const validateLabel = async (
  projectId: string,
  taskType: string,
  labelColumn: string,
): Promise<LabelValidationResult> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/validate-label`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_type: taskType, label_column: labelColumn }),
  });
  if (!res.ok) throw new Error(`Validate label failed`);
  return res.json();
};

export const imputeMissing = async (
  projectId: string,
  column: string,
  method: string,
): Promise<{ column: string; filled_count: number; method: string }> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/impute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column, method }),
  });
  if (!res.ok) throw new Error(`Impute failed`);
  return res.json();
};

export const confirmData = async (
  projectId: string,
  taskType: string,
  labelColumn: string,
): Promise<ProjectSummary> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_type: taskType, label_column: labelColumn }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Confirm failed`);
  }
  return res.json();
};

export const estimateTraining = async (
  projectId: string,
  nTrials: number,
): Promise<TrainingEstimate> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/estimate?n_trials=${nTrials}`);
  if (!res.ok) throw new Error(`Estimate failed`);
  return res.json();
};

export const startProjectTraining = async (
  projectId: string,
  models: string[],
  nTrials: number,
): Promise<TaskStatus> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ models, n_trials: nTrials }),
  });
  if (!res.ok) throw new Error(`Start training failed`);
  return res.json();
};

export const getProjectStatus = async (projectId: string): Promise<TaskStatus> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/status`);
  if (!res.ok) throw new Error(`Status failed`);
  return res.json();
};

export const getProjectReport = async (projectId: string): Promise<Report> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/report`);
  if (!res.ok) throw new Error(`Report failed`);
  return res.json();
};

export const downloadSampleData = (): string => {
  return `${API_BASE}/api/v1/projects/sample-data`;
};

export const loadDemoData = async (projectId: string, demoId?: string): Promise<DatasetSummary> => {
  const params = demoId ? `?demo_id=${demoId}` : '';
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/load-demo${params}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Load demo data failed: ${res.statusText}`);
  }
  return res.json();
};

export const listDemoDatasets = async (): Promise<DemoDatasetInfo[]> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/demo-datasets`);
  if (!res.ok) throw new Error('Failed to list demo datasets');
  return res.json();
};

export const listExperiments = async (projectId: string): Promise<TaskStatus[]> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/experiments`);
  if (!res.ok) throw new Error('Failed to list experiments');
  return res.json();
};

// ── Experiment Hierarchy API ──

export const createExperiment = async (
  projectId: string,
  name: string,
  datasetId: string,
): Promise<ExperimentSummary> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dataset_id: datasetId }),
  });
  if (!res.ok) throw new Error('Failed to create experiment');
  return res.json();
};

export const listProjectExperiments = async (projectId: string): Promise<ExperimentSummary[]> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/experiments/list`);
  if (!res.ok) throw new Error('Failed to list experiments');
  return res.json();
};

export const getExperimentDetail = async (
  projectId: string,
  experimentId: string,
): Promise<ExperimentDetail> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/experiments/${experimentId}`);
  if (!res.ok) throw new Error('Failed to get experiment');
  return res.json();
};

export const deleteExperiment = async (
  projectId: string,
  experimentId: string,
): Promise<void> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/experiments/${experimentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete experiment');
};

export const getExperimentReport = async (projectId: string, taskId: string): Promise<Report> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/report/${taskId}`);
  if (!res.ok) throw new Error('Failed to get experiment report');
  return res.json();
};

export const uploadProjectFolder = async (
  projectId: string,
  files: File[],
  datasetName: string,
): Promise<DatasetSummary> => {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  formData.append('dataset_name', datasetName);

  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/upload-folder`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Upload failed: ${res.statusText}`);
  }
  return res.json();
};

// ════════════════════════════════════════════
// Legacy API Functions (backward compat)
// ════════════════════════════════════════════

export const uploadDataset = async (
  nodesFile: File, edgesFile: File, datasetName: string,
  taskType?: string, nodesTestFile?: File, edgesTestFile?: File,
): Promise<DatasetSummary> => {
  const formData = new FormData();
  formData.append('nodes_file', nodesFile);
  formData.append('edges_file', edgesFile);
  formData.append('dataset_name', datasetName || nodesFile.name.replace(/\.[^.]+$/, ''));
  if (taskType) formData.append('task_type', taskType);
  if (nodesTestFile) formData.append('nodes_test_file', nodesTestFile);
  if (edgesTestFile) formData.append('edges_test_file', edgesTestFile);
  const res = await fetch(`${API_BASE}/api/v1/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
};

export const startTraining = async (
  datasetId: string, taskType: string = 'node_classification'
): Promise<{ task_id: string; status: string }> => {
  const res = await fetch(`${API_BASE}/api/v1/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id: datasetId, task_type: taskType }),
  });
  if (!res.ok) throw new Error(`Training start failed: ${res.statusText}`);
  return res.json();
};

export const getTaskStatus = async (taskId: string): Promise<TaskStatus> => {
  const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`);
  if (!res.ok) throw new Error(`Task not found: ${taskId}`);
  return res.json();
};

export const getDatasetExplore = async (datasetId: string): Promise<ExploreData> => {
  const res = await fetch(`${API_BASE}/api/v1/datasets/${datasetId}/explore`);
  if (!res.ok) throw new Error(`Explore failed: ${res.statusText}`);
  return res.json();
};

export const getTaskReport = async (taskId: string): Promise<Report> => {
  const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}/report`);
  if (!res.ok) throw new Error(`Report failed: ${res.statusText}`);
  return res.json();
};

export const listDatasets = async (): Promise<DatasetSummary[]> => {
  const res = await fetch(`${API_BASE}/api/v1/datasets`);
  if (!res.ok) throw new Error(`List datasets failed`);
  return res.json();
};

export const listTasks = async (): Promise<TaskStatus[]> => {
  const res = await fetch(`${API_BASE}/api/v1/tasks`);
  if (!res.ok) throw new Error(`List tasks failed`);
  return res.json();
};

// ════════════════════════════════════════════
// Model Registry API Functions
// ════════════════════════════════════════════

export const listProjectModels = async (projectId: string): Promise<RegisteredModel[]> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/models`);
  if (!res.ok) throw new Error('Failed to list models');
  return res.json();
};

export const getModelDetail = async (projectId: string, modelId: string): Promise<RegisteredModel> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/models/${modelId}`);
  if (!res.ok) throw new Error('Failed to get model');
  return res.json();
};

export const updateModelInfo = async (
  projectId: string,
  modelId: string,
  data: { name?: string; description?: string },
): Promise<RegisteredModel> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/models/${modelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update model');
  return res.json();
};

export const deleteModel = async (projectId: string, modelId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/models/${modelId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete model');
};

export const evaluateModelWithData = async (
  projectId: string,
  modelId: string,
  nodesFile: File,
  edgesFile: File,
): Promise<EvaluationResult> => {
  const formData = new FormData();
  formData.append('nodes_file', nodesFile);
  formData.append('edges_file', edgesFile);
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/models/${modelId}/evaluate`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || 'Evaluation failed');
  }
  return res.json();
};
