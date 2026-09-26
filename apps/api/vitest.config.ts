import { defineConfig } from 'vitest/config';

// tests share one db, so run files one at a time
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
