export interface User {
	username: string;
	email: string;
	full_name: string;
	role: 'guest' | 'vip' | 'admin';
}

export interface LoginResponse {
	token: string;
	user: User;
	expires_at: string;
}

export interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
}
