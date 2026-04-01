import '@testing-library/jest-dom';

// Mock Vite environment
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_GATEWAY_URL: 'https://test-api.example.com',
        MODE: 'test',
        DEV: false,
        PROD: false,
      },
    },
  },
});

// Mock matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string | null) => {
      if (value !== null && value !== undefined) {
        store[key] = String(value);
      }
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string | null) => {
      if (value !== null && value !== undefined) {
        store[key] = String(value);
      }
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Clear localStorage store
  localStorageMock.clear();
  // Clear sessionStorage store
  sessionStorageMock.clear();
});
