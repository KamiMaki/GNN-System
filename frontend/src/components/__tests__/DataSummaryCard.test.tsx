import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataSummaryCard from '../DataSummaryCard';

const mockSummary = {
  dataset_id: 'ds-001',
  num_nodes: 2708,
  num_edges: 10556,
  num_features: 1433,
  num_classes: 7,
  is_directed: false,
};

describe('DataSummaryCard', () => {
  it('renders dataset ID', () => {
    render(<DataSummaryCard summary={mockSummary} />);
    expect(screen.getByText(/ID: ds-001/)).toBeInTheDocument();
  });

  it('renders all statistics', () => {
    render(<DataSummaryCard summary={mockSummary} />);
    expect(screen.getByText('Total Nodes')).toBeInTheDocument();
    expect(screen.getByText('Total Edges')).toBeInTheDocument();
    expect(screen.getByText('Node Features')).toBeInTheDocument();
    expect(screen.getByText('Classes')).toBeInTheDocument();
    expect(screen.getByText('Structure')).toBeInTheDocument();
  });

  it('shows Undirected for non-directed graphs', () => {
    render(<DataSummaryCard summary={mockSummary} />);
    expect(screen.getByText('Undirected')).toBeInTheDocument();
  });

  it('shows Directed for directed graphs', () => {
    render(<DataSummaryCard summary={{ ...mockSummary, is_directed: true }} />);
    expect(screen.getByText('Directed')).toBeInTheDocument();
  });

  it('renders the section title', () => {
    render(<DataSummaryCard summary={mockSummary} />);
    expect(screen.getByText('Dataset Exploration Results')).toBeInTheDocument();
  });
});
