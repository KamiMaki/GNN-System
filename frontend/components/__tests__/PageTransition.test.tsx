import { render, screen } from '@testing-library/react';
import PageTransition from '../PageTransition';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div data-testid="motion-div" {...props}>{children}</div>
    ),
  },
}));

describe('PageTransition', () => {
  it('renders children', () => {
    render(
      <PageTransition>
        <span>Hello</span>
      </PageTransition>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('wraps children in motion div', () => {
    render(
      <PageTransition>
        <span>Content</span>
      </PageTransition>
    );
    expect(screen.getByTestId('motion-div')).toBeInTheDocument();
  });
});
