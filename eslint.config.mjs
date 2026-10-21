import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Only the production workspace is linted; prototypes and docs keep their own tooling.
    ignores: ['**/node_modules/**', '**/dist/**', 'demo/**', 'admin/**', 'shared/**', 'docs/**', 'scripts/**',
      'build/**', 'outputs/**', 'tests/**', '.agents/**', '.claude/**', '.pnpm-store/**', '.chart-data-*/**',
      'apps/ios/.expo/**', 'apps/ios/ios/**', 'apps/ios/android/**', 'apps/ios/*.config.js', 'apps/ios/babel.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/admin/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },
);
