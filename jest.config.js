/**
 * Jest Configuration for WeWrite Payment & Payout System Tests
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/app/tests/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/app/**/__tests__/**/*.{js,jsx,ts,tsx}'
  ],
  
  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/app/$1',
    '^@/components/(.*)$': '<rootDir>/app/components/$1',
    '^@/services/(.*)$': '<rootDir>/app/services/$1',
    '^@/utils/(.*)$': '<rootDir>/app/utils/$1',
    '^@/types/(.*)$': '<rootDir>/app/types/$1',
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'app/services/**/*.{js,ts}',
    'app/api/**/*.{js,ts}',
    'app/utils/**/*.{js,ts}',
    '!app/**/*.d.ts',
    '!app/tests/**',
    '!app/**/__tests__/**',
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    // Specific thresholds for critical payment components
    'app/services/unifiedFeeCalculationService.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'app/services/paymentRecoveryService.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'app/services/stripePayoutService.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  
  // Test timeout for async operations
  testTimeout: 30000,
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/app/tests/setup/globalSetup.js',
  globalTeardown: '<rootDir>/app/tests/setup/globalTeardown.js',
  
  // Verbose output for debugging
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-reports',
        filename: 'payment-system-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'WeWrite Payment System Test Report',
      },
    ],
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
