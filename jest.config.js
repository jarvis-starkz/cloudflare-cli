/**
 * Jest configuration for cloudflare-cli.
 * All tests run offline — network access is disabled via nock in setupFilesAfterEnv.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  cacheDirectory: '.jest-cache',
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
  ],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
