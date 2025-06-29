// Global polyfill that runs immediately
if (typeof self === 'undefined') {
  if (typeof global !== 'undefined') {
    global.self = global;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.self = globalThis;
  }
}

// Polyfill document for server environment
if (typeof document === 'undefined' && typeof global !== 'undefined') {
  global.document = {
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
}

// Polyfill window for server environment
if (typeof window === 'undefined' && typeof global !== 'undefined') {
  global.window = global;
}

// Polyfill navigator for server environment
if (typeof navigator === 'undefined' && typeof global !== 'undefined') {
  global.navigator = { userAgent: 'node' };
}

// Polyfill location for server environment
if (typeof location === 'undefined' && typeof global !== 'undefined') {
  global.location = { href: '', origin: '', pathname: '/' };
}


