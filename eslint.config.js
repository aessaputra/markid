import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default defineConfig(
 globalIgnores(['references/**', 'spikes/**', '.superpowers/**', 'dist/**', 'test-results/**', 'playwright-report/**', 'coverage/**']),
 js.configs.recommended,
 ts.configs.recommended,
 svelte.configs.recommended,
 {
  files: ['src/**/*.{ts,svelte}'],
  languageOptions: { globals: globals.browser },
 },
 {
  files: ['*.{js,mjs,ts}', 'tests/**/*.ts', 'scripts/**/*.{js,mjs,ts}'],
  languageOptions: { globals: globals.node },
 },
 {
  files: ['src/**/*.ts', 'tests/**/*.ts', '*.config.ts'],
  languageOptions: {
   parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
  },
  rules: { '@typescript-eslint/await-thenable': 'error', '@typescript-eslint/require-await': 'error' },
 },
 {
  files: ['**/*.svelte'],
  languageOptions: { parserOptions: { parser: ts.parser, svelteConfig } },
 },
);
