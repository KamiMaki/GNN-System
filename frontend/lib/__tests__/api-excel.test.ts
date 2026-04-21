import { uploadProjectExcel, downloadSampleExcel } from '../api';

const API_BASE = 'http://localhost:8000';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Excel upload API (Phase 1)', () => {
  it('downloadSampleExcel returns the sample-excel endpoint URL', () => {
    expect(downloadSampleExcel()).toBe(`${API_BASE}/api/v1/projects/sample-excel`);
  });

  it('uploadProjectExcel posts multipart form and returns DatasetSummary', async () => {
    const summary = {
      dataset_id: 'ds-1',
      name: 'my-data',
      num_nodes: 10,
      num_edges: 5,
      num_features: 4,
      num_classes: 0,
      is_directed: true,
      task_type: 'node_classification',
      declared_task_type: 'node_classification',
      declared_label_column: 'label',
      schema_spec: { entries: [] },
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

  it('uploadProjectExcel surfaces the backend error detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unprocessable Entity',
      json: () => Promise.resolve({ detail: 'Phase 1 does not support edge-level prediction' }),
    });
    const file = new File(['bad'], 'bad.xlsx');
    await expect(uploadProjectExcel('p1', file)).rejects.toThrow(
      /edge-level prediction/,
    );
  });

  it('uploadProjectExcel omits dataset_name when blank', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const file = new File(['x'], 'x.xlsx');
    await uploadProjectExcel('p1', file);
    const body = mockFetch.mock.calls[0][1].body as FormData;
    expect(body.get('dataset_name')).toBeNull();
  });
});
