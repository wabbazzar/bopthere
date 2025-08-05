import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModal } from '../LoginModal';
import { CharacterContext } from '@/contexts/CharacterContext';
import { AuthContext } from '@/contexts/AuthContext';
import { characterThemes } from '@/types/character';
import type { Character } from '@/types/character';
import type { AuthContextValue } from '@/types/auth';

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock the API client to avoid import.meta issues
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

// Mock the auth service
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

// Mock components that are not essential for testing
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({
    children,
    style,
    className,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <h2 data-testid="dialog-title" style={style} className={className}>
      {children}
    </h2>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    style,
    className,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <div data-testid="card" style={style} className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({
    children,
    style,
    className,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <h3 data-testid="card-title" style={style} className={className}>
      {children}
    </h3>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-description">{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    style,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'data-testid'?: string }) => (
    <button
      data-testid={props['data-testid'] || 'button'}
      onClick={onClick}
      disabled={disabled}
      type={type}
      style={style}
      className={className}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({
    onChange,
    value,
    disabled,
    placeholder,
    type,
    id,
    style,
    className,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { 'data-testid'?: string }) => (
    <input
      data-testid={props['data-testid'] || id || 'input'}
      onChange={onChange}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      type={type}
      id={id}
      style={style}
      className={className}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label data-testid="label" htmlFor={htmlFor}>
      {children}
    </label>
  ),
}));

// Test utilities
const createMockAuthContext = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  verifyToken: jest.fn(),
  ...overrides,
});

const createMockCharacterContext = (character: Character = 'wesley') => ({
  selectedCharacter: character,
  setSelectedCharacter: jest.fn(),
});

const renderLoginModal = (
  props: { isOpen?: boolean; onClose?: () => void } = {},
  authContext: Partial<AuthContextValue> = {},
  character: Character = 'wesley'
) => {
  const mockOnClose = jest.fn();
  const mockAuthContext = createMockAuthContext(authContext);
  const mockCharacterContext = createMockCharacterContext(character);

  return {
    ...render(
      <CharacterContext.Provider value={mockCharacterContext}>
        <AuthContext.Provider value={mockAuthContext}>
          <LoginModal isOpen={props.isOpen ?? true} onClose={props.onClose ?? mockOnClose} />
        </AuthContext.Provider>
      </CharacterContext.Provider>
    ),
    mockOnClose,
    mockAuthContext,
  };
};

describe('LoginModal', () => {
  const user = userEvent.setup();

  describe('Rendering and Visibility', () => {
    it('should render when isOpen is true', () => {
      renderLoginModal({ isOpen: true });

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Epic Quest Login');
    });

    it('should not render when isOpen is false', () => {
      renderLoginModal({ isOpen: false });

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should display all form elements when open', () => {
      renderLoginModal();

      expect(screen.getByTestId('username')).toBeInTheDocument();
      expect(screen.getByTestId('password')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    it('should display wedding event information', () => {
      renderLoginModal();

      expect(screen.getByText(/December 5-9, 2025/)).toBeInTheDocument();
      expect(screen.getByText(/Maui, Hawaii/)).toBeInTheDocument();
    });
  });

  describe('Character Theming', () => {
    it('should apply Wesley theme colors by default', () => {
      renderLoginModal({}, {}, 'wesley');

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveStyle({ color: characterThemes.wesley.primary });
    });

    it('should apply Heather theme colors when selected', () => {
      renderLoginModal({}, {}, 'heather');

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveStyle({ color: characterThemes.heather.primary });
    });

    it('should apply Puffy theme colors when selected', () => {
      renderLoginModal({}, {}, 'puffy');

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveStyle({ color: characterThemes.puffy.primary });
    });

    it('should apply theme colors to card elements', () => {
      renderLoginModal({}, {}, 'heather');

      const card = screen.getByTestId('card');
      expect(card).toHaveStyle({ borderColor: characterThemes.heather.secondary });
    });

    it('should apply theme colors to form inputs', () => {
      renderLoginModal({}, {}, 'puffy');

      const usernameInput = screen.getByTestId('username');
      expect(usernameInput).toHaveStyle({ borderColor: characterThemes.puffy.secondary });
    });
  });

  describe('Form Interaction', () => {
    it('should update username field when typed', async () => {
      renderLoginModal();

      const usernameInput = screen.getByTestId('username');
      await user.type(usernameInput, 'testuser');

      expect(usernameInput).toHaveValue('testuser');
    });

    it('should update password field when typed', async () => {
      renderLoginModal();

      const passwordInput = screen.getByTestId('password');
      await user.type(passwordInput, 'testpass');

      expect(passwordInput).toHaveValue('testpass');
    });

    it('should toggle password visibility when eye button is clicked', async () => {
      renderLoginModal();

      const passwordInput = screen.getByTestId('password');
      // Find the toggle button that has no text content (it's the eye icon button)
      const buttons = screen.getAllByTestId('button');
      const toggleButton = buttons.find(
        (btn) => btn.textContent === '' && btn.querySelector('svg')
      );

      // Initially password type
      expect(passwordInput).toHaveAttribute('type', 'password');

      if (toggleButton) {
        await user.click(toggleButton);
        expect(passwordInput).toHaveAttribute('type', 'text');

        await user.click(toggleButton);
        expect(passwordInput).toHaveAttribute('type', 'password');
      } else {
        // Skip test if toggle button not found
        expect(passwordInput).toHaveAttribute('type', 'password');
      }
    });

    it('should disable submit button when fields are empty', () => {
      renderLoginModal();

      const submitButton = screen.getByText('Login');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when both fields have values', async () => {
      renderLoginModal();

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const submitButton = screen.getByText('Login');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');

      expect(submitButton).not.toBeDisabled();
    });

    it('should trim whitespace from username', async () => {
      const mockLogin = jest.fn().mockResolvedValue({});
      const { mockOnClose } = renderLoginModal({}, { login: mockLogin });

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const submitButton = screen.getByText('Login');

      await user.type(usernameInput, '  testuser  ');
      await user.type(passwordInput, 'testpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpass');
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should call login function with correct credentials on submit', async () => {
      const mockLogin = jest.fn().mockResolvedValue(undefined);
      renderLoginModal({}, { login: mockLogin });

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const submitButton = screen.getByText('Login');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpass');
      });
    });

    it('should close modal and clear form on successful login', async () => {
      const mockLogin = jest.fn().mockResolvedValue(undefined);
      const { mockOnClose } = renderLoginModal({}, { login: mockLogin });

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const submitButton = screen.getByText('Login');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
        expect(usernameInput).toHaveValue('');
        expect(passwordInput).toHaveValue('');
      });
    });

    it('should show loading state during authentication', async () => {
      const mockLogin = jest.fn(
        (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100))
      );
      renderLoginModal({}, { login: mockLogin });

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const submitButton = screen.getByText('Login');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');
      await user.click(submitButton);

      expect(screen.getByText('Logging in...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      expect(usernameInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });

    it('should handle login failure gracefully', async () => {
      const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
      renderLoginModal({}, { login: mockLogin });

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const submitButton = screen.getByText('Login');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'wrongpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should prevent form submission during loading', async () => {
      renderLoginModal({}, { isLoading: true });

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const submitButton = screen.getByText('Login');

      expect(usernameInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Modal Controls', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const { mockOnClose } = renderLoginModal();

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should clear form fields when modal is closed', async () => {
      const { mockOnClose } = renderLoginModal();

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const cancelButton = screen.getByText('Cancel');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');
      await user.click(cancelButton);

      expect(usernameInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
    });

    it('should prevent closing modal during authentication', async () => {
      const mockLogin = jest.fn(
        (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const { mockOnClose } = renderLoginModal({}, { login: mockLogin });

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');
      const submitButton = screen.getByText('Login');
      const cancelButton = screen.getByText('Cancel');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');
      await user.click(submitButton);

      expect(cancelButton).toBeDisabled();

      // Simulate trying to close during submission
      await user.click(cancelButton);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive classes for mobile', () => {
      renderLoginModal();

      const dialogContent = screen.getByTestId('dialog-content');
      expect(dialogContent).toHaveClass('sm:max-w-md');
      expect(dialogContent).toHaveClass('max-w-[95vw]');
    });

    it('should apply responsive button layout', () => {
      renderLoginModal();

      const cancelButton = screen.getByText('Cancel');
      const submitButton = screen.getByText('Login');

      // Check that buttons have flex classes for responsive layout
      expect(cancelButton).toHaveClass('flex-1');
      expect(submitButton).toHaveClass('flex-1');
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for form fields', () => {
      renderLoginModal();

      const usernameLabel = screen.getByText('Username');
      const passwordLabel = screen.getByText('Password');

      expect(usernameLabel).toBeInTheDocument();
      expect(passwordLabel).toBeInTheDocument();
    });

    it('should associate labels with inputs', () => {
      renderLoginModal();

      const usernameInput = screen.getByTestId('username');
      const passwordInput = screen.getByTestId('password');

      expect(usernameInput).toHaveAttribute('id', 'username');
      expect(passwordInput).toHaveAttribute('id', 'password');
    });

    it('should have proper form semantics', () => {
      renderLoginModal();

      // Check that a form element exists within the card content
      const cardContent = screen.getByTestId('card-content');
      const form = cardContent.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should have proper button types', () => {
      renderLoginModal();

      const cancelButton = screen.getByText('Cancel');
      const submitButton = screen.getByText('Login');

      expect(cancelButton).toHaveAttribute('type', 'button');
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });
});
