import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__tests__/**/*.test.ts', 'src/auth/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/e2e/**/*.test.ts'],
    setupFiles: ['jest.setup.js'],
    testTimeout: 30000,
  },
});
