// fixed config for every scanned repo, their own eslint config is ignored
import js from '@eslint/js';
import nounsanitized from 'eslint-plugin-no-unsanitized';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,

  // ts rules only on ts files, otherwise js gets reported twice
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: c.files ?? ['**/*.{ts,tsx,mts,cts}'] })),

  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
    },
  },

  // DOM XSS (innerHTML etc)
  {
    ...nounsanitized.configs.recommended,
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
  },

  {
    ...sonarjs.configs.recommended,
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
  },

  // already reported by other rules
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/unused-import': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/fixme-tag': 'off',
      // sonarjs covers these
      'security/detect-eval-with-expression': 'off',
      'security/detect-unsafe-regex': 'off',
      // mostly false positives
      'security/detect-object-injection': 'off',
    },
  },

  // allow unused _params
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // eslint only picks up ts/jsx files if they're listed here
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', { max: 4 }],
      'max-lines-per-function': ['warn', { max: 100 }],
    },
  },

  // plain js only, ts has its own version of these
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/.next/',
      '**/.nuxt/',
      '**/.expo/',
      '**/coverage/',
      '**/*.min.js',
      '**/*.bundle.js',
    ],
  },
];
