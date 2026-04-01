import { apiRequest, APIError } from '@/integrations/aws/api-client';
import { LoginCredentials, LoginResponse, User } from '@/types/auth';

const TOKEN_KEY = 'wedding-auth-token';
const USER_KEY = 'wedding-auth-user';
const LOGIN_TIMESTAMP_KEY = 'wedding-auth-timestamp';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const TOKEN_REFRESH_THRESHOLD = 0.8; // Refresh when 80% of token lifetime has passed (24 days)

export class AuthService {
  /**
   * Store JWT token and user data in localStorage
   */
  static setAuthData(token: string, user: User): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(LOGIN_TIMESTAMP_KEY, Date.now().toString());
  }

  /**
   * Retrieve JWT token from localStorage
   */
  static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Retrieve user data from localStorage
   */
  static getUser(): User | null {
    const userData = localStorage.getItem(USER_KEY);
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  /**
   * Clear authentication data from localStorage
   */
  static clearAuthData(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LOGIN_TIMESTAMP_KEY);
  }

  /**
   * Check if user is authenticated (has valid token and within 30 days)
   */
  static isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    const loginTimestamp = localStorage.getItem(LOGIN_TIMESTAMP_KEY);

    if (!token || !user || !loginTimestamp) {
      return false;
    }

    // Check if login is older than 30 days
    const loginTime = parseInt(loginTimestamp, 10);
    const currentTime = Date.now();
    const timeDifference = currentTime - loginTime;

    if (timeDifference > THIRTY_DAYS_MS) {
      // Login expired, clear auth data
      this.clearAuthData();
      return false;
    }

    return true;
  }

  /**
   * Login with username and password
   */
  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      // Store auth data locally
      this.setAuthData(response.token, response.user);

      return response;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Login failed - please try again');
    }
  }

  /**
   * Verify current JWT token with server
   */
  static async verifyToken(): Promise<User> {
    const token = this.getToken();

    if (!token) {
      throw new APIError('No authentication token found', 401);
    }

    try {
      const response = await apiRequest<{ user: User }>('/auth/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Update user data in case it changed
      this.setAuthData(token, response.user);

      return response.user;
    } catch (error) {
      // For PWA stability, don't clear auth data on network errors
      // Only clear if it's a definitive 401/403 authentication error
      if (error instanceof APIError && (error.statusCode === 401 || error.statusCode === 403)) {
        console.log('Token verification failed with auth error, clearing data');
        this.clearAuthData();
      } else {
        console.warn('Token verification failed with network error, keeping auth data:', error);
      }

      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Token verification failed', 401);
    }
  }

  /**
   * Logout user and clear local auth data
   */
  static logout(): void {
    this.clearAuthData();
  }

  /**
   * Get authorization headers for API requests
   */
  static getAuthHeaders(): Record<string, string> {
    const token = this.getToken();

    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Parse JWT token to extract payload
   */
  static parseToken(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to parse JWT token:', error);
      return null;
    }
  }

  /**
   * Check if token needs refresh (80% of lifetime passed)
   */
  static shouldRefreshToken(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    const payload = this.parseToken(token);
    if (!payload || !payload.exp || !payload.iat) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenLifetime = Number(payload.exp) - Number(payload.iat);
    const tokenAge = now - Number(payload.iat);
    
    // Refresh if 80% of token lifetime has passed
    return tokenAge >= tokenLifetime * TOKEN_REFRESH_THRESHOLD;
  }

  /**
   * Get time until token expiry in milliseconds
   */
  static getTimeUntilExpiry(): number {
    const token = this.getToken();
    if (!token) {
      return 0;
    }

    const payload = this.parseToken(token);
    if (!payload || !payload.exp) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = (Number(payload.exp) - now) * 1000;
    
    return Math.max(0, timeUntilExpiry);
  }

  /**
   * Refresh the authentication token
   */
  static async refreshToken(): Promise<LoginResponse> {
    const token = this.getToken();
    
    if (!token) {
      throw new APIError('No authentication token found', 401);
    }

    try {
      const response = await apiRequest<LoginResponse>('/auth/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Store refreshed auth data
      this.setAuthData(response.token, response.user);
      
      console.log('Token refreshed successfully');
      return response;
    } catch (error) {
      // For PWA stability, only clear auth data on definitive auth errors
      // Network issues shouldn't log the user out
      if (error instanceof APIError && (error.statusCode === 401 || error.statusCode === 403)) {
        console.log('Token refresh failed with auth error, clearing data');
        this.clearAuthData();
      } else {
        console.warn('Token refresh failed with network error, keeping auth data:', error);
      }
      
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Token refresh failed', 401);
    }
  }

  /**
   * Check and refresh token if needed
   */
  static async checkAndRefreshToken(): Promise<boolean> {
    try {
      if (this.shouldRefreshToken()) {
        console.log('Token needs refresh, refreshing...');
        await this.refreshToken();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }
}
