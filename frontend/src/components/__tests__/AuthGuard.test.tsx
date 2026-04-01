import { render, screen } from '@testing-library/react';
import AuthGuard from '../AuthGuard';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => mockPathname,
}));

// Mock AuthContext
const mockAuthValues = {
  user: null as { id: string; name: string; email: string; role: string } | null,
  isLoading: false,
  initialized: true,
  login: jest.fn(),
  logout: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthValues,
}));

// Mock antd Spin
jest.mock('antd', () => ({
  Spin: ({ size }: { size: string }) => <div data-testid="spin">{size}</div>,
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockAuthValues.user = null;
    mockAuthValues.initialized = true;
    mockPathname = '/dashboard';
  });

  it('redirects to login when not authenticated', () => {
    render(
      <AuthGuard>
        <span>Protected</span>
      </AuthGuard>
    );
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('renders children when authenticated', () => {
    mockAuthValues.user = { id: '1', name: 'Test', email: 'test@test.com', role: 'admin' };
    render(
      <AuthGuard>
        <span>Protected</span>
      </AuthGuard>
    );
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('shows spinner when not initialized', () => {
    mockAuthValues.initialized = false;
    render(
      <AuthGuard>
        <span>Protected</span>
      </AuthGuard>
    );
    expect(screen.getByTestId('spin')).toBeInTheDocument();
  });

  it('renders children on login page even without auth', () => {
    mockPathname = '/login';
    render(
      <AuthGuard>
        <span>Login Page</span>
      </AuthGuard>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('returns null when not authenticated and not on login page', () => {
    const { container } = render(
      <AuthGuard>
        <span>Protected</span>
      </AuthGuard>
    );
    expect(container.querySelector('span')).toBeNull();
  });
});
