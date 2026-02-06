const path = require('path');

module.exports = {
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
};
