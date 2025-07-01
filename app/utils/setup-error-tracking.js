/**
 * Error Tracking Setup
 * 
 * Initializes comprehensive error tracking throughout the application
 */

import errorLogger from './error-logger.js';

class ErrorTrackingSetup {
  constructor() {
    this.isInitialized = false;
    this.config = {
      enableVerboseLogging: process.env.ENABLE_VERBOSE_LOGGING === 'true',
      enableConsoleEnhancement: true,
      enablePerformanceTracking: true,
      enableNetworkErrorTracking: true,
      enableReactErrorBoundary: true,
    };
  }

  initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('🔧 Initializing comprehensive error tracking...');

    // Initialize error logger
    this.setupErrorLogger();

    // Setup React error boundaries
    this.setupReactErrorBoundaries();

    // Setup network error tracking
    this.setupNetworkErrorTracking();

    // Setup performance monitoring
    this.setupPerformanceMonitoring();

    // Setup development helpers
    if (process.env.NODE_ENV === 'development') {
      this.setupDevelopmentHelpers();
    }

    this.isInitialized = true;
    console.log('✅ Error tracking initialized successfully');
  }

  setupErrorLogger() {
    // Error logger is already initialized in error-logger.js
    // Just ensure it's working
    if (this.config.enableVerboseLogging) {
      console.log('🔍 Verbose error logging enabled');
    }
  }

  setupReactErrorBoundaries() {
    if (!this.config.enableReactErrorBoundary) return;

    // Create a global React error boundary component
    if (typeof window !== 'undefined') {
      window.ReactErrorBoundary = class extends React.Component {
        constructor(props) {
          super(props);
          this.state = { hasError: false, error: null, errorInfo: null };
        }

        static getDerivedStateFromError(error) {
          return { hasError: true };
        }

        componentDidCatch(error, errorInfo) {
          errorLogger.logError('React Error Boundary', {
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
            errorInfo,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
          });

          this.setState({
            error,
            errorInfo,
          });
        }

        render() {
          if (this.state.hasError) {
            return (
              <div style={{
                padding: '20px',
                margin: '20px',
                border: '2px solid #ff6b6b',
                borderRadius: '8px',
                backgroundColor: '#ffe0e0',
                color: '#d63031',
                fontFamily: 'monospace',
              }}>
                <h2>🚨 React Error Boundary</h2>
                <p><strong>Error:</strong> {this.state.error?.message}</p>
                <details style={{ marginTop: '10px' }}>
                  <summary>Error Details</summary>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '12px',
                    backgroundColor: '#f8f8f8',
                    padding: '10px',
                    borderRadius: '4px',
                    marginTop: '10px',
                  }}>
                    {this.state.error?.stack}
                  </pre>
                </details>
                <button 
                  onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#d63031',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              </div>
            );
          }

          return this.props.children;
        }
      };
    }
  }

  setupNetworkErrorTracking() {
    if (!this.config.enableNetworkErrorTracking) return;

    // Track fetch errors
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      
      window.fetch = async (...args) => {
        const startTime = performance.now();
        
        try {
          const response = await originalFetch(...args);
          const endTime = performance.now();
          
          // Log slow requests
          const duration = endTime - startTime;
          if (duration > 5000) { // 5 seconds
            errorLogger.logWarning('Slow Network Request', {
              url: args[0],
              duration: `${duration.toFixed(2)}ms`,
              status: response.status,
              timestamp: new Date().toISOString(),
            });
          }
          
          // Log failed requests
          if (!response.ok) {
            errorLogger.logError('Network Request Failed', {
              url: args[0],
              status: response.status,
              statusText: response.statusText,
              duration: `${duration.toFixed(2)}ms`,
              timestamp: new Date().toISOString(),
            });
          }
          
          return response;
        } catch (error) {
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          errorLogger.logError('Network Request Error', {
            url: args[0],
            error: {
              message: error.message,
              stack: error.stack,
            },
            duration: `${duration.toFixed(2)}ms`,
            timestamp: new Date().toISOString(),
          });
          
          throw error;
        }
      };
    }

    // Track XMLHttpRequest errors
    if (typeof window !== 'undefined' && window.XMLHttpRequest) {
      const originalXHR = window.XMLHttpRequest;
      
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        let requestData = {};
        
        xhr.open = function(method, url, ...args) {
          requestData = { method, url, startTime: performance.now() };
          return originalOpen.call(this, method, url, ...args);
        };
        
        xhr.send = function(...args) {
          xhr.addEventListener('error', () => {
            const duration = performance.now() - requestData.startTime;
            errorLogger.logError('XMLHttpRequest Error', {
              ...requestData,
              duration: `${duration.toFixed(2)}ms`,
              timestamp: new Date().toISOString(),
            });
          });
          
          xhr.addEventListener('timeout', () => {
            const duration = performance.now() - requestData.startTime;
            errorLogger.logError('XMLHttpRequest Timeout', {
              ...requestData,
              duration: `${duration.toFixed(2)}ms`,
              timestamp: new Date().toISOString(),
            });
          });
          
          return originalSend.call(this, ...args);
        };
        
        return xhr;
      };
    }
  }

  setupPerformanceMonitoring() {
    if (!this.config.enablePerformanceTracking) return;
    if (typeof window === 'undefined') return;

    // Monitor Core Web Vitals
    if ('web-vitals' in window || typeof import !== 'undefined') {
      try {
        import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
          getCLS((metric) => {
            if (metric.value > 0.1) { // Poor CLS threshold
              errorLogger.logWarning('Poor Core Web Vital: CLS', {
                metric: 'Cumulative Layout Shift',
                value: metric.value,
                threshold: 0.1,
                timestamp: new Date().toISOString(),
              });
            }
          });

          getFID((metric) => {
            if (metric.value > 100) { // Poor FID threshold
              errorLogger.logWarning('Poor Core Web Vital: FID', {
                metric: 'First Input Delay',
                value: `${metric.value}ms`,
                threshold: '100ms',
                timestamp: new Date().toISOString(),
              });
            }
          });

          getLCP((metric) => {
            if (metric.value > 2500) { // Poor LCP threshold
              errorLogger.logWarning('Poor Core Web Vital: LCP', {
                metric: 'Largest Contentful Paint',
                value: `${metric.value}ms`,
                threshold: '2500ms',
                timestamp: new Date().toISOString(),
              });
            }
          });
        }).catch(() => {
          // web-vitals not available, skip
        });
      } catch (error) {
        // web-vitals not available, skip
      }
    }

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) { // Long task threshold
              errorLogger.logWarning('Long Task Detected', {
                duration: `${entry.duration.toFixed(2)}ms`,
                startTime: entry.startTime,
                name: entry.name,
                timestamp: new Date().toISOString(),
              });
            }
          });
        });
        
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        // PerformanceObserver not supported
      }
    }
  }

  setupDevelopmentHelpers() {
    if (typeof window === 'undefined') return;

    // Add global error tracking helpers
    window.errorTracker = {
      getStats: () => errorLogger.getErrorStats(),
      getErrors: () => errorLogger.getStoredErrors(),
      clearErrors: () => errorLogger.clearStoredErrors(),
      exportErrors: () => errorLogger.exportErrors(),
      logTestError: () => {
        errorLogger.logError('Test Error', {
          message: 'This is a test error for debugging',
          timestamp: new Date().toISOString(),
        });
      },
      logTestWarning: () => {
        errorLogger.logWarning('Test Warning', {
          message: 'This is a test warning for debugging',
          timestamp: new Date().toISOString(),
        });
      },
    };

    // Add keyboard shortcuts for development
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+E: Show error stats
      if (event.ctrlKey && event.shiftKey && event.key === 'E') {
        console.group('🔍 Error Tracking Stats');
        console.log(window.errorTracker.getStats());
        console.groupEnd();
      }
      
      // Ctrl+Shift+C: Clear errors
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        window.errorTracker.clearErrors();
        console.log('✅ All errors cleared');
      }
      
      // Ctrl+Shift+X: Export errors
      if (event.ctrlKey && event.shiftKey && event.key === 'X') {
        window.errorTracker.exportErrors();
        console.log('📄 Errors exported');
      }
    });

    console.log('🔧 Development error tracking helpers enabled:');
    console.log('   • window.errorTracker - Access error tracking functions');
    console.log('   • Ctrl+Shift+E - Show error stats');
    console.log('   • Ctrl+Shift+C - Clear all errors');
    console.log('   • Ctrl+Shift+X - Export errors');
  }

  // Method to manually log errors from components
  logComponentError(componentName, error, additionalInfo = {}) {
    errorLogger.logError(`Component Error: ${componentName}`, {
      component: componentName,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...additionalInfo,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to manually log warnings from components
  logComponentWarning(componentName, message, additionalInfo = {}) {
    errorLogger.logWarning(`Component Warning: ${componentName}`, {
      component: componentName,
      message,
      ...additionalInfo,
      timestamp: new Date().toISOString(),
    });
  }
}

// Create and export singleton instance
const errorTrackingSetup = new ErrorTrackingSetup();

export default errorTrackingSetup;
