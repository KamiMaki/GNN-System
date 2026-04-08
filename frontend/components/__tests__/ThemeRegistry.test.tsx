import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeRegistry from '../ThemeRegistry';
import { useColorMode } from '@/contexts/ColorModeContext';

// Mock AntdRegistry
jest.mock('@ant-design/nextjs-registry', () => ({
  AntdRegistry: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function ColorModeConsumer() {
  const { mode, toggleColorMode } = useColorMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggleColorMode}>Toggle</button>
    </div>
  );
}

describe('ThemeRegistry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders children with default light mode', () => {
    render(
      <ThemeRegistry>
        <ColorModeConsumer />
      </ThemeRegistry>
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('toggles color mode', async () => {
    const user = userEvent.setup();
    render(
      <ThemeRegistry>
        <ColorModeConsumer />
      </ThemeRegistry>
    );

    await user.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(localStorage.getItem('color_mode')).toBe('dark');
  });

  it('restores mode from localStorage', () => {
    localStorage.setItem('color_mode', 'dark');
    render(
      <ThemeRegistry>
        <ColorModeConsumer />
      </ThemeRegistry>
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });
});
