import { render, screen } from '@testing-library/react';
import { ColorModeContext, useColorMode } from '../ColorModeContext';

function TestConsumer() {
  const { mode, toggleColorMode } = useColorMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggleColorMode}>Toggle</button>
    </div>
  );
}

describe('ColorModeContext', () => {
  it('provides default light mode', () => {
    render(<TestConsumer />);
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('provides custom mode from provider', () => {
    render(
      <ColorModeContext.Provider value={{ mode: 'dark', toggleColorMode: jest.fn() }}>
        <TestConsumer />
      </ColorModeContext.Provider>
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });
});
