import { apiRequest, APIError } from '@/integrations/aws/api-client';
import { LoginCredentials, LoginResponse, User } from '@/types/auth';

const TOKEN_KEY = 'wedding-auth-token';
const USER_KEY = 'wedding-auth-user';

export class AuthService {
  /**
   * Store JWT token and user data in localStorage
   */
  static setAuthData(token: string, user: User): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  static isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user);
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
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      'Authorization': `Bearer ${token}`,
    };
  }
}