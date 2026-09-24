/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/legacy/', '/dist/', '\\.emulator\\.test\\.ts$'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/app/**',
    '!**/__fixtures__/**',
    '!**/index.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    './src/domain/': { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
