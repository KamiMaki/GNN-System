import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectProvider, useProject } from '../ProjectContext';

// Mock the API module
jest.mock('@/lib/api', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
}));

import { listProjects, getProject, createProject } from '@/lib/api';
const mockListProjects = jest.mocked(listProjects);
const mockGetProject = jest.mocked(getProject);
const mockCreateProject = jest.mocked(createProject);

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}));

function TestConsumer() {
  const { projects, currentProject, loading, selectProject, createNewProject, clearCurrentProject } = useProject();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="count">{projects.length}</span>
      <span data-testid="current">{currentProject?.name ?? 'none'}</span>
      {projects.map(p => (
        <span key={p.project_id} data-testid={`project-${p.project_id}`}>{p.name}</span>
      ))}
      <button onClick={() => selectProject('p1')}>Select P1</button>
      <button onClick={() => createNewProject('New Project', ['tag1'])}>Create</button>
      <button onClick={clearCurrentProject}>Clear</button>
    </div>
  );
}

describe('ProjectContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListProjects.mockResolvedValue([]);
  });

  it('loads projects on mount', async () => {
    const projects = [
      { project_id: 'p1', name: 'Project 1', tags: [], created_at: '', current_step: 1, status: 'created' },
    ];
    mockListProjects.mockResolvedValueOnce(projects);

    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
    expect(screen.getByText('Project 1')).toBeInTheDocument();
  });

  it('selectProject loads project detail', async () => {
    mockListProjects.mockResolvedValueOnce([]);
    const detail = {
      project_id: 'p1', name: 'Detail Project', tags: [], created_at: '',
      current_step: 2, status: 'uploaded',
    };
    mockGetProject.mockResolvedValueOnce(detail);

    const user = userEvent.setup();
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>
    );

    await user.click(screen.getByText('Select P1'));

    await waitFor(() => {
      expect(screen.getByTestId('current')).toHaveTextContent('Detail Project');
    });
  });

  it('createNewProject adds to list', async () => {
    mockListProjects.mockResolvedValueOnce([]);
    const newProject = {
      project_id: 'p2', name: 'New Project', tags: ['tag1'], created_at: '',
      current_step: 1, status: 'created',
    };
    mockCreateProject.mockResolvedValueOnce(newProject);

    const user = userEvent.setup();
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>
    );

    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('clearCurrentProject resets current project', async () => {
    mockListProjects.mockResolvedValueOnce([]);
    const detail = {
      project_id: 'p1', name: 'Active', tags: [], created_at: '',
      current_step: 1, status: 'created',
    };
    mockGetProject.mockResolvedValueOnce(detail);

    const user = userEvent.setup();
    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>
    );

    await user.click(screen.getByText('Select P1'));
    await waitFor(() => {
      expect(screen.getByTestId('current')).toHaveTextContent('Active');
    });

    await user.click(screen.getByText('Clear'));
    expect(screen.getByTestId('current')).toHaveTextContent('none');
  });

  it('handles API errors gracefully', async () => {
    mockListProjects.mockRejectedValueOnce(new Error('Network error'));

    render(
      <ProjectProvider>
        <TestConsumer />
      </ProjectProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
