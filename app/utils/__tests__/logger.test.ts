/**
 * Unified Logger Tests
 * 
 * Tests for the unified logging system with deduplication
 */

import logger from '../logger';

// Mock console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock fetch for terminal integration
global.fetch = jest.fn();

describe('UnifiedLogger', () => {
  beforeEach(() => {
    // Reset mocks
    Object.assign(console, mockConsole);
    Object.values(mockConsole).forEach(mock => mock.mockClear());
    (global.fetch as jest.Mock).mockClear();
    
    // Clear logger cache
    logger.clearCache();
  });

  afterAll(() => {
    // Restore original console
    Object.assign(console, originalConsole);
    logger.restoreConsole();
  });

  describe('Basic Logging', () => {
    test('should log info messages', () => {
      logger.info('Test info message');
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️ Test info message'),
        ''
      );
    });

    test('should log warning messages', () => {
      logger.warn('Test warning message');
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Test warning message'),
        ''
      );
    });

    test('should log error messages', () => {
      logger.error('Test error message');
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Test error message'),
        ''
      );
    });

    test('should include timestamps in log messages', () => {
      logger.info('Test message');
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/),
        ''
      );
    });
  });

  describe('Deduplication', () => {
    test('should deduplicate identical messages', () => {
      // Log the same message multiple times quickly
      logger.warn('Duplicate message');
      logger.warn('Duplicate message');
      logger.warn('Duplicate message');

      // Should only log once initially
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
    });

    test('should show count for repeated messages', () => {
      // Log the same message 10 times to trigger count display
      for (let i = 0; i < 10; i++) {
        logger.warn('Repeated message');
      }

      // Should show the count on the 10th occurrence
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Repeated message (×10)'),
        ''
      );
    });

    test('should allow different messages through', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');

      expect(mockConsole.info).toHaveBeenCalledTimes(3);
    });
  });

  describe('Console Replacement', () => {
    test('should replace console methods', () => {
      logger.replaceConsole();
      
      // Original console methods should be stored
      expect(logger['originalConsole']).toBeDefined();
      expect(logger['isConsoleReplaced']).toBe(true);
    });

    test('should restore console methods', () => {
      logger.replaceConsole();
      logger.restoreConsole();
      
      expect(logger['isConsoleReplaced']).toBe(false);
    });
  });

  describe('Cache Management', () => {
    test('should provide cache statistics', () => {
      logger.info('Test message 1');
      logger.warn('Test message 2');
      
      const stats = logger.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
    });

    test('should clear cache', () => {
      logger.info('Test message');
      logger.clearCache();
      
      const stats = logger.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Force Logging', () => {
    test('should bypass deduplication with force', () => {
      logger.force('warn', 'Forced message');
      logger.force('warn', 'Forced message');
      logger.force('warn', 'Forced message');

      // Should log all three times
      expect(mockConsole.warn).toHaveBeenCalledTimes(3);
    });
  });
});
