module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/app/tests/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.(test|spec).{js,jsx,ts,tsx}',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/tests/**/*',
  ],
  // Maximum error visibility
  verbose: true,
  errorOnDeprecated: true,
  bail: false, // Don't stop on first error
  maxWorkers: 1, // Single worker for clearer error output
  detectOpenHandles: true,
  forceExit: false,
  // Enhanced error reporting
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './test-reports',
      filename: 'jest-report.html',
      expand: true,
      hideIcon: false,
    }]
  ],
  // Show all console output
  silent: false,
  // Transform settings
  transform: {
    '^.+\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\.mjs$|@radix-ui|@stripe))',
  ],
  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Test timeout
  testTimeout: 30000,
};