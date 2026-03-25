import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => '/',
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function TestConsumer() {
  const { user, isLoading, initialized, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="initialized">{String(initialized)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.name : 'null'}</span>
      <button onClick={login}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockPush.mockClear();
  });

  it('initializes with no user', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByText('null')).toBeInTheDocument();
    expect(screen.getByTestId('initialized')).toHaveTextContent('true');
  });

  it('restores user from localStorage', async () => {
    const storedUser = { id: 'u1', name: 'Stored User', email: 'a@b.com', role: '' };
    localStorageMock.setItem('mock_user', JSON.stringify(storedUser));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByText('Stored User')).toBeInTheDocument();
  });

  it('login sets user and navigates to dashboard', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await user.click(screen.getByText('Login'));

    expect(await screen.findByText('Alex Chen')).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('mock_user', expect.any(String));
  });

  it('logout clears user and navigates to login', async () => {
    const storedUser = { id: 'u1', name: 'Test', email: 'a@b.com', role: '' };
    localStorageMock.setItem('mock_user', JSON.stringify(storedUser));

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await screen.findByText('Test');
    await user.click(screen.getByText('Logout'));

    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('mock_user');
  });
});
