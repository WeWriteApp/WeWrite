/**
 * Logger Initialization
 * 
 * This file initializes the logging system and can optionally replace
 * the default console methods to reduce log duplication.
 */

import logger, { replaceConsole } from './logger';

// Initialize logger on app startup
if (typeof window !== 'undefined') {
  // Client-side initialization - silent init to reduce noise

  // Optionally replace console methods to catch all logging
  // Uncomment the line below to enable global console replacement
  // replaceConsole();
} else {
  // Server-side initialization - silent init to reduce noise
}

export default logger;
