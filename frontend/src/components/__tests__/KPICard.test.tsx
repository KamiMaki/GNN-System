import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPICard from '../KPICard';

describe('KPICard', () => {
  it('renders title and formatted value', () => {
    const { container } = render(<KPICard title="Test Metric" value={42.567} color="#00ff00" />);
    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    // Ant Design Statistic splits value into int and decimal parts
    const valueEl = container.querySelector('.ant-statistic-content-value');
    expect(valueEl?.textContent).toBe('42.57');
  });

  it('appends ns suffix for nanosecond metrics', () => {
    render(<KPICard title="Predicted Critical Delay (ns)" value={3.14} color="#ff0000" />);
    expect(screen.getByText('ns')).toBeInTheDocument();
  });

  it('does not show ns suffix for non-nanosecond metrics', () => {
    render(<KPICard title="Layout Score (0-100)" value={85} color="#0000ff" />);
    expect(screen.queryByText('ns')).not.toBeInTheDocument();
  });

  it('applies color to value', () => {
    const { container } = render(<KPICard title="Test" value={10} color="#ff5500" />);
    const valueEl = container.querySelector('.ant-statistic-content-value');
    expect(valueEl).toHaveStyle({ color: '#ff5500' });
  });
});
