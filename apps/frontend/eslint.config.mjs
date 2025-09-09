import js from '@eslint/js'
import globals from 'globals'

export default [
  // Ignore junk & outputs (flat config replaces .eslintignore)
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'renderer/bundle.js',          // built file
      'renderer/tailwind.css',       // built file
      'vendor/**',                   // vendored Electron or libs
      '**/*.min.js',
    ],
  },

  // Only lint your actual sources
  {
    files: [
      'renderer/src/**/*.{js,jsx,ts,tsx}',
      'scripts/**/*.mjs',
      'electron/**/*.mjs',
    ],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } }, // fix "Unexpected token <"
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // keep CI green: warn instead of fail on these
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',          // <-- add this
        caughtErrorsIgnorePattern: '^_', 
       }],
      'no-console': 'off',
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-prototype-builtins': 'off',
    },
  },
]
