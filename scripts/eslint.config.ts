import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  { 
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'], 
    plugins: { js }, 
    extends: ['js/recommended'], 
    languageOptions: { 
      globals: globals.browser 
    },
    rules: {
      'comma-dangle': ['error', 'never'],
      'quotes': ['error', 'single'],
      'semi': ['error', 'never'],
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^_$', argsIgnorePattern: '^_$' }] // ignore unused variables named exactly "_"
    }
  },
  tseslint.configs.recommended
])
