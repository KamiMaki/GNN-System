import {
  uploadProjectExcel,
  downloadSampleExcel,
  listDemoExcels,
  loadDemoExcel,
  downloadDemoExcel,
} from '../api';

const API_BASE = 'http://localhost:8000';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Excel API client', () => {
  it('downloadSampleExcel returns the sample URL', () => {
    expect(downloadSampleExcel()).toBe(`${API_BASE}/api/v1/projects/sample-excel`);
  });

  it('downloadDemoExcel returns the correct per-demo URL', () => {
    expect(downloadDemoExcel('multigraph_hetero')).toBe(
      `${API_BASE}/api/v1/projects/demo-excel/multigraph_hetero`,
    );
  });

  it('uploadProjectExcel posts multipart form and returns DatasetSummary', async () => {
    const summary = {
      dataset_id: 'ds-1',
      name: 'my-data',
      num_nodes: 40,
      num_edges: 75,
      num_features: 5,
      num_classes: 0,
      is_directed: true,
      task_type: 'graph_regression',
      declared_task_type: 'graph_regression',
      declared_label_column: 'target_delay',
      graph_count: 10,
      is_heterogeneous: false,
      node_types: ['default'],
      edge_types: ['default'],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(summary) });

    const file = new File([new Uint8Array([0, 1, 2, 3])], 'template.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const result = await uploadProjectExcel('p1', file, 'my-data');

    expect(result).toEqual(summary);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/upload-excel`,
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const body = mockFetch.mock.calls[0][1].body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.get('dataset_name')).toBe('my-data');
  });

  it('uploadProjectExcel surfaces backend error detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unprocessable Entity',
      json: () => Promise.resolve({ detail: 'Edge-level prediction not yet supported' }),
    });
    const file = new File(['bad'], 'bad.xlsx');
    await expect(uploadProjectExcel('p1', file)).rejects.toThrow(/Edge-level prediction/);
  });

  it('uploadProjectExcel omits dataset_name when blank', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const file = new File(['x'], 'x.xlsx');
    await uploadProjectExcel('p1', file);
    const body = mockFetch.mock.calls[0][1].body as FormData;
    expect(body.get('dataset_name')).toBeNull();
  });

  it('listDemoExcels returns DemoExcelInfo[]', async () => {
    const demos = [
      { id: 'multigraph_homo', name: 'Multi-Graph Homogeneous',
        description: '...', filename: 'demo_multigraph_homo.xlsx',
        is_heterogeneous: false, tags: ['multi-graph', 'homogeneous'] },
      { id: 'multigraph_hetero', name: 'Multi-Graph Heterogeneous',
        description: '...', filename: 'demo_multigraph_hetero.xlsx',
        is_heterogeneous: true, tags: ['multi-graph', 'heterogeneous'] },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(demos) });
    const result = await listDemoExcels();
    expect(result).toEqual(demos);
    expect(result[1].is_heterogeneous).toBe(true);
  });

  it('loadDemoExcel POSTs with demo_id query param', async () => {
    const summary = { dataset_id: 'ds', name: 'Multi-Graph Hetero', num_nodes: 500,
      num_edges: 1000, num_features: 5, num_classes: 0, is_directed: true,
      task_type: 'graph_regression', is_heterogeneous: true, graph_count: 10,
      node_types: ['cell', 'pin', 'net'], edge_types: ['cell2pin', 'pin2pin', 'pin2net'] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(summary) });
    const res = await loadDemoExcel('p1', 'multigraph_hetero');
    expect(res.is_heterogeneous).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects/p1/load-demo-excel?demo_id=multigraph_hetero`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
