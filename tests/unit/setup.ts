import { vi } from 'vitest';

// Mock localStorage with full API (including length and key())
const store: Record<string, string> = {};
const localStorageMock = {
	getItem: (key: string) => store[key] ?? null,
	setItem: (key: string, value: string) => {
		store[key] = value;
	},
	removeItem: (key: string) => {
		delete store[key];
	},
	clear: () => {
		Object.keys(store).forEach((k) => delete store[k]);
	},
	key: (index: number): string | null => {
		const keys = Object.keys(store);
		return keys[index] ?? null;
	},
	get length(): number {
		return Object.keys(store).length;
	}
};

vi.stubGlobal('localStorage', localStorageMock);

// Reset localStorage between tests
beforeEach(() => {
	localStorageMock.clear();
});
