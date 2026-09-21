import { defineConfig } from 'vitest/config';

// Integration tests share one Postgres database and one Redis db, and every
// test truncates them in beforeEach, so files must not run concurrently.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    globalSetup: './tests/setup/globalSetup.ts',
    setupFiles: ['./tests/setup/env.ts', './tests/setup/hooks.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
