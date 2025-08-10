import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AuthContextValue, AuthState, AuthAction, User } from '@/types/auth';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Auth reducer for state management
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
      };

    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
      };

    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
      };

    case 'VERIFY_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isLoading: false,
      };

    case 'VERIFY_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
      };

    default:
      return state;
  }
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { toast } = useToast();

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = AuthService.getToken();
      const user = AuthService.getUser();

      if (token && user) {
        // Check if token needs refresh first
        if (AuthService.shouldRefreshToken()) {
          try {
            console.log('Token needs refresh on mount, refreshing...');
            const response = await AuthService.refreshToken();
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: { user: response.user, token: response.token },
            });
          } catch (error) {
            console.error('Failed to refresh token on mount:', error);
            // Try to verify existing token as fallback
            try {
              const verifiedUser = await AuthService.verifyToken();
              dispatch({
                type: 'LOGIN_SUCCESS',
                payload: { user: verifiedUser, token },
              });
            } catch (verifyError) {
              // Both refresh and verify failed, clear auth
              AuthService.clearAuthData();
              dispatch({ type: 'VERIFY_FAILURE' });
            }
          }
        } else {
          // Token doesn't need refresh, just verify it
          try {
            const verifiedUser = await AuthService.verifyToken();
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: { user: verifiedUser, token },
            });
          } catch (error) {
            // Token is invalid, clear local storage
            AuthService.clearAuthData();
            dispatch({ type: 'VERIFY_FAILURE' });
          }
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Define verifyToken function before using it in the hook
  const verifyToken = async (): Promise<void> => {
    try {
      const user = await AuthService.verifyToken();
      dispatch({ type: 'VERIFY_SUCCESS', payload: user });
    } catch (error) {
      dispatch({ type: 'VERIFY_FAILURE' });
      throw error;
    }
  };

  // Use the token refresh hook with callbacks for state updates
  useTokenRefresh({
    onRefreshSuccess: () => {
      // Re-fetch user data after successful refresh
      const token = AuthService.getToken();
      const user = AuthService.getUser();
      if (token && user) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token },
        });
      }
    },
    onRefreshError: (error) => {
      console.error('Token refresh error in AuthContext:', error);
      // Don't automatically logout on refresh failure
      // User can still use the app until token actually expires
    },
    verifyToken, // Pass the verifyToken function to the hook
  });

  const login = async (username: string, password: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await AuthService.login({ username, password });

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user: response.user, token: response.token },
      });

      // Disabled welcome back toast
      // toast({
      //   title: "Login Successful",
      //   description: `Welcome back, ${response.user.full_name}!`,
      // });
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE' });

      const errorMessage =
        error instanceof Error ? error.message : 'Login failed - please try again';

      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });

      throw error;
    }
  };

  const logout = (): void => {
    AuthService.logout();
    dispatch({ type: 'LOGOUT' });

    // Disabled logout toast
    // toast({
    //   title: "Logged Out",
    //   description: "You have been successfully logged out.",
    // });
  };

  const contextValue: AuthContextValue = {
    user: state.user,
    isAuthenticated: !!state.user && !!state.token,
    isLoading: state.isLoading,
    login,
    logout,
    verifyToken,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
