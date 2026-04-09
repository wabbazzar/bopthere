import { writable, derived } from 'svelte/store';
import type { AuthState, User } from '$lib/types/auth';
import * as authService from '$lib/services/auth';

const initialState: AuthState = {
	user: null,
	token: null,
	isAuthenticated: false,
	isLoading: true
};

const { subscribe, set, update } = writable<AuthState>(initialState);

export const auth = {
	subscribe,

	async init() {
		const storedUser = authService.getStoredUser();
		const token = authService.getToken();

		if (storedUser && token) {
			// Trust localStorage immediately — no loading screen for returning users
			set({ user: storedUser, token, isAuthenticated: true, isLoading: false });

			// Verify token in background; log out only if expired/invalid
			authService.verifyToken().then((verified) => {
				if (verified) {
					update((s) => ({ ...s, user: verified }));
				} else {
					set({ user: null, token: null, isAuthenticated: false, isLoading: false });
				}
			});
		} else {
			set({ ...initialState, isLoading: false });
		}
	},

	async login(username: string, password: string) {
		const data = await authService.login(username, password);
		set({
			user: data.user,
			token: data.token,
			isAuthenticated: true,
			isLoading: false
		});
	},

	logout() {
		authService.logout();
		set({ user: null, token: null, isAuthenticated: false, isLoading: false });
	}
};

export const isAuthenticated = derived({ subscribe }, ($auth) => $auth.isAuthenticated);
export const isLoading = derived({ subscribe }, ($auth) => $auth.isLoading);
export const user = derived({ subscribe }, ($auth) => $auth.user);
