import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{app,components,functions,lib,scripts}/**/*.{test,spec}.{ts,tsx,js,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        branches: 75,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});
