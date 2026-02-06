import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setupTests.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'types': path.resolve(__dirname, 'src/types')
    }
  }
});
