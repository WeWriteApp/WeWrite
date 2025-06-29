// Global polyfills for server-side rendering compatibility

// Immediate polyfill execution
(() => {
  // Polyfill 'self' for server environment
  if (typeof self === 'undefined') {
    if (typeof global !== 'undefined') {
      (global as any).self = global;
    } else if (typeof globalThis !== 'undefined') {
      (globalThis as any).self = globalThis;
    }
  }

  // Polyfill other browser globals that might be missing
  if (typeof window === 'undefined' && typeof global !== 'undefined') {
    // Server-side polyfills
    (global as any).window = global;
    (global as any).document = {
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      getElementsByClassName: () => [],
      getElementsByTagName: () => [],
      createElement: () => ({}),
      createTextNode: () => ({}),
      body: {},
      head: {},
      documentElement: {}
    };
    (global as any).navigator = { userAgent: 'node' };
    (global as any).location = { href: '', origin: '', pathname: '/' };
  }
})();
