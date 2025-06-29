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
