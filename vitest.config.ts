import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@doctor-tracker/shared': fileURLToPath(new URL('./src/shared/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['./src/tests/global-setup.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
      CLIENT_ORIGIN: 'http://localhost:3000',
      MONGODB_URI: 'mongodb://set-by-global-setup',
      LOG_LEVEL: 'silent',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/tests/**', 'src/scripts/**', 'src/server.ts', 'src/**/*.test.ts'],
    },
  },
});
