import {
  listProjects,
  getProject,
  createProject,
  deleteProject,
  updateProject,
  getProjectExplore,
  startProjectTraining,
  getProjectStatus,
  getProjectReport,
  downloadSampleData,
  estimateTraining,
  validateLabel,
  confirmData,
  listDemoDatasets,
  listExperiments,
  getExperimentReport,
} from '../api';

const API_BASE = 'http://localhost:8000';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Project API', () => {
  it('listProjects fetches all projects', async () => {
    const projects = [{ project_id: 'p1', name: 'Test' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(projects) });

    const result = await listProjects();
    expect(result).toEqual(projects);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/`);
  });

  it('getProject fetches a single project', async () => {
    const project = { project_id: 'p1', name: 'Test' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(project) });

    const result = await getProject('p1');
    expect(result).toEqual(project);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/p1`);
  });

  it('createProject sends POST with name and tags', async () => {
    const project = { project_id: 'p2', name: 'New', tags: ['gnn'] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(project) });

    const result = await createProject('New', ['gnn']);
    expect(result).toEqual(project);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New', tags: ['gnn'] }),
    });
  });

  it('deleteProject sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await deleteProject('p1');
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/p1`, { method: 'DELETE' });
  });

  it('updateProject sends PATCH with data', async () => {
    const updated = { project_id: 'p1', name: 'Updated' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updated) });

    const result = await updateProject('p1', { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('listProjects throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Server Error' });
    await expect(listProjects()).rejects.toThrow('List projects failed');
  });

  it('createProject throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Bad Request' });
    await expect(createProject('x', [])).rejects.toThrow('Create project failed');
  });
});

describe('Project Data API', () => {
  it('getProjectExplore fetches explore data', async () => {
    const data = { num_nodes: 100, num_edges: 200 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });

    const result = await getProjectExplore('p1');
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/p1/explore`);
  });

  it('validateLabel sends POST with task_type and label_column', async () => {
    const validation = { valid: true, message: 'OK' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(validation) });

    const result = await validateLabel('p1', 'node_classification', 'label');
    expect(result).toEqual(validation);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/p1/validate-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_type: 'node_classification', label_column: 'label' }),
    });
  });

  it('confirmData sends POST with task_type and label_column', async () => {
    const confirmed = { project_id: 'p1', name: 'Test' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(confirmed) });

    const result = await confirmData('p1', 'node_classification', 'label');
    expect(result).toEqual(confirmed);
  });

  it('estimateTraining fetches estimate', async () => {
    const estimate = { estimated_seconds: 120, device: 'cpu' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(estimate) });

    const result = await estimateTraining('p1', 10);
    expect(result).toEqual(estimate);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/p1/estimate?n_trials=10`);
  });
});

describe('Training API', () => {
  it('startProjectTraining sends POST with models and n_trials', async () => {
    const task = { task_id: 't1', status: 'QUEUED' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(task) });

    const result = await startProjectTraining('p1', ['GCN', 'GAT'], 20);
    expect(result).toEqual(task);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/p1/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models: ['GCN', 'GAT'], n_trials: 20 }),
    });
  });

  it('getProjectStatus fetches task status', async () => {
    const status = { task_id: 't1', status: 'TRAINING', progress: 50 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(status) });

    const result = await getProjectStatus('p1');
    expect(result).toEqual(status);
  });

  it('getProjectReport fetches report', async () => {
    const report = { task_type: 'node_classification' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(report) });

    const result = await getProjectReport('p1');
    expect(result).toEqual(report);
  });
});

describe('Demo & Experiment API', () => {
  it('listDemoDatasets fetches demo list', async () => {
    const demos = [{ id: 'd1', name: 'Cora' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(demos) });

    const result = await listDemoDatasets();
    expect(result).toEqual(demos);
  });

  it('listExperiments fetches experiments for project', async () => {
    const experiments = [{ task_id: 't1', status: 'COMPLETED' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(experiments) });

    const result = await listExperiments('p1');
    expect(result).toEqual(experiments);
  });

  it('getExperimentReport fetches report by task id', async () => {
    const report = { task_type: 'regression' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(report) });

    const result = await getExperimentReport('p1', 't1');
    expect(result).toEqual(report);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects/p1/report/t1`);
  });
});

describe('Utility functions', () => {
  it('downloadSampleData returns correct URL', () => {
    const url = downloadSampleData();
    expect(url).toBe(`${API_BASE}/api/v1/projects/sample-data`);
  });
});
