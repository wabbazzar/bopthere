import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AuthContextValue, AuthState, AuthAction, User } from '@/types/auth';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

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
        // Try to verify the token with the server
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
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

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
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Login failed - please try again';
        
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
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

  const verifyToken = async (): Promise<void> => {
    try {
      const user = await AuthService.verifyToken();
      dispatch({ type: 'VERIFY_SUCCESS', payload: user });
    } catch (error) {
      dispatch({ type: 'VERIFY_FAILURE' });
      throw error;
    }
  };

  const contextValue: AuthContextValue = {
    user: state.user,
    isAuthenticated: !!state.user && !!state.token,
    isLoading: state.isLoading,
    login,
    logout,
    verifyToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};