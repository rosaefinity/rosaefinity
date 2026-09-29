import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-ssr/**',
      '**/dist-electron/**',
      'server/dist/**',
      'recovery-*/**',
      '**/__fixtures__/**',
      '**/__mocks__/**',
    ],
  },
});
