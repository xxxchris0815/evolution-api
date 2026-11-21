import { cpSync } from 'node:fs';

import { defineConfig } from 'tsup';

/**
 * Low-memory production build used by Dockerfile.
 * Bundles only src/main.ts as CJS (avoids entry=['src'] CJS+ESM OOM/SIGKILL).
 */
export default defineConfig({
  entry: ['src/main.ts'],
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  format: ['cjs'],
  target: 'node20',
  onSuccess: async () => {
    cpSync('src/utils/translations', 'dist/translations', { recursive: true });
  },
  loader: {
    '.json': 'file',
    '.yml': 'file',
  },
});
