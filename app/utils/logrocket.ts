/**
 * LogRocket Integration for WeWrite
 *
 * Provides session replay, console logging, and error tracking with selective
 * data sanitization. Since WeWrite pages are public, we only redact sensitive
 * financial information (payments, bank connections, payouts) while allowing
 * all other content to be visible for better debugging and user experience analysis.
 *
 * Redaction Strategy:
 * - ✅ Page content, titles, UI text (public content)
 * - 🔒 Payment forms, bank details, payout information (sensitive financial data)
 */

import LogRocket from 'logrocket';

// Types for LogRocket integration
interface LogRocketUser {
  id: string;
  name?: string;
  email?: string;
  // Sanitized user data - no sensitive info
}

interface LogRocketEvent {
  name: string;
  properties?: Record<string, any>;
}

class LogRocketService {
  private isInitialized = false;
  private isProduction = false;

  constructor() {
    // Initialize in production, or in development if explicitly enabled
    this.isProduction = process.env.NODE_ENV === 'production' ||
                       process.env.NEXT_PUBLIC_LOGROCKET_ENABLE_DEV === 'true';

    console.log('🔍 LogRocketService constructor:', {
      nodeEnv: process.env.NODE_ENV,
      enableDev: process.env.NEXT_PUBLIC_LOGROCKET_ENABLE_DEV,
      isProduction: this.isProduction
    });
  }

  /**
   * Check if LogRocket is ready for use
   */
  get isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize LogRocket - only in production and client-side
   * Called from the main app component
   */
  init(): void {
    console.log('🔍 LogRocket initialization check:', {
      isInitialized: this.isInitialized,
      isProduction: this.isProduction,
      isClientSide: typeof window !== 'undefined',
      hasAppId: !!process.env.NEXT_PUBLIC_LOGROCKET_APP_ID,
      appIdPreview: process.env.NEXT_PUBLIC_LOGROCKET_APP_ID ?
        `${process.env.NEXT_PUBLIC_LOGROCKET_APP_ID.substring(0, 8)}...` : 'NOT_SET',
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });

    // 🚨 PRODUCTION FIX: Disable LogRocket to prevent session quota issues
    if (process.env.NODE_ENV === 'production') {
      console.warn('🚨 LogRocket disabled in production to prevent session quota exceeded errors');
      return;
    }

    // Skip initialization if:
    // - Already initialized
    // - Not in production
    // - Running on server-side
    // - No app ID configured
    if (this.isInitialized) {
      console.log('⏭️ LogRocket already initialized, skipping');
      return;
    }

    if (!this.isProduction) {
      console.log('⏭️ LogRocket skipped: Not in production environment (set NEXT_PUBLIC_LOGROCKET_ENABLE_DEV=true to enable in dev)');
      return;
    }

    if (typeof window === 'undefined') {
      console.log('⏭️ LogRocket skipped: Server-side rendering');
      return;
    }

    if (!process.env.NEXT_PUBLIC_LOGROCKET_APP_ID) {
      console.error('❌ LogRocket skipped: NEXT_PUBLIC_LOGROCKET_APP_ID not configured');
      return;
    }

    try {
      console.log('🚀 Initializing LogRocket with app ID:',
        `${process.env.NEXT_PUBLIC_LOGROCKET_APP_ID.substring(0, 8)}...`);

      // Initialize LogRocket with app ID and minimal sanitization for better debugging
      LogRocket.init(process.env.NEXT_PUBLIC_LOGROCKET_APP_ID, {
        dom: {
          // Disable input sanitization for debugging - we want to see all input values
          inputSanitizer: false,
          // Disable text sanitization to see all text content for debugging
          textSanitizer: false,
          baseHref: null
        },
        network: {
          requestSanitizer: (request: any) => {
            // Sanitize sensitive headers and data
            if (request.headers) {
              delete request.headers['authorization'];
              delete request.headers['x-auth-token'];
              delete request.headers['stripe-signature'];
            }

            // Sanitize sensitive URL parameters
            if (request.url && request.url.includes('token=')) {
              request.url = request.url.replace(/token=[^&]+/g, 'token=***');
            }

            return request;
          },
          responseSanitizer: (response: any) => {
            // Sanitize sensitive response data
            if (response.body && typeof response.body === 'string') {
              try {
                const body = JSON.parse(response.body);
                if (body.token) body.token = '***';
                if (body.secret) body.secret = '***';
                if (body.key) body.key = '***';
                response.body = JSON.stringify(body);
              } catch (e) {
                // Not JSON, leave as is
              }
            }
            return response;
          }
        }
      });

      // Configure ignore rules
      this.configureIgnoreRules();

      this.isInitialized = true;
      console.log('✅ LogRocket initialized successfully');

      // Log session URL for debugging
      LogRocket.getSessionURL((sessionURL) => {
        console.log('🔗 LogRocket session URL:', sessionURL);

        // Test LogRocket functionality
        LogRocket.log('🧪 LogRocket test message - initialization successful!');
        LogRocket.track('logrocket_initialization', {
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          appId: process.env.NEXT_PUBLIC_LOGROCKET_APP_ID?.substring(0, 8) + '...'
        });
      });
    } catch (error) {
      console.error('❌ Failed to initialize LogRocket:', error);
    }
  }



  /**
   * Configure ignore rules for bots and localhost
   */
  private configureIgnoreRules(): void {
    // Ignore bot traffic
    const userAgent = navigator.userAgent.toLowerCase();
    const isBotTraffic = [
      'bot', 'crawler', 'spider', 'scraper', 'headless',
      'phantom', 'selenium', 'puppeteer', 'playwright'
    ].some(bot => userAgent.includes(bot));

    if (isBotTraffic) {
      console.log('🤖 Bot traffic detected - LogRocket session ignored');
      return;
    }

    // Ignore localhost and development domains
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || 
                       hostname === '127.0.0.1' || 
                       hostname.includes('.local');

    if (isLocalhost) {
      console.log('🏠 Localhost detected - LogRocket session ignored');
      return;
    }
  }

  /**
   * Identify user when they log in or sign up
   * Sanitizes sensitive user data before sending
   */
  identify(user: {
    id: string;
    username?: string;
    email?: string;
    accountType?: string;
    createdAt?: string;
    // Don't include: tokens, balances, payment info, etc.
  }): void {
    console.log('🔍 LogRocket.identify called with:', {
      userId: user.id,
      username: user.username,
      email: user.email ? `${user.email.substring(0, 3)}***` : undefined,
      isInitialized: this.isInitialized,
      isProduction: this.isProduction
    });

    if (!this.isInitialized) {
      console.log('⏭️ LogRocket not initialized, skipping user identification');
      return;
    }

    try {
      // Sanitize user data - only include safe, non-sensitive information
      const sanitizedUser: LogRocketUser = {
        id: user.id,
        name: user.username,
        email: user.email ? this.sanitizeEmail(user.email) : undefined,
      };

      console.log('🔍 LogRocket sanitized user data:', {
        id: sanitizedUser.id,
        name: sanitizedUser.name,
        email: sanitizedUser.email ? `${sanitizedUser.email.substring(0, 3)}***` : undefined
      });

      // Additional safe metadata
      const metadata = {
        accountType: user.accountType,
        signupDate: user.createdAt,
        platform: 'web',
        // Explicitly exclude sensitive data:
        // - Token balances
        // - Payment methods
        // - Auth tokens
        // - API keys
      };

      LogRocket.identify(user.id, sanitizedUser);

      // Track user session start
      this.track('user_session_start', {
        userId: user.id,
        accountType: user.accountType,
        timestamp: new Date().toISOString(),
      });

      console.log('👤 User identified in LogRocket successfully:', {
        userId: user.id,
        username: user.username
      });
    } catch (error) {
      console.error('❌ Failed to identify user in LogRocket:', error);
    }
  }

  /**
   * Track custom events with sanitized data
   */
  track(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.isInitialized) return;

    try {
      // Sanitize event properties
      const sanitizedProperties = this.sanitizeEventProperties(properties);

      LogRocket.track(eventName, sanitizedProperties);
      console.log('📊 LogRocket event tracked:', eventName, sanitizedProperties);
    } catch (error) {
      console.error('❌ Failed to track LogRocket event:', error);
    }
  }

  /**
   * Capture custom messages/logs with enhanced context and increased verbosity
   */
  captureMessage(message: string, extra: Record<string, any> = {}): void {
    if (!this.isInitialized) return;

    try {
      // Enhanced logging with more context and stack trace
      const enhancedExtra = {
        ...extra,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        environment: process.env.NODE_ENV,
        stackTrace: new Error().stack,
        windowSize: typeof window !== 'undefined' ?
          `${window.innerWidth}x${window.innerHeight}` : 'unknown',
        viewport: typeof window !== 'undefined' ?
          `${window.screen.width}x${window.screen.height}` : 'unknown'
      };

      // Reduce sanitization for debugging - only sanitize truly sensitive data
      const minimalSanitizedExtra = this.minimalSanitizeEventProperties(enhancedExtra);
      LogRocket.captureMessage(message, minimalSanitizedExtra);
      console.log('📝 LogRocket message captured with enhanced context:', message, minimalSanitizedExtra);
    } catch (error) {
      console.error('❌ Failed to capture LogRocket message:', error);
    }
  }

  /**
   * Log errors to LogRocket with enhanced context for debugging
   */
  logError(error: Error | string, context?: Record<string, any>): void {
    if (!this.isInitialized) return;

    try {
      // Enhanced error data for better debugging
      const errorMessage = typeof error === 'string' ? error : error.message;
      const errorStack = typeof error === 'string' ? new Error(error).stack : error.stack;

      // Use LogRocket's built-in error handling
      LogRocket.captureException(typeof error === 'string' ? new Error(error) : error);

      // Enhanced context tracking with more details
      const enhancedContext = {
        errorMessage: errorMessage, // Don't truncate for debugging
        errorStack: errorStack,
        context: context?.operation || 'unknown',
        pageId: context?.pageId || null,
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        ...context // Include all context for debugging
      };

      LogRocket.track('app_error_detailed', enhancedContext);
      console.error('🚨 LogRocket: Enhanced error logged:', enhancedContext);

    } catch (logError) {
      console.error('❌ Failed to log error to LogRocket:', logError);
    }
  }

  /**
   * Log API errors with minimal overhead (following LogRocket performance best practices)
   */
  logApiError(endpoint: string, method: string, status: number, error: any): void {
    if (!this.isInitialized) return;

    try {
      // Minimal API error tracking to avoid performance issues
      LogRocket.track('api_error', {
        endpoint: endpoint.substring(0, 50), // Limit endpoint length
        method,
        status,
        error: typeof error === 'string' ? error.substring(0, 100) : 'API Error'
      });
    } catch (logError) {
      // Silently fail to prevent infinite loops
    }
  }

  /**
   * Get current session URL for support/debugging
   */
  getSessionURL(callback: (url: string) => void): void {
    if (!this.isInitialized) return;

    try {
      LogRocket.getSessionURL(callback);
    } catch (error) {
      console.error('❌ Failed to get LogRocket session URL:', error);
    }
  }

  /**
   * Sanitize email for privacy (show domain but mask user part)
   */
  private sanitizeEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!user || !domain) return '[email]';
    
    // Show first 2 chars + *** + domain
    const maskedUser = user.length > 2 
      ? user.substring(0, 2) + '***' 
      : '***';
    
    return `${maskedUser}@${domain}`;
  }

  /**
   * Sanitize event properties to remove sensitive data
   */
  private sanitizeEventProperties(properties: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Skip sensitive keys
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeEventProperties(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Minimal sanitization for debugging - only redact truly sensitive financial data
   */
  private minimalSanitizeEventProperties(properties: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Only redact truly sensitive financial keys
      if (this.isTrulySensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.minimalSanitizeEventProperties(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if a key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      'token', 'balance', 'payment', 'card', 'auth', 'secret',
      'key', 'password', 'stripe', 'bank', 'account', 'ssn',
      'credit', 'debit', 'cvv', 'pin', 'routing'
    ];

    return sensitivePatterns.some(pattern =>
      key.toLowerCase().includes(pattern)
    );
  }

  /**
   * Check if a key contains truly sensitive financial information (minimal redaction for debugging)
   */
  private isTrulySensitiveKey(key: string): boolean {
    const trulySensitivePatterns = [
      'password', 'secret', 'token', 'key', 'cvv', 'pin',
      'ssn', 'routing', 'account_number', 'card_number'
    ];

    return trulySensitivePatterns.some(pattern =>
      key.toLowerCase().includes(pattern)
    );
  }

  /**
   * Check if an HTML element contains sensitive financial information
   * Only redact inputs related to payments, bank connections, and payouts
   */
  public isSensitiveFinancialElement(element: HTMLElement): boolean {
    // Check element attributes for sensitive patterns
    const elementId = element.id?.toLowerCase() || '';
    const elementName = element.getAttribute('name')?.toLowerCase() || '';
    const elementClass = element.className?.toLowerCase() || '';
    const elementType = element.getAttribute('type')?.toLowerCase() || '';
    const elementPlaceholder = element.getAttribute('placeholder')?.toLowerCase() || '';
    const elementAriaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';

    // Combine all attributes to check
    const allAttributes = [
      elementId, elementName, elementClass, elementType,
      elementPlaceholder, elementAriaLabel
    ].join(' ');

    // Financial patterns that should be redacted
    const sensitiveFinancialPatterns = [
      // Payment information
      'card', 'credit', 'debit', 'cvv', 'cvc', 'expiry', 'expiration',
      'payment', 'billing', 'stripe',

      // Bank information
      'bank', 'routing', 'account', 'iban', 'swift', 'sort',
      'plaid', 'institution',

      // Payout information
      'payout', 'withdraw', 'transfer', 'balance',

      // Authentication (for financial flows)
      'password', 'pin', 'token', 'secret', 'key',

      // Personal financial identifiers
      'ssn', 'tax', 'ein', 'social'
    ];

    // Check if any sensitive pattern matches
    const hasSensitivePattern = sensitiveFinancialPatterns.some(pattern =>
      allAttributes.includes(pattern)
    );

    // Additional checks for parent containers
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) { // Check up to 3 levels up
      const parentClass = parent.className?.toLowerCase() || '';
      const parentId = parent.id?.toLowerCase() || '';

      if (parentClass.includes('payment') ||
          parentClass.includes('bank') ||
          parentClass.includes('payout') ||
          parentClass.includes('stripe') ||
          parentClass.includes('plaid') ||
          parentId.includes('payment') ||
          parentId.includes('bank') ||
          parentId.includes('payout')) {
        return true;
      }

      parent = parent.parentElement;
      depth++;
    }

    return hasSensitivePattern;
  }

  /**
   * Test the redaction logic (for debugging)
   * Call this in development to verify redaction patterns
   */
  testRedactionLogic(): void {
    if (typeof window === 'undefined') return;

    console.log('🧪 Testing LogRocket redaction logic...');

    // Test cases for elements that SHOULD be redacted
    const sensitiveTestCases = [
      { id: 'card-number', name: 'cardNumber', type: 'text' },
      { id: 'cvv-input', name: 'cvv', type: 'password' },
      { id: 'bank-account', name: 'accountNumber', type: 'text' },
      { id: 'routing-number', name: 'routingNumber', type: 'text' },
      { id: 'payout-amount', name: 'payoutAmount', type: 'number' },
      { className: 'stripe-input', name: 'payment', type: 'text' },
      { className: 'plaid-input', name: 'bankConnection', type: 'text' }
    ];

    // Test cases for elements that should NOT be redacted
    const publicTestCases = [
      { id: 'page-title', name: 'title', type: 'text' },
      { id: 'page-content', name: 'content', type: 'textarea' },
      { id: 'username', name: 'username', type: 'text' },
      { id: 'search-query', name: 'search', type: 'text' },
      { id: 'page-description', name: 'description', type: 'text' }
    ];

    console.log('🔒 Elements that SHOULD be redacted:');
    sensitiveTestCases.forEach(testCase => {
      const mockElement = document.createElement('input');
      Object.entries(testCase).forEach(([key, value]) => {
        if (key === 'className') {
          mockElement.className = value;
        } else {
          mockElement.setAttribute(key, value);
        }
      });

      const shouldRedact = this.isSensitiveFinancialElement(mockElement);
      console.log(`  ${JSON.stringify(testCase)} → ${shouldRedact ? '✅ REDACTED' : '❌ NOT REDACTED'}`);
    });

    console.log('✅ Elements that should NOT be redacted:');
    publicTestCases.forEach(testCase => {
      const mockElement = document.createElement('input');
      Object.entries(testCase).forEach(([key, value]) => {
        mockElement.setAttribute(key, value);
      });

      const shouldRedact = this.isSensitiveFinancialElement(mockElement);
      console.log(`  ${JSON.stringify(testCase)} → ${shouldRedact ? '❌ REDACTED' : '✅ NOT REDACTED'}`);
    });
  }

  /**
   * Check if LogRocket is initialized and ready
   */
  get isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const logRocketService = new LogRocketService();

// Export convenience functions
export const initLogRocket = () => logRocketService.init();
export const identifyUser = (user: Parameters<typeof logRocketService.identify>[0]) =>
  logRocketService.identify(user);
export const trackEvent = (name: string, properties?: Record<string, any>) =>
  logRocketService.track(name, properties);
export const captureMessage = (message: string, extra?: Record<string, any>) =>
  logRocketService.captureMessage(message, extra);
export const getSessionURL = (callback: (url: string) => void) =>
  logRocketService.getSessionURL(callback);
export const testRedactionLogic = () => logRocketService.testRedactionLogic();

export default logRocketService;
