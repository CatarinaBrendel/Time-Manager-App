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
  {
    files: [
      'renderer/src/**/*.{js,jsx,ts,tsx}',
      'scripts/**/*.mjs',
      'electron/**/*.mjs',
    ],
    ...js.configs.recommended,
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } }, // fix "Unexpected token <"
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: "detect" }, // lets the plugin auto-detect your React version
    },
    rules: {
      // keep CI green: warn instead of fail on these
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(_|App)$',
        caughtErrorsIgnorePattern: '^_', 
       }],
      'no-console': 'off',
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-prototype-builtins': 'off',
      'react/react-in-jsx-scope': "off",
      'react/jsx-uses-react': "off",
      'react-hooks/rules-of-hooks': "error",
      'react-hooks/exhaustive-deps': "warn",
    },
  },
]
