/**
 * Tests that need the Firebase emulator (database rules, repositories).
 * Run with `npm run test:rules`, which starts the emulator around them.
 * Plain Node environment: the jest-expo preset replaces fetch, which the emulator clients need.
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  testMatch: ['**/*.emulator.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/legacy/', '/dist/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testTimeout: 20000,
  // The Firebase SDK keeps internal timers alive after deleteApp(), so Jest would never exit.
  forceExit: true,
};
