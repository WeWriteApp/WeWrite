// Server-side polyfills for browser globals

// Polyfill 'self' for server environment
if (typeof self === 'undefined') {
  if (typeof global !== 'undefined') {
    global.self = global;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.self = globalThis;
  }
}

// Polyfill other browser globals that might be missing in server environment
if (typeof window === 'undefined') {
  global.window = global;
  global.document = {};
  global.navigator = { userAgent: 'node' };
  global.location = { href: '', origin: '', pathname: '/' };
}
