module.exports = {
  ignorePatterns: ['dist'],
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      parserOptions: { ecmaVersion: 2020 },
      env: { browser: true },
      globals: require('globals').browser,
      plugins: ['react-hooks', 'react-refresh', '@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
      ],
      rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      },
    },
  ],
}
