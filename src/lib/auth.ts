import { apiRequest, APIError } from '@/integrations/aws/api-client';
import { LoginCredentials, LoginResponse, User } from '@/types/auth';

const TOKEN_KEY = 'wedding-auth-token';
const USER_KEY = 'wedding-auth-user';
const LOGIN_TIMESTAMP_KEY = 'wedding-auth-timestamp';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

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
      // If token verification fails, clear local auth data
      this.clearAuthData();

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
}
