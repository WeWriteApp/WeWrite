import '@testing-library/jest-dom'

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Provide fetch for modules that require it at import time.
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn()
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {}
}

if (typeof global.Request === 'undefined') {
  global.Request = class Request {}
}

if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {}
}

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key'
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com'
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project'
process.env.NEXT_PUBLIC_FIREBASE_DOMAIN = 'test.firebaseapp.com'
process.env.NEXT_PUBLIC_FIREBASE_DB_URL = 'https://test.firebaseio.com'
process.env.NEXT_PUBLIC_FIREBASE_PID = 'test-project'
process.env.NEXT_PUBLIC_FIREBASE_BUCKET = 'test.appspot.com'
process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID = '1234567890'
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:1234567890:web:test'
process.env.STRIPE_SECRET_KEY = 'sk_test_1234567890'

// Suppress console warnings in tests
const originalWarn = console.warn
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is no longer supported')
  ) {
    return
  }
  originalWarn.call(console, ...args)
}
