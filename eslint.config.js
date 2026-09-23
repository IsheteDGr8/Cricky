// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

/** Import boundaries between layers. See docs/ARCHITECTURE.md. */
const layer = (name) => [`@/${name}`, `@/${name}/**`, `**/${name}`, `**/${name}/**`];
const frameworks = [
  'react',
  'react/**',
  'react-native',
  'react-native/**',
  'expo',
  'expo-*',
  '@expo/**',
];
const firebase = ['firebase', 'firebase/**', '@react-native-firebase/**'];

const boundary = (files, groups, message) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group: groups, message }] }] },
});

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['legacy/*', 'dist/*', 'coverage/*', 'backups/*', '.expo/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  boundary(
    ['src/**/*.{ts,tsx}'],
    firebase,
    'Only src/data may talk to Firebase. Use a repository from src/data instead.',
  ),
  boundary(
    ['src/domain/**/*.ts'],
    [...frameworks, ...firebase, ...['app', 'ui', 'data', 'features'].flatMap(layer)],
    'src/domain is pure TypeScript: no React, Expo, Firebase or other app layers.',
  ),
  boundary(
    ['src/ui/**/*.{ts,tsx}'],
    [...firebase, ...['app', 'data', 'features', 'domain'].flatMap(layer)],
    'src/ui is the design system: presentational only, no app, data, feature or domain imports.',
  ),
  boundary(
    ['src/data/**/*.ts'],
    ['app', 'ui', 'features'].flatMap(layer),
    'src/data is storage only: it may use Firebase and src/domain, never screens or UI.',
  ),
]);
