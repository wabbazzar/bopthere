import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';
import { AuthService } from '@/lib/auth';
import type { User, LoginResponse } from '@/types/auth';

// Mock the AuthService
jest.mock('@/lib/auth', () => ({
  AuthService: {
    login: jest.fn(),
    logout: jest.fn(),
    getToken: jest.fn(),
    getUser: jest.fn(),
    verifyToken: jest.fn(),
    setAuthData: jest.fn(),
    clearAuthData: jest.fn(),
    isAuthenticated: jest.fn(),
    getAuthHeaders: jest.fn(),
  },
}));

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock the API client
jest.mock('@/integrations/aws/api-client', () => ({
  apiRequest: jest.fn(),
  APIError: class APIError extends Error {
    constructor(
      message: string,
      public statusCode?: number
    ) {
      super(message);
      this.name = 'APIError';
    }
  },
}));

// Test component to access the auth context
const TestComponent: React.FC = () => {
  const { user, isAuthenticated, isLoading, login, logout, verifyToken } = useAuth();

  return (
    <div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
      <div data-testid="isAuthenticated">{isAuthenticated.toString()}</div>
      <div data-testid="isLoading">{isLoading.toString()}</div>
      <button data-testid="login" onClick={() => login('testuser', 'testpass')}>
        Login
      </button>
      <button data-testid="logout" onClick={logout}>
        Logout
      </button>
      <button data-testid="verify" onClick={() => verifyToken()}>
        Verify Token
      </button>
    </div>
  );
};

// Test utilities
const mockUser: User = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'guest',
  created_at: '2025-01-01T00:00:00Z',
  last_login: '2025-01-01T00:00:00Z',
};

const mockLoginResponse: LoginResponse = {
  token: 'mock-jwt-token',
  user: mockUser,
  expires_at: '2025-01-01T01:00:00Z',
};

const renderWithAuthProvider = () => {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
};

describe('AuthContext', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage mocks
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
    (localStorage.setItem as jest.Mock).mockClear();
    (localStorage.removeItem as jest.Mock).mockClear();
  });

  describe('Context Provider', () => {
    it('should throw error when useAuth is used outside AuthProvider', () => {
      // Capture console.error to prevent test output pollution
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => render(<TestComponent />)).toThrow(
        'useAuth must be used within an AuthProvider'
      );

      console.error = originalError;
    });

    it('should provide initial auth state', () => {
      renderWithAuthProvider();

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('isLoading')).toHaveTextContent('true');
    });
  });

  describe('Authentication State Management', () => {
    it('should initialize with no stored authentication data', async () => {
      (AuthService.getToken as jest.Mock).mockReturnValue(null);
      (AuthService.getUser as jest.Mock).mockReturnValue(null);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });

    it('should initialize with stored authentication data and verify token', async () => {
      (AuthService.getToken as jest.Mock).mockReturnValue('stored-token');
      (AuthService.getUser as jest.Mock).mockReturnValue(mockUser);
      (AuthService.verifyToken as jest.Mock).mockResolvedValue(mockUser);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      expect(AuthService.verifyToken).toHaveBeenCalled();
    });

    it('should clear invalid stored token on verification failure', async () => {
      (AuthService.getToken as jest.Mock).mockReturnValue('invalid-token');
      (AuthService.getUser as jest.Mock).mockReturnValue(mockUser);
      (AuthService.verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(AuthService.clearAuthData).toHaveBeenCalled();
    });
  });

  describe('Login Functionality', () => {
    it('should handle successful login', async () => {
      (AuthService.login as jest.Mock).mockResolvedValue(mockLoginResponse);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      const loginButton = screen.getByTestId('login');

      await act(async () => {
        await user.click(loginButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      });

      expect(AuthService.login).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass',
      });
    });

    it('should handle login failure', async () => {
      const loginError = new Error('Invalid credentials');
      (AuthService.login as jest.Mock).mockRejectedValue(loginError);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      const loginButton = screen.getByTestId('login');

      await act(async () => {
        try {
          await user.click(loginButton);
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('null');
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });
    });

    it('should show loading state during login', async () => {
      (AuthService.login as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockLoginResponse), 100))
      );

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      const loginButton = screen.getByTestId('login');

      await act(async () => {
        user.click(loginButton);
      });

      // Should show loading during login
      expect(screen.getByTestId('isLoading')).toHaveTextContent('true');

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });
    });
  });

  describe('Logout Functionality', () => {
    it('should handle logout', async () => {
      // Start with authenticated state
      (AuthService.getToken as jest.Mock).mockReturnValue('stored-token');
      (AuthService.getUser as jest.Mock).mockReturnValue(mockUser);
      (AuthService.verifyToken as jest.Mock).mockResolvedValue(mockUser);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      });

      const logoutButton = screen.getByTestId('logout');

      await act(async () => {
        await user.click(logoutButton);
      });

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(AuthService.logout).toHaveBeenCalled();
    });
  });

  describe('Token Verification', () => {
    it('should handle successful token verification', async () => {
      (AuthService.verifyToken as jest.Mock).mockResolvedValue(mockUser);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      const verifyButton = screen.getByTestId('verify');

      await act(async () => {
        await user.click(verifyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
      });

      expect(AuthService.verifyToken).toHaveBeenCalled();
    });

    it('should handle token verification failure', async () => {
      const verificationError = new Error('Token expired');
      (AuthService.verifyToken as jest.Mock).mockRejectedValue(verificationError);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      const verifyButton = screen.getByTestId('verify');

      await act(async () => {
        try {
          await user.click(verifyButton);
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('null');
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      });
    });
  });

  describe('Authentication State Computed Values', () => {
    it('should correctly compute isAuthenticated when user and token exist', async () => {
      (AuthService.getToken as jest.Mock).mockReturnValue('valid-token');
      (AuthService.getUser as jest.Mock).mockReturnValue(mockUser);
      (AuthService.verifyToken as jest.Mock).mockResolvedValue(mockUser);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      });
    });

    it('should correctly compute isAuthenticated as false when user is null', async () => {
      (AuthService.getToken as jest.Mock).mockReturnValue('token');
      (AuthService.getUser as jest.Mock).mockReturnValue(null);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      });
    });

    it('should correctly compute isAuthenticated as false when token is null', async () => {
      (AuthService.getToken as jest.Mock).mockReturnValue(null);
      (AuthService.getUser as jest.Mock).mockReturnValue(mockUser);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      });
    });
  });

  describe('Session Persistence', () => {
    it('should persist authentication state across page reloads', async () => {
      // Simulate stored auth data
      const storedToken = 'persistent-token';
      const storedUser = mockUser;

      (AuthService.getToken as jest.Mock).mockReturnValue(storedToken);
      (AuthService.getUser as jest.Mock).mockReturnValue(storedUser);
      (AuthService.verifyToken as jest.Mock).mockResolvedValue(storedUser);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(storedUser));
      });

      expect(AuthService.getToken).toHaveBeenCalled();
      expect(AuthService.getUser).toHaveBeenCalled();
      expect(AuthService.verifyToken).toHaveBeenCalled();
    });

    it('should handle corrupted stored user data gracefully', async () => {
      (AuthService.getToken as jest.Mock).mockReturnValue('valid-token');
      (AuthService.getUser as jest.Mock).mockReturnValue(null); // Corrupted/missing user data

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during login gracefully', async () => {
      const networkError = new Error('Network error');
      (AuthService.login as jest.Mock).mockRejectedValue(networkError);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      const loginButton = screen.getByTestId('login');

      await act(async () => {
        try {
          await user.click(loginButton);
        } catch (error) {
          expect(error).toBe(networkError);
        }
      });

      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });

    it('should handle initialization errors gracefully', async () => {
      (AuthService.getToken as jest.Mock).mockReturnValue('token');
      (AuthService.getUser as jest.Mock).mockReturnValue(mockUser);
      (AuthService.verifyToken as jest.Mock).mockRejectedValue(new Error('Server error'));

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(AuthService.clearAuthData).toHaveBeenCalled();
    });
  });

  describe('State Reducer Logic', () => {
    it('should handle LOGIN_SUCCESS action correctly', async () => {
      (AuthService.login as jest.Mock).mockResolvedValue(mockLoginResponse);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      const loginButton = screen.getByTestId('login');

      await act(async () => {
        await user.click(loginButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });
    });

    it('should handle LOGIN_FAILURE action correctly', async () => {
      (AuthService.login as jest.Mock).mockRejectedValue(new Error('Login failed'));

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });

      const loginButton = screen.getByTestId('login');

      await act(async () => {
        try {
          await user.click(loginButton);
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('null');
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      });
    });

    it('should handle LOGOUT action correctly', async () => {
      // Start authenticated
      (AuthService.getToken as jest.Mock).mockReturnValue('token');
      (AuthService.getUser as jest.Mock).mockReturnValue(mockUser);
      (AuthService.verifyToken as jest.Mock).mockResolvedValue(mockUser);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      });

      const logoutButton = screen.getByTestId('logout');

      await act(async () => {
        await user.click(logoutButton);
      });

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });
  });
});
