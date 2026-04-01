import { render } from '@testing-library/react';
import PipelineStepper from '../PipelineStepper';

// Mock AppHeader since PipelineStepper is just a wrapper
jest.mock('@/components/AppHeader', () => {
  return function MockAppHeader(props: Record<string, unknown>) {
    return (
      <div data-testid="app-header" data-step={props.projectStep} data-name={props.projectName}>
        AppHeader
      </div>
    );
  };
});

describe('PipelineStepper', () => {
  it('renders AppHeader with correct props', () => {
    const { getByTestId } = render(
      <PipelineStepper currentStep={2} projectName="TestProject" projectId="p1" status="uploaded" />
    );
    const header = getByTestId('app-header');
    expect(header).toHaveAttribute('data-step', '2');
    expect(header).toHaveAttribute('data-name', 'TestProject');
  });
});
