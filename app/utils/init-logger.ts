/**
 * Unified Logger Initialization
 *
 * This file initializes the unified logging system with deduplication,
 * terminal integration, and console replacement for maximum readability.
 */

import logger from './logger';

// Initialize unified logger on app startup
if (typeof window !== 'undefined') {
  // Client-side initialization - enable console replacement for unified logging
  logger.replaceConsole();

  // Log initialization
  logger.info('Unified logging system initialized with console replacement and deduplication');
} else {
  // Server-side initialization - no console replacement needed
  logger.info('Unified logging system initialized (server-side)');
}

export default logger;
