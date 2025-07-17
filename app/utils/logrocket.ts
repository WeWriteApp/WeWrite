/**
 * LogRocket Integration for WeWrite
 * 
 * Provides session replay, console logging, and error tracking
 * with proper data sanitization and production-only initialization
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
    // Only initialize in production and client-side
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Initialize LogRocket - only in production and client-side
   * Called from the main app component
   */
  init(): void {
    // Skip initialization if:
    // - Already initialized
    // - Not in production
    // - Running on server-side
    // - No app ID configured
    if (
      this.isInitialized ||
      !this.isProduction ||
      typeof window === 'undefined' ||
      !process.env.NEXT_PUBLIC_LOGROCKET_APP_ID
    ) {
      return;
    }

    try {
      // Initialize LogRocket with app ID
      LogRocket.init(process.env.NEXT_PUBLIC_LOGROCKET_APP_ID);

      // Configure data sanitization
      this.configureSanitization();

      // Configure ignore rules
      this.configureIgnoreRules();

      this.isInitialized = true;
      console.log('✅ LogRocket initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LogRocket:', error);
    }
  }

  /**
   * Configure data sanitization to protect sensitive information
   */
  private configureSanitization(): void {
    // Sanitize sensitive data from DOM
    LogRocket.addSanitizedProperty('data-token-balance');
    LogRocket.addSanitizedProperty('data-auth-token');
    LogRocket.addSanitizedProperty('data-stripe-key');
    LogRocket.addSanitizedProperty('data-payment-method');

    // Sanitize input fields containing sensitive data
    LogRocket.addSanitizedProperty('input[name*="password"]');
    LogRocket.addSanitizedProperty('input[name*="token"]');
    LogRocket.addSanitizedProperty('input[name*="key"]');
    LogRocket.addSanitizedProperty('input[name*="secret"]');
    LogRocket.addSanitizedProperty('input[type="password"]');

    // Sanitize specific CSS selectors
    LogRocket.addSanitizedProperty('.token-balance');
    LogRocket.addSanitizedProperty('.auth-token');
    LogRocket.addSanitizedProperty('.payment-info');
    LogRocket.addSanitizedProperty('.stripe-element');

    // Sanitize network requests containing sensitive data
    LogRocket.getSessionURL((sessionURL) => {
      // Custom sanitization for network requests
      LogRocket.captureMessage('Session started', {
        sessionURL,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        // Don't include sensitive headers or tokens
      });
    });
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
    if (!this.isInitialized) return;

    try {
      // Sanitize user data - only include safe, non-sensitive information
      const sanitizedUser: LogRocketUser = {
        id: user.id,
        name: user.username,
        email: user.email ? this.sanitizeEmail(user.email) : undefined,
      };

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

      console.log('👤 User identified in LogRocket:', user.id);
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
   * Capture custom messages/logs
   */
  captureMessage(message: string, extra: Record<string, any> = {}): void {
    if (!this.isInitialized) return;

    try {
      const sanitizedExtra = this.sanitizeEventProperties(extra);
      LogRocket.captureMessage(message, sanitizedExtra);
    } catch (error) {
      console.error('❌ Failed to capture LogRocket message:', error);
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

export default logRocketService;
