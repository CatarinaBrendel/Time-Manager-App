import js from '@eslint/js'
import globals from 'globals'

const base = js.configs.recommended

export default [
  // Ignore non-source stuff (flat config replaces .eslintignore)
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/release/**',
      'apps/frontend/vendor/**',
      'vendor/**',
      '**/*.min.js',
      '**/coverage/**',
      'renderer/*.css',
      'renderer/tailwind.css',
    ],
  },

  // Apply rules only to your source & scripts
  {
    files: ['src/**/*.{js,jsx,ts,tsx,mjs,cjs}', 'scripts/**/*.mjs'],
    ...base,
    languageOptions: {
      ...base.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...base.rules,
      // (optional) ease a couple of noisy rules for now
      'no-constant-condition': ['warn', { checkLoops: false }],
      // If you still hit this in YOUR code, prefer Object.hasOwn over hasOwnProperty
      'no-prototype-builtins': 'off',
    },
  },
]
