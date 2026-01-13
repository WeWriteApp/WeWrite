/**
 * Unified Logger Initialization
 *
 * This file initializes the unified logging system with deduplication,
 * terminal integration, and console replacement for maximum readability.
 *
 * STRICT MODE SAFE: Uses singleton pattern to prevent double initialization.
 */

import logger from './logger';
import { runOnce, safeLog } from './strictModeSafety';

// Initialize unified logger on app startup (Strict Mode safe)
if (typeof window !== 'undefined') {
  runOnce('unified-logger-client', () => {
    // Client-side initialization - enable console replacement for unified logging
    logger.replaceConsole();
  });
}

export default logger;
