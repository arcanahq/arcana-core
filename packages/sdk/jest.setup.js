// Jest setup file
global.jest = vi;

// Mock localStorage for Node.js environment
if (typeof global.localStorage === 'undefined') {
  const storage = {};
  global.localStorage = {
    getItem: vi.fn((key) => storage[key] || null),
    setItem: vi.fn((key, value) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key]);
    }),
  };
}

// Mock window object
if (typeof global.window === 'undefined') {
  global.window = {
    localStorage: global.localStorage,
    crypto: {
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
    },
  };
}

// Mock crypto for Node.js
if (typeof global.crypto === 'undefined') {
  global.crypto = global.window.crypto;
}

// Mock console methods to reduce noise in tests (but keep them for debugging)
// Uncomment to silence console output:
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
// };
