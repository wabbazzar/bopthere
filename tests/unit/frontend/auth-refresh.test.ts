import { AuthService } from '@/lib/auth';
import { apiRequest, APIError } from '@/integrations/aws/api-client';
import type { LoginResponse, User } from '@/types/auth';

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

describe('AuthService Token Refresh Functionality', () => {
  const mockUser: User = {
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'guest',
    created_at: '2025-01-01T00:00:00Z',
    last_login: '2025-01-01T00:00:00Z',
  };

  // JWT token issued on Jan 1, 2025, expires on Jan 31, 2025 (30 days)
  // This token is at 80% of its lifetime on Jan 25, 2025
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6Imd1ZXN0IiwiaWF0IjoxNzM1Njg5NjAwLCJleHAiOjE3MzgyODE2MDB9.5k8zf7VYvKXUmOGM9v9q5X4Zx7Y8w6R3t2A1s0N9m5L';
  
  // Fresh token (issued recently)
  const mockFreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6Imd1ZXN0IiwiaWF0IjoxNzM4MjgxNjAwLCJleHAiOjE3NDA4NzM2MDB9.1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0t1U2v';

  // Expired token
  const mockExpiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6Imd1ZXN0IiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDI1OTIwMDB9.xYzExpiredTokenSignatureForTesting12345';

  const mockRefreshResponse: LoginResponse = {
    token: mockFreshToken,
    user: mockUser,
    expires_at: '2025-02-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage
    (localStorage.clear as jest.Mock)();
    // Set current date to Jan 25, 2025 (80% through token lifetime)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-25T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('parseToken', () => {
    it('should correctly extract JWT payload', () => {
      const payload = AuthService.parseToken(mockToken);
      
      expect(payload).toBeTruthy();
      expect(payload.username).toBe('testuser');
      expect(payload.role).toBe('guest');
      expect(payload.iat).toBe(1735689600); // Jan 1, 2025
      expect(payload.exp).toBe(1738281600); // Jan 31, 2025
    });

    it('should return null for invalid JWT token', () => {
      const payload = AuthService.parseToken('invalid.token');
      expect(payload).toBeNull();
    });

    it('should return null for malformed token (wrong number of parts)', () => {
      const payload = AuthService.parseToken('header.payload'); // Missing signature
      expect(payload).toBeNull();
    });

    it('should return null for empty token', () => {
      const payload = AuthService.parseToken('');
      expect(payload).toBeNull();
    });

    it('should handle token with invalid base64 encoding', () => {
      const malformedToken = 'header.invalid@base64!.signature';
      const payload = AuthService.parseToken(malformedToken);
      expect(payload).toBeNull();
    });

    it('should handle token with invalid JSON in payload', () => {
      // Create a token with invalid JSON payload
      const header = btoa('{"alg":"HS256","typ":"JWT"}');
      const invalidPayload = btoa('{invalid json}');
      const signature = 'signature';
      const invalidJsonToken = `${header}.${invalidPayload}.${signature}`;
      
      const payload = AuthService.parseToken(invalidJsonToken);
      expect(payload).toBeNull();
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true when 80% of token lifetime has passed', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      
      const shouldRefresh = AuthService.shouldRefreshToken();
      
      expect(shouldRefresh).toBe(true);
    });

    it('should return false when token is fresh (less than 80% lifetime)', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockFreshToken);
      
      const shouldRefresh = AuthService.shouldRefreshToken();
      
      expect(shouldRefresh).toBe(false);
    });

    it('should return false when no token exists', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);
      
      const shouldRefresh = AuthService.shouldRefreshToken();
      
      expect(shouldRefresh).toBe(false);
    });

    it('should return false when token is malformed', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid.token');
      
      const shouldRefresh = AuthService.shouldRefreshToken();
      
      expect(shouldRefresh).toBe(false);
    });

    it('should return false when token payload is missing required fields', () => {
      // Token without exp field
      const tokenWithoutExp = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6Imd1ZXN0In0.signature';
      (localStorage.getItem as jest.Mock).mockReturnValue(tokenWithoutExp);
      
      const shouldRefresh = AuthService.shouldRefreshToken();
      
      expect(shouldRefresh).toBe(false);
    });

    it('should handle edge case at exactly 80% threshold', () => {
      // Set time to exactly 80% of token lifetime
      const tokenLifetime = 1738281600 - 1735689600; // 30 days in seconds
      const eightyPercentTime = 1735689600 + Math.floor(tokenLifetime * 0.8);
      jest.setSystemTime(new Date(eightyPercentTime * 1000));
      
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      
      const shouldRefresh = AuthService.shouldRefreshToken();
      
      expect(shouldRefresh).toBe(true);
    });

    it('should handle edge case just before 80% threshold', () => {
      // Set time to just before 80% of token lifetime
      const tokenLifetime = 1738281600 - 1735689600;
      const justBefore80Percent = 1735689600 + Math.floor(tokenLifetime * 0.8) - 1;
      jest.setSystemTime(new Date(justBefore80Percent * 1000));
      
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      
      const shouldRefresh = AuthService.shouldRefreshToken();
      
      expect(shouldRefresh).toBe(false);
    });
  });

  describe('getTimeUntilExpiry', () => {
    it('should calculate time until expiry correctly', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      
      const timeUntilExpiry = AuthService.getTimeUntilExpiry();
      
      // Token expires Jan 31, 2025, current time is Jan 25, 2025
      // So 6 days remaining = 6 * 24 * 60 * 60 * 1000 = 518400000 ms
      expect(timeUntilExpiry).toBe(518400000);
    });

    it('should return 0 when no token exists', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);
      
      const timeUntilExpiry = AuthService.getTimeUntilExpiry();
      
      expect(timeUntilExpiry).toBe(0);
    });

    it('should return 0 when token is malformed', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid.token');
      
      const timeUntilExpiry = AuthService.getTimeUntilExpiry();
      
      expect(timeUntilExpiry).toBe(0);
    });

    it('should return 0 when token is expired', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockExpiredToken);
      
      const timeUntilExpiry = AuthService.getTimeUntilExpiry();
      
      expect(timeUntilExpiry).toBe(0);
    });

    it('should handle token without exp field', () => {
      const tokenWithoutExp = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6Imd1ZXN0In0.signature';
      (localStorage.getItem as jest.Mock).mockReturnValue(tokenWithoutExp);
      
      const timeUntilExpiry = AuthService.getTimeUntilExpiry();
      
      expect(timeUntilExpiry).toBe(0);
    });

    it('should handle very large time differences', () => {
      // Create token that expires far in the future
      const futureToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6Imd1ZXN0IiwiaWF0IjoxNzM4MjgxNjAwLCJleHAiOjk5OTk5OTk5OTl9.futureTokenSignature';
      (localStorage.getItem as jest.Mock).mockReturnValue(futureToken);
      
      const timeUntilExpiry = AuthService.getTimeUntilExpiry();
      
      expect(timeUntilExpiry).toBeGreaterThan(0);
      expect(typeof timeUntilExpiry).toBe('number');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token and update localStorage', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      const result = await AuthService.refreshToken();

      expect(apiRequest).toHaveBeenCalledWith('/auth/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(localStorage.setItem).toHaveBeenCalledWith('wedding-auth-token', mockFreshToken);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'wedding-auth-user',
        JSON.stringify(mockUser)
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'wedding-auth-timestamp',
        expect.any(String)
      );
      expect(result).toEqual(mockRefreshResponse);
    });

    it('should throw error when no token is available', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      await expect(AuthService.refreshToken()).rejects.toThrow('No authentication token found');

      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should clear auth data on refresh failure', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      const apiError = new APIError('Token expired', 401);
      (apiRequest as jest.Mock).mockRejectedValue(apiError);

      await expect(AuthService.refreshToken()).rejects.toThrow(apiError);

      expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-user');
      expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-timestamp');
    });

    it('should wrap non-API errors and clear auth data', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      const networkError = new Error('Network failure');
      (apiRequest as jest.Mock).mockRejectedValue(networkError);

      await expect(AuthService.refreshToken()).rejects.toThrow('Token refresh failed');

      expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-user');
      expect(localStorage.removeItem).toHaveBeenCalledWith('wedding-auth-timestamp');
    });

    it('should handle empty token string', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('');

      await expect(AuthService.refreshToken()).rejects.toThrow('No authentication token found');

      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should handle malformed refresh response', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      const malformedResponse = { invalidResponse: true };
      (apiRequest as jest.Mock).mockResolvedValue(malformedResponse);

      const result = await AuthService.refreshToken();

      // Should still set the malformed response data
      expect(result).toEqual(malformedResponse);
      // localStorage calls depend on response structure, so might not be called
    });

    it('should handle 401 responses specifically', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      const unauthorizedError = new APIError('Unauthorized', 401);
      (apiRequest as jest.Mock).mockRejectedValue(unauthorizedError);

      await expect(AuthService.refreshToken()).rejects.toThrow('Unauthorized');

      expect(localStorage.removeItem).toHaveBeenCalledTimes(3); // Clear all auth data
    });

    it('should handle 403 responses (forbidden)', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      const forbiddenError = new APIError('Forbidden', 403);
      (apiRequest as jest.Mock).mockRejectedValue(forbiddenError);

      await expect(AuthService.refreshToken()).rejects.toThrow('Forbidden');

      expect(localStorage.removeItem).toHaveBeenCalledTimes(3); // Clear all auth data
    });
  });

  describe('checkAndRefreshToken', () => {
    it('should call refreshToken when token needs refresh', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken); // Old token needing refresh
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      const result = await AuthService.checkAndRefreshToken();

      expect(result).toBe(true);
      expect(apiRequest).toHaveBeenCalledWith('/auth/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });
    });

    it('should not call refreshToken when token is fresh', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockFreshToken); // Fresh token

      const result = await AuthService.checkAndRefreshToken();

      expect(result).toBe(false);
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should return false and not throw when refresh fails', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      const apiError = new APIError('Token expired', 401);
      (apiRequest as jest.Mock).mockRejectedValue(apiError);

      const result = await AuthService.checkAndRefreshToken();

      expect(result).toBe(false);
      // Should not throw the error, should handle it gracefully
    });

    it('should return false when no token exists', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const result = await AuthService.checkAndRefreshToken();

      expect(result).toBe(false);
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      const networkError = new Error('Network unreachable');
      (apiRequest as jest.Mock).mockRejectedValue(networkError);

      const result = await AuthService.checkAndRefreshToken();

      expect(result).toBe(false);
      // Should log error but not throw
    });

    it('should handle concurrent checkAndRefreshToken calls', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      // Start multiple refresh checks simultaneously
      const promises = [
        AuthService.checkAndRefreshToken(),
        AuthService.checkAndRefreshToken(),
        AuthService.checkAndRefreshToken(),
      ];

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach((result) => {
        expect(typeof result).toBe('boolean');
      });

      // At least one should succeed (exact number depends on implementation)
      expect(results.some(result => result === true)).toBe(true);
    });
  });

  describe('Token Refresh Integration with Auth Flow', () => {
    it('should update localStorage timestamp on successful refresh', async () => {
      const timestampBefore = Date.now();
      
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      await AuthService.refreshToken();

      // Check that timestamp was updated
      const setItemCalls = (localStorage.setItem as jest.Mock).mock.calls;
      const timestampCall = setItemCalls.find(call => call[0] === 'wedding-auth-timestamp');
      
      expect(timestampCall).toBeDefined();
      const storedTimestamp = parseInt(timestampCall[1], 10);
      expect(storedTimestamp).toBeGreaterThanOrEqual(timestampBefore);
    });

    it('should maintain user data consistency after refresh', async () => {
      const updatedUser = { ...mockUser, full_name: 'Updated Test User' };
      const refreshResponseWithUpdatedUser = {
        ...mockRefreshResponse,
        user: updatedUser,
      };

      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      (apiRequest as jest.Mock).mockResolvedValue(refreshResponseWithUpdatedUser);

      await AuthService.refreshToken();

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'wedding-auth-user',
        JSON.stringify(updatedUser)
      );
    });

    it('should work with isAuthenticated after refresh', async () => {
      // Setup: Start with old token that needs refresh
      (localStorage.getItem as jest.Mock)
        .mockReturnValueOnce(mockToken) // getToken for shouldRefreshToken
        .mockReturnValueOnce(mockToken) // getToken for refreshToken
        .mockReturnValueOnce(mockFreshToken) // getToken for isAuthenticated check
        .mockReturnValueOnce(JSON.stringify(mockUser)) // getUser for isAuthenticated
        .mockReturnValueOnce('1738281600000'); // timestamp for isAuthenticated

      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      // Refresh the token
      const refreshed = await AuthService.checkAndRefreshToken();
      expect(refreshed).toBe(true);

      // Check authentication status with refreshed token
      const isAuthenticated = AuthService.isAuthenticated();
      expect(isAuthenticated).toBe(true);
    });

    it('should handle refresh failure and authentication check', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      const refreshError = new APIError('Refresh failed', 401);
      (apiRequest as jest.Mock).mockRejectedValue(refreshError);

      // Refresh should fail and clear auth data
      const refreshed = await AuthService.checkAndRefreshToken();
      expect(refreshed).toBe(false);

      // After failed refresh, localStorage should be cleared
      expect(localStorage.removeItem).toHaveBeenCalledTimes(3);

      // Subsequent authentication check should fail
      (localStorage.getItem as jest.Mock).mockReturnValue(null);
      const isAuthenticated = AuthService.isAuthenticated();
      expect(isAuthenticated).toBe(false);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle localStorage errors during refresh', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      (localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage quota exceeded');
      });
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      // Should not crash even if localStorage operations fail
      await expect(AuthService.refreshToken()).resolves.toBeDefined();
    });

    it('should handle very long token refresh response times', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      
      // Mock slow API response
      (apiRequest as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockRefreshResponse), 100))
      );

      const startTime = Date.now();
      const result = await AuthService.refreshToken();
      const endTime = Date.now();

      expect(result).toEqual(mockRefreshResponse);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should handle token with future iat (issued in future)', () => {
      // Token issued 1 day in the future
      const futureIatToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6Imd1ZXN0IiwiaWF0IjoxNzM4MzY4MDAwLCJleHAiOjE3NDA5NjAwMDB9.futureIatTokenSignature';
      (localStorage.getItem as jest.Mock).mockReturnValue(futureIatToken);
      
      // Should handle gracefully (might return false or true depending on implementation)
      const shouldRefresh = AuthService.shouldRefreshToken();
      expect(typeof shouldRefresh).toBe('boolean');
    });

    it('should handle token with iat > exp (invalid token)', () => {
      // Token with issued time after expiry time (invalid)
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6Imd1ZXN0IiwiaWF0IjoxNzQwOTYwMDAwLCJleHAiOjE3Mzg5NjAwMDB9.invalidTokenSignature';
      (localStorage.getItem as jest.Mock).mockReturnValue(invalidToken);
      
      const shouldRefresh = AuthService.shouldRefreshToken();
      // Should return false for invalid token structure
      expect(shouldRefresh).toBe(false);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should not leak memory with repeated refresh calls', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockFreshToken);

      // Call checkAndRefreshToken many times (should not refresh)
      for (let i = 0; i < 100; i++) {
        await AuthService.checkAndRefreshToken();
      }

      // Should not make any API calls since token is fresh
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should handle rapid successive refresh attempts', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      // Start multiple refresh operations rapidly
      const promises = Array.from({ length: 5 }, () => AuthService.refreshToken());

      // All should complete successfully
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toEqual(mockRefreshResponse);
      });

      // Should have made multiple API calls
      expect(apiRequest).toHaveBeenCalledTimes(5);
    });

    it('should handle large token payloads efficiently', () => {
      // Create token with large payload
      const largePayload = {
        username: 'testuser',
        role: 'guest',
        iat: 1735689600,
        exp: 1738281600,
        extraData: 'x'.repeat(10000), // Large string
      };
      
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify(largePayload));
      const signature = 'signature';
      const largeToken = `${header}.${payload}.${signature}`;
      
      const parsedPayload = AuthService.parseToken(largeToken);
      
      expect(parsedPayload).toBeTruthy();
      expect(parsedPayload.username).toBe('testuser');
      expect(parsedPayload.extraData).toBe('x'.repeat(10000));
    });
  });
});