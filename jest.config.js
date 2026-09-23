/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/legacy/', '/dist/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!**/*.d.ts'],
  coverageThreshold: {
    './src/domain/': { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
