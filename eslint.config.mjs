import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Only the production workspace is linted; prototypes and docs keep their own tooling.
    ignores: ['**/node_modules/**', '**/dist/**', 'demo/**', 'admin/**', 'shared/**', 'docs/**', 'scripts/**',
      'build/**', 'outputs/**', 'tests/**', '.agents/**', '.claude/**', '.pnpm-store/**', '.chart-data-*/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },
);
