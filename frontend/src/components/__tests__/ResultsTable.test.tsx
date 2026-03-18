import { render, screen } from '@testing-library/react';
import ResultsTable from '../ResultsTable';

describe('ResultsTable', () => {
  const results = { accuracy: 0.8765, training_time_seconds: 12.345 };

  it('renders the section title', () => {
    render(<ResultsTable results={results} />);
    expect(screen.getByText('Evaluation Metrics')).toBeInTheDocument();
  });

  it('displays formatted accuracy as percentage', () => {
    render(<ResultsTable results={results} />);
    expect(screen.getByText('87.65%')).toBeInTheDocument();
  });

  it('displays formatted training duration', () => {
    render(<ResultsTable results={results} />);
    expect(screen.getByText('12.35s')).toBeInTheDocument();
  });

  it('renders metric labels', () => {
    render(<ResultsTable results={results} />);
    expect(screen.getByText('Model Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Training Duration')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<ResultsTable results={results} />);
    expect(screen.getByText('Metric')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });
});
