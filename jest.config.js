const expoPreset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Firebase ships ES modules (some as .mjs); screens import it through src/data, so Jest must
  // transform it.
  transform: { ...expoPreset.transform, '\\.mjs$': expoPreset.transform['\\.[jt]sx?$'] },
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.replace('/node_modules/(?!(', '/node_modules/(?!(firebase|@firebase|'),
  ),
  setupFiles: [...expoPreset.setupFiles, '<rootDir>/jest.setup.ts'],
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
