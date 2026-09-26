// The config the worker lints every scanned repo with. Deliberately fixed and
// language-level only — the score has to mean the same thing across repos, so
// the repo's own eslint config never gets a say.
import js from '@eslint/js';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,

  // Parses .ts/.tsx. No type-aware rules, so no tsconfig is needed. The files
  // have to be pinned — most of these blocks are unscoped, and left alone they
  // run the typescript rules over plain .js too, which double-reports every
  // require() and unused var.
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: c.files ?? ['**/*.{ts,tsx,mts,cts}'] })),

  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
    },
  },

  // Duplicated branches, dead-code patterns — bug and smell rules
  // eslint:recommended doesn't have.
  {
    ...sonarjs.configs.recommended,
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
  },

  // Rules that would count the same line twice. complexity, no-unused-vars and
  // the todo scan already report these.
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/unused-import': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/fixme-tag': 'off',
      // Fires on every obj[key], even when the key is a constant. Almost all
      // false positives.
      'security/detect-object-injection': 'off',
    },
  },

  // A leading _ marks a parameter kept only for its position, like express's
  // four-argument error handler.
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Listing the ts/jsx extensions here is also what pulls those files into the
  // scan at all — eslint only walks .js/.mjs/.cjs on its own.
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', { max: 4 }],
      'max-lines-per-function': ['warn', { max: 100 }],
    },
  },

  // Only for plain JS. On TS the base rule flags types and interfaces that are
  // used, so typescript-eslint turns it off and supplies its own. The globals
  // are here for the same reason — without them no-undef reports every
  // require/console/window in the repo as an error.
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
