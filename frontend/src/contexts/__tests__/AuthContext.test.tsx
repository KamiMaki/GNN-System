import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-auth/react
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
let mockSession: { user?: { id?: string; name?: string; email?: string; image?: string } } | null = null;
let mockStatus = 'unauthenticated';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockSession, status: mockStatus }),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}));

import { AuthProvider, useAuth } from '../AuthContext';

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

describe('AuthContext (Keycloak)', () => {
  beforeEach(() => {
    mockSession = null;
    mockStatus = 'unauthenticated';
    mockSignIn.mockClear();
    mockSignOut.mockClear();
  });

  it('shows no user when unauthenticated', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('initialized')).toHaveTextContent('true');
  });

  it('shows loading state', () => {
    mockStatus = 'loading';

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('initialized')).toHaveTextContent('false');
  });

  it('provides user from session', () => {
    mockSession = {
      user: { id: 'kc-001', name: 'Keycloak User', email: 'kc@test.com', image: 'https://example.com/avatar.png' },
    };
    mockStatus = 'authenticated';

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('Keycloak User');
    expect(screen.getByTestId('initialized')).toHaveTextContent('true');
  });

  it('login calls signIn with keycloak', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await user.click(screen.getByText('Login'));
    expect(mockSignIn).toHaveBeenCalledWith('keycloak');
  });

  it('logout calls signOut with redirect to login', async () => {
    mockSession = {
      user: { id: 'kc-001', name: 'Test', email: 'a@b.com' },
    };
    mockStatus = 'authenticated';

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await user.click(screen.getByText('Logout'));
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: '/login' });
  });
});
