import {
  uploadProjectData,
  analyzeColumn,
  getCorrelation,
  imputeMissing,
  loadDemoData,
  getProjectGraphSample,
  evaluateModelWithDemo,
  createExperiment,
  listProjectExperiments,
  getExperimentDetail,
  deleteExperiment,
  uploadProjectFolder,
  listProjectModels,
  getModelDetail,
  updateModelInfo,
  deleteModel,
  evaluateModelWithData,
} from '../api';

const API_BASE = 'http://localhost:8000';
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Upload API', () => {
  it('uploadProjectData sends FormData with files', async () => {
    const summary = { dataset_id: 'd1', name: 'test', num_nodes: 10, num_edges: 5, num_features: 3, num_classes: 2, is_directed: false, task_type: 'node_classification' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(summary) });

    const nodesFile = new File(['nodes'], 'nodes.csv', { type: 'text/csv' });
    const edgesFile = new File(['edges'], 'edges.csv', { type: 'text/csv' });

    const result = await uploadProjectData('p1', nodesFile, edgesFile, 'test-dataset');
    expect(result).toEqual(summary);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/upload`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uploadProjectData includes optional test files', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const nodesFile = new File(['n'], 'n.csv');
    const edgesFile = new File(['e'], 'e.csv');
    const nodesTest = new File(['nt'], 'nt.csv');
    const edgesTest = new File(['et'], 'et.csv');

    await uploadProjectData('p1', nodesFile, edgesFile, 'ds', nodesTest, edgesTest);
    const call = mockFetch.mock.calls[0];
    const formData = call[1].body as FormData;
    expect(formData.get('nodes_test_file')).toBeTruthy();
    expect(formData.get('edges_test_file')).toBeTruthy();
  });

  it('uploadProjectData throws on failure with detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ detail: 'Invalid file format' }),
    });

    const nodesFile = new File(['n'], 'n.csv');
    const edgesFile = new File(['e'], 'e.csv');
    await expect(uploadProjectData('p1', nodesFile, edgesFile, 'ds')).rejects.toThrow('Invalid file format');
  });

  it('uploadProjectFolder sends multiple files', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const files = [new File(['a'], 'a.csv'), new File(['b'], 'b.csv')];
    await uploadProjectFolder('p1', files, 'folder-ds');
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe(`${API_BASE}/api/v1/projects/p1/upload-folder`);
    expect(call[1].method).toBe('POST');
  });

  it('uploadProjectFolder throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Error',
      json: () => Promise.resolve({ detail: 'Folder error' }),
    });

    await expect(uploadProjectFolder('p1', [], 'ds')).rejects.toThrow('Folder error');
  });
});

describe('Column Analysis API', () => {
  it('analyzeColumn fetches column stats', async () => {
    const stats = { column: 'feat1', dtype: 'numeric', mean: 5 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(stats) });

    const result = await analyzeColumn('p1', 'feat1');
    expect(result).toEqual(stats);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/columns/feat1`
    );
  });

  it('analyzeColumn includes overrideType param', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    await analyzeColumn('p1', 'feat1', 'categorical');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('override_type=categorical')
    );
  });

  it('analyzeColumn throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(analyzeColumn('p1', 'x')).rejects.toThrow('Analyze column failed');
  });

  it('getCorrelation sends POST with columns', async () => {
    const data = [{ x: 'a', y: 'b', value: 0.9 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });

    const result = await getCorrelation('p1', ['a', 'b']);
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/correlation`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ columns: ['a', 'b'] }),
      })
    );
  });

  it('getCorrelation throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(getCorrelation('p1', [])).rejects.toThrow('Correlation failed');
  });

  it('imputeMissing sends POST', async () => {
    const result = { column: 'x', filled_count: 5, method: 'mean' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(result) });

    const res = await imputeMissing('p1', 'x', 'mean');
    expect(res).toEqual(result);
  });

  it('imputeMissing throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(imputeMissing('p1', 'x', 'mean')).rejects.toThrow('Impute failed');
  });
});

describe('Demo & Graph API', () => {
  it('loadDemoData sends POST without demoId', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    await loadDemoData('p1');
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/load-demo`,
      { method: 'POST' }
    );
  });

  it('loadDemoData sends POST with demoId', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    await loadDemoData('p1', 'cora');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('demo_id=cora'),
      { method: 'POST' }
    );
  });

  it('loadDemoData throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Error',
      json: () => Promise.resolve({ detail: 'Not found' }),
    });
    await expect(loadDemoData('p1')).rejects.toThrow('Not found');
  });

  it('getProjectGraphSample fetches with default limit', async () => {
    const data = { nodes: [], edges: [], num_nodes_total: 0, num_edges_total: 0, sample_size: 0 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });

    const result = await getProjectGraphSample('p1');
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=500'));
  });

  it('getProjectGraphSample with custom limit and graphName', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    await getProjectGraphSample('p1', 100, 'graph-1');
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('limit=100');
    expect(url).toContain('graph_name=graph-1');
  });

  it('getProjectGraphSample throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(getProjectGraphSample('p1')).rejects.toThrow('Failed to get graph sample');
  });
});

describe('Experiment Hierarchy API', () => {
  it('createExperiment sends POST', async () => {
    const exp = { experiment_id: 'e1', project_id: 'p1', name: 'Exp1' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(exp) });

    const result = await createExperiment('p1', 'Exp1', 'd1');
    expect(result).toEqual(exp);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/experiments`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Exp1', dataset_id: 'd1' }),
      })
    );
  });

  it('createExperiment throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(createExperiment('p1', 'x', 'd1')).rejects.toThrow('Failed to create experiment');
  });

  it('listProjectExperiments fetches list', async () => {
    const exps = [{ experiment_id: 'e1' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(exps) });

    const result = await listProjectExperiments('p1');
    expect(result).toEqual(exps);
  });

  it('listProjectExperiments throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(listProjectExperiments('p1')).rejects.toThrow('Failed to list experiments');
  });

  it('getExperimentDetail fetches detail', async () => {
    const detail = { experiment_id: 'e1', name: 'Exp1' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(detail) });

    const result = await getExperimentDetail('p1', 'e1');
    expect(result).toEqual(detail);
  });

  it('getExperimentDetail throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(getExperimentDetail('p1', 'e1')).rejects.toThrow('Failed to get experiment');
  });

  it('deleteExperiment sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await deleteExperiment('p1', 'e1');
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/experiments/e1`,
      { method: 'DELETE' }
    );
  });

  it('deleteExperiment throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(deleteExperiment('p1', 'e1')).rejects.toThrow('Failed to delete experiment');
  });
});

describe('Model Registry API', () => {
  it('listProjectModels fetches models', async () => {
    const models = [{ model_id: 'm1' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(models) });

    const result = await listProjectModels('p1');
    expect(result).toEqual(models);
  });

  it('listProjectModels throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(listProjectModels('p1')).rejects.toThrow('Failed to list models');
  });

  it('getModelDetail fetches model', async () => {
    const model = { model_id: 'm1', name: 'GCN' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(model) });

    const result = await getModelDetail('p1', 'm1');
    expect(result).toEqual(model);
  });

  it('getModelDetail throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(getModelDetail('p1', 'm1')).rejects.toThrow('Failed to get model');
  });

  it('updateModelInfo sends PATCH', async () => {
    const updated = { model_id: 'm1', name: 'Updated' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updated) });

    const result = await updateModelInfo('p1', 'm1', { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('updateModelInfo throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(updateModelInfo('p1', 'm1', {})).rejects.toThrow('Failed to update model');
  });

  it('deleteModel sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await deleteModel('p1', 'm1');
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/models/m1`,
      { method: 'DELETE' }
    );
  });

  it('deleteModel throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(deleteModel('p1', 'm1')).rejects.toThrow('Failed to delete model');
  });

  it('evaluateModelWithDemo sends POST', async () => {
    const result = { model_id: 'm1', metrics: {} };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(result) });

    const res = await evaluateModelWithDemo('p1', 'm1', 'demo1');
    expect(res).toEqual(result);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('evaluate-demo?demo_id=demo1'),
      { method: 'POST' }
    );
  });

  it('evaluateModelWithDemo throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: 'Demo not found' }),
    });
    await expect(evaluateModelWithDemo('p1', 'm1', 'x')).rejects.toThrow('Demo not found');
  });

  it('evaluateModelWithData sends FormData', async () => {
    const result = { model_id: 'm1', metrics: {} };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(result) });

    const nodesFile = new File(['n'], 'n.csv');
    const edgesFile = new File(['e'], 'e.csv');
    const res = await evaluateModelWithData('p1', 'm1', nodesFile, edgesFile);
    expect(res).toEqual(result);
  });

  it('evaluateModelWithData throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: 'Eval error' }),
    });

    const nodesFile = new File(['n'], 'n.csv');
    const edgesFile = new File(['e'], 'e.csv');
    await expect(evaluateModelWithData('p1', 'm1', nodesFile, edgesFile)).rejects.toThrow('Eval error');
  });
});
