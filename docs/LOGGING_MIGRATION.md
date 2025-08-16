# Logging System Migration Guide

## Overview

The logging system has been unified to eliminate duplicate messages and improve readability. All logging now goes through a single, deduplicated system.

## What Changed

### Before (Multiple Systems)
- `LoggingProvider` - React context-based logging
- `error-logger.js` - Legacy error logger  
- `logger.ts` - Standalone logger
- Multiple console overrides causing conflicts

### After (Unified System)
- Single `UnifiedLogger` in `logger.ts`
- Automatic deduplication (5-second window)
- Terminal integration for development
- Clean console output with timestamps and emojis

## Migration Steps

### 1. Remove LoggingProvider Usage

**Before:**
```tsx
import { useLogging } from '../providers/LoggingProvider';

const { logError } = useLogging();
logError('Something went wrong', error);
```

**After:**
```tsx
import logger from '../utils/logger';

logger.error('Something went wrong', error);
```

### 2. Update Console Logging

**Before:**
```tsx
console.error('Error:', error);
console.warn('Warning:', warning);
```

**After:**
```tsx
// Console methods are automatically replaced by unified logger
console.error('Error:', error); // ✅ Still works, now with deduplication
console.warn('Warning:', warning); // ✅ Still works, now with deduplication

// Or use logger directly for structured logging
import logger from '../utils/logger';
logger.error('Error occurred', { error, context: 'user-action' });
```

### 3. Component-Specific Loggers

**Recommended:**
```tsx
import { createLogger } from '../utils/logger';

const log = createLogger('MyComponent');

log.info('Component mounted');
log.warn('Deprecated prop used', { prop: 'oldProp' });
log.error('Component error', error);
```

## Features

### Deduplication
- Identical messages within 5 seconds are grouped
- Shows count: `Error occurred (×5)`
- Reduces console noise significantly

### Terminal Integration
- Warnings and errors appear in development terminal
- Filtered to exclude noisy Firebase/framework messages
- Includes browser context (URL, user agent)

### Structured Logging
```tsx
logger.error('API call failed', {
  endpoint: '/api/users',
  status: 500,
  userId: 'user123',
  timestamp: Date.now()
});
```

### Log Levels
- `debug` - Development only, hidden in production
- `info` - General information
- `warn` - Warnings (sent to terminal)
- `error` - Errors (sent to terminal)

## Benefits

1. **No Duplicate Messages** - Single source of truth for logging
2. **Better Readability** - Timestamps, emojis, and structured format
3. **Development Integration** - Errors appear in terminal for easier debugging
4. **Performance** - Deduplication reduces console spam
5. **Consistency** - Same format across all components

## Automatic Features

- Console methods are automatically replaced on app startup
- Global error handlers capture unhandled errors
- Noisy framework messages are filtered out
- Browser errors are forwarded to development terminal

No manual setup required - just import and use!
