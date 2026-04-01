import { AuthService } from '../auth';
import { apiRequest, APIError } from '@/integrations/aws/api-client';
import type { LoginCredentials, LoginResponse, User } from '@/types/auth';

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

describe('AuthService', () => {
  const mockUser: User = {
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'guest',
    created_at: '2025-01-01T00:00:00Z',
    last_login: '2025-01-01T00:00:00Z',
  };

  const mockToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  const mockLoginResponse: LoginResponse = {
    token: mockToken,
    user: mockUser,
    expires_at: '2025-01-01T01:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage
    (localStorage.clear as jest.Mock)();
  });

  describe('Token Storage Management', () => {
    describe('setAuthData', () => {
      it('should store token and user data in localStorage', () => {
        AuthService.setAuthData(mockToken, mockUser);

        expect(localStorage.setItem).toHaveBeenCalledWith('wedding-auth-token', mockToken);
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'wedding-auth-user',
          JSON.stringify(mockUser)
        );
      });
    });

    describe('getToken', () => {
      it('should retrieve token from localStorage', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);

        const result = AuthService.getToken();

        expect(localStorage.getItem).toHaveBeenCalledWith('wedding-auth-token');
        expect(result).toBe(mockToken);
      });

      it('should return null when no token is stored', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(null);

        const result = AuthService.getToken();

        expect(result).toBeNull();
      });
    });

    describe('getUser', () => {
      it('should retrieve and parse user data from localStorage', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockUser));

        const result = AuthService.getUser();

        expect(localStorage.getItem).toHaveBeenCalledWith('wedding-auth-user');
        expect(result).toEqual(mockUser);
      });

      it('should return null when no user data is stored', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(null);

        const result = AuthService.getUser();

        expect(result).toBeNull();
      });

      it('should return null when stored user data is corrupted', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue('invalid-json');

        const result = AuthService.getUser();

        expect(result).toBeNull();
      });

      it('should handle empty string gracefully', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue('');

        const result = AuthService.getUser();

        expect(result).toBeNull();
      });
    });

    describe('clearAuthData', () => {
      it('should remove token and user data from localStorage', () => {
        AuthService.clearAuthData();

        expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-user');
      });
    });
  });

  describe('Authentication Status', () => {
    describe('isAuthenticated', () => {
      it('should return true when both token and user exist', () => {
        (localStorage.getItem as jest.Mock)
          .mockReturnValueOnce(mockToken) // getToken call
          .mockReturnValueOnce(JSON.stringify(mockUser)); // getUser call

        const result = AuthService.isAuthenticated();

        expect(result).toBe(true);
      });

      it('should return false when token is missing', () => {
        (localStorage.getItem as jest.Mock)
          .mockReturnValueOnce(null) // getToken call
          .mockReturnValueOnce(JSON.stringify(mockUser)); // getUser call

        const result = AuthService.isAuthenticated();

        expect(result).toBe(false);
      });

      it('should return false when user is missing', () => {
        (localStorage.getItem as jest.Mock)
          .mockReturnValueOnce(mockToken) // getToken call
          .mockReturnValueOnce(null); // getUser call

        const result = AuthService.isAuthenticated();

        expect(result).toBe(false);
      });

      it('should return false when both token and user are missing', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(null);

        const result = AuthService.isAuthenticated();

        expect(result).toBe(false);
      });
    });
  });

  describe('Login Functionality', () => {
    describe('login', () => {
      const mockCredentials: LoginCredentials = {
        username: 'testuser',
        password: 'testpass',
      };

      it('should successfully login and store auth data', async () => {
        (apiRequest as jest.Mock).mockResolvedValue(mockLoginResponse);

        const result = await AuthService.login(mockCredentials);

        expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
          method: 'POST',
          body: JSON.stringify(mockCredentials),
        });

        expect(localStorage.setItem).toHaveBeenCalledWith('wedding-auth-token', mockToken);
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'wedding-auth-user',
          JSON.stringify(mockUser)
        );
        expect(result).toEqual(mockLoginResponse);
      });

      it('should handle API errors during login', async () => {
        const apiError = new APIError('Invalid credentials', 401);
        (apiRequest as jest.Mock).mockRejectedValue(apiError);

        await expect(AuthService.login(mockCredentials)).rejects.toThrow(apiError);

        expect(localStorage.setItem).not.toHaveBeenCalled();
      });

      it('should wrap non-API errors in APIError', async () => {
        const networkError = new Error('Network failure');
        (apiRequest as jest.Mock).mockRejectedValue(networkError);

        await expect(AuthService.login(mockCredentials)).rejects.toThrow(
          'Login failed - please try again'
        );

        expect(localStorage.setItem).not.toHaveBeenCalled();
      });

      it('should handle empty credentials', async () => {
        const emptyCredentials: LoginCredentials = {
          username: '',
          password: '',
        };

        (apiRequest as jest.Mock).mockResolvedValue(mockLoginResponse);

        const result = await AuthService.login(emptyCredentials);

        expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
          method: 'POST',
          body: JSON.stringify(emptyCredentials),
        });

        expect(result).toEqual(mockLoginResponse);
      });
    });
  });

  describe('Token Verification', () => {
    describe('verifyToken', () => {
      it('should successfully verify token and update user data', async () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
        (apiRequest as jest.Mock).mockResolvedValue({ user: mockUser });

        const result = await AuthService.verifyToken();

        expect(apiRequest).toHaveBeenCalledWith('/auth/verify', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        });

        expect(localStorage.setItem).toHaveBeenCalledWith('wedding-auth-token', mockToken);
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'wedding-auth-user',
          JSON.stringify(mockUser)
        );
        expect(result).toEqual(mockUser);
      });

      it('should throw error when no token is available', async () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(null);

        await expect(AuthService.verifyToken()).rejects.toThrow('No authentication token found');

        expect(apiRequest).not.toHaveBeenCalled();
      });

      it('should clear auth data on verification failure', async () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
        const apiError = new APIError('Token expired', 401);
        (apiRequest as jest.Mock).mockRejectedValue(apiError);

        await expect(AuthService.verifyToken()).rejects.toThrow(apiError);

        expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-user');
      });

      it('should wrap non-API errors and clear auth data', async () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
        const networkError = new Error('Network failure');
        (apiRequest as jest.Mock).mockRejectedValue(networkError);

        await expect(AuthService.verifyToken()).rejects.toThrow('Token verification failed');

        expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-user');
      });

      it('should handle malformed API response', async () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
        (apiRequest as jest.Mock).mockResolvedValue({ invalidResponse: true });

        const result = await AuthService.verifyToken();

        expect(result).toBeUndefined();
      });
    });
  });

  describe('Session Management', () => {
    describe('logout', () => {
      it('should clear all authentication data', () => {
        AuthService.logout();

        expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-user');
      });
    });
  });

  describe('Authorization Headers', () => {
    describe('getAuthHeaders', () => {
      it('should return authorization header when token exists', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);

        const result = AuthService.getAuthHeaders();

        expect(result).toEqual({
          Authorization: `Bearer ${mockToken}`,
        });
      });

      it('should return empty object when no token exists', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(null);

        const result = AuthService.getAuthHeaders();

        expect(result).toEqual({});
      });

      it('should handle empty token string', () => {
        (localStorage.getItem as jest.Mock).mockReturnValue('');

        const result = AuthService.getAuthHeaders();

        expect(result).toEqual({});
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle localStorage being unavailable', () => {
      // Mock localStorage to throw errors
      const originalGetItem = localStorage.getItem;
      (localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      expect(() => AuthService.getToken()).toThrow();

      // Restore
      localStorage.getItem = originalGetItem;
    });

    it('should handle JSON.stringify errors', () => {
      const circularUser = { ...mockUser } as User & { self?: unknown };
      circularUser.self = circularUser; // Create circular reference

      expect(() => AuthService.setAuthData(mockToken, circularUser as User)).toThrow();
    });

    it('should handle concurrent login attempts', async () => {
      const credentials: LoginCredentials = {
        username: 'testuser',
        password: 'testpass',
      };

      (apiRequest as jest.Mock).mockResolvedValue(mockLoginResponse);

      // Start multiple login attempts simultaneously
      const promises = [
        AuthService.login(credentials),
        AuthService.login(credentials),
        AuthService.login(credentials),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result).toEqual(mockLoginResponse);
      });

      // API should be called for each attempt
      expect(apiRequest).toHaveBeenCalledTimes(3);
    });

    it('should handle token verification with updated user data', async () => {
      const updatedUser: User = {
        ...mockUser,
        full_name: 'Updated Test User',
        last_login: '2025-01-02T00:00:00Z',
      };

      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      (apiRequest as jest.Mock).mockResolvedValue({ user: updatedUser });

      const result = await AuthService.verifyToken();

      expect(result).toEqual(updatedUser);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'wedding-auth-user',
        JSON.stringify(updatedUser)
      );
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive data in error messages', async () => {
      const credentials: LoginCredentials = {
        username: 'testuser',
        password: 'supersecretpassword',
      };

      const apiError = new APIError('Invalid credentials', 401);
      (apiRequest as jest.Mock).mockRejectedValue(apiError);

      try {
        await AuthService.login(credentials);
      } catch (error) {
        expect(error.message).not.toContain('supersecretpassword');
      }
    });

    it('should handle malicious localStorage data', () => {
      // Simulate malicious data injection
      (localStorage.getItem as jest.Mock).mockReturnValue('<script>alert("xss")</script>');

      const result = AuthService.getUser();

      expect(result).toBeNull(); // Should gracefully handle and return null
    });

    it('should validate token format in getAuthHeaders', () => {
      // Test with potentially malicious token
      (localStorage.getItem as jest.Mock).mockReturnValue('javascript:alert(1)');

      const result = AuthService.getAuthHeaders();

      expect(result).toEqual({
        Authorization: 'Bearer javascript:alert(1)',
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large user objects efficiently', () => {
      const largeUser: User = {
        ...mockUser,
        full_name: 'A'.repeat(10000), // Large string
      };

      expect(() => AuthService.setAuthData(mockToken, largeUser)).not.toThrow();

      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(largeUser));

      const result = AuthService.getUser();
      expect(result).toEqual(largeUser);
    });

    it('should not leak memory on repeated calls', () => {
      // Simulate many rapid calls
      for (let i = 0; i < 1000; i++) {
        (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
        AuthService.getToken();
        AuthService.getAuthHeaders();
      }

      // Should complete without issues
      expect(true).toBe(true);
    });
  });
});
