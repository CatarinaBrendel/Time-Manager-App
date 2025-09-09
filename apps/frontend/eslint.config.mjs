// apps/frontend/eslint.config.mjs
import js from '@eslint/js'
import globals from 'globals'

export default [
  { // ignored paths
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/release/**',
      'vendor/**',
      'apps/frontend/vendor/**',
      'renderer/tailwind.css',
      '**/*.min.js',
      '**/coverage/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
  },
]
