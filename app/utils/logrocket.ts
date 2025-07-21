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
    // Initialize in production, or in development if explicitly enabled
    this.isProduction = process.env.NODE_ENV === 'production' ||
                       process.env.NEXT_PUBLIC_LOGROCKET_ENABLE_DEV === 'true';
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

      // Initialize LogRocket with app ID and sanitization config
      LogRocket.init(process.env.NEXT_PUBLIC_LOGROCKET_APP_ID, {
        dom: {
          inputSanitizer: true,
          textSanitizer: true,
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
