export interface User {
  username: string;
  email: string;
  full_name: string;
  role: 'guest' | 'vip' | 'admin';
  created_at: string;
  last_login: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  expires_at: string;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  verifyToken: () => Promise<void>;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'VERIFY_SUCCESS'; payload: User }
  | { type: 'VERIFY_FAILURE' };