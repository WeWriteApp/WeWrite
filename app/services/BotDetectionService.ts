/**
 * Enterprise-grade bot detection and traffic validation service
 * Implements comprehensive bot filtering and suspicious traffic detection
 */

interface BotDetectionResult {
  isBot: boolean;
  confidence: number; // 0-1, higher means more confident it's a bot
  reasons: string[];
  category?: 'search_engine' | 'social_media' | 'monitoring' | 'automation' | 'suspicious' | 'legitimate';
}

interface VisitorFingerprint {
  id: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: boolean;
  touchSupport: boolean;
  colorDepth: number;
  pixelRatio: number;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  webdriver: boolean;
  headless: boolean;
}

export class BotDetectionService {
  // Known bot user agents (comprehensive list)
  private static readonly BOT_USER_AGENTS = [
    // Search engines
    'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
    'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot',
    
    // Social media crawlers
    'facebookexternalhit', 'facebookcatalog', 'twitterbot', 'linkedinbot',
    'pinterestbot', 'redditbot', 'slackbot', 'discordbot',
    
    // Monitoring and uptime services
    'pingdom', 'uptimerobot', 'statuscake', 'site24x7', 'newrelic',
    'datadog', 'nagios', 'zabbix', 'prtg',
    
    // SEO and analytics tools
    'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'screaming frog',
    'seobilitybot', 'sistrixcrawler',
    
    // Automation and testing
    'selenium', 'phantomjs', 'headlesschrome', 'puppeteer', 'playwright',
    'webdriver', 'chromedriver', 'geckodriver',
    
    // Security scanners
    'nessus', 'openvas', 'nikto', 'sqlmap', 'nmap',
    
    // Generic crawlers
    'crawler', 'spider', 'scraper', 'bot', 'robot'
  ];

  // Suspicious patterns
  private static readonly SUSPICIOUS_PATTERNS = [
    /headless/i,
    /phantom/i,
    /selenium/i,
    /webdriver/i,
    /automation/i,
    /test/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /bot/i,
    /robot/i
  ];

  // Legitimate browser patterns
  private static readonly LEGITIMATE_BROWSERS = [
    /chrome\/\d+/i,
    /firefox\/\d+/i,
    /safari\/\d+/i,
    /edge\/\d+/i,
    /opera\/\d+/i
  ];

  /**
   * Comprehensive bot detection analysis
   */
  static detectBot(userAgent: string, fingerprint?: Partial<VisitorFingerprint>): BotDetectionResult {
    const reasons: string[] = [];
    let confidence = 0;
    let category: BotDetectionResult['category'] = 'legitimate';

    // 1. User Agent Analysis
    const userAgentLower = userAgent.toLowerCase();
    
    // Check for known bot user agents
    for (const botAgent of this.BOT_USER_AGENTS) {
      if (userAgentLower.includes(botAgent)) {
        reasons.push(`Known bot user agent: ${botAgent}`);
        confidence += 0.9;
        
        // Categorize the bot
        if (['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot'].some(bot => userAgentLower.includes(bot))) {
          category = 'search_engine';
        } else if (['facebookexternalhit', 'twitterbot', 'linkedinbot'].some(bot => userAgentLower.includes(bot))) {
          category = 'social_media';
        } else if (['pingdom', 'uptimerobot', 'statuscake'].some(bot => userAgentLower.includes(bot))) {
          category = 'monitoring';
        } else {
          category = 'automation';
        }
        break;
      }
    }

    // Check for suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(userAgent)) {
        reasons.push(`Suspicious pattern detected: ${pattern.source}`);
        confidence += 0.7;
        category = 'suspicious';
      }
    }

    // 2. Browser Legitimacy Check
    const hasLegitimateSignature = this.LEGITIMATE_BROWSERS.some(pattern => pattern.test(userAgent));
    if (!hasLegitimateSignature && userAgent.length > 10) {
      reasons.push('No legitimate browser signature detected');
      confidence += 0.5;
    }

    // 3. Fingerprint Analysis (if available)
    if (fingerprint) {
      // Check for automation indicators
      if (fingerprint.webdriver) {
        reasons.push('WebDriver detected');
        confidence += 0.8;
        category = 'automation';
      }

      if (fingerprint.headless) {
        reasons.push('Headless browser detected');
        confidence += 0.9;
        category = 'automation';
      }

      // Suspicious screen resolution (common in automation)
      if (fingerprint.screenResolution === '1024x768' || fingerprint.screenResolution === '800x600') {
        reasons.push('Suspicious screen resolution');
        confidence += 0.3;
      }

      // Missing touch support on mobile user agent
      if (userAgentLower.includes('mobile') && !fingerprint.touchSupport) {
        reasons.push('Mobile user agent without touch support');
        confidence += 0.4;
      }

      // Unusual hardware concurrency
      if (fingerprint.hardwareConcurrency === 1 || fingerprint.hardwareConcurrency > 32) {
        reasons.push('Unusual hardware concurrency');
        confidence += 0.2;
      }

      // No cookie support (rare in legitimate browsers)
      if (!fingerprint.cookieEnabled) {
        reasons.push('Cookies disabled');
        confidence += 0.3;
      }
    }

    // 4. User Agent Structure Analysis
    if (userAgent.length < 20) {
      reasons.push('Unusually short user agent');
      confidence += 0.4;
    }

    if (userAgent.length > 500) {
      reasons.push('Unusually long user agent');
      confidence += 0.3;
    }

    // Missing common browser components
    if (!userAgent.includes('Mozilla') && !userAgent.includes('AppleWebKit') && !userAgent.includes('Gecko')) {
      reasons.push('Missing standard browser components');
      confidence += 0.6;
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    return {
      isBot: confidence > 0.5,
      confidence,
      reasons,
      category: confidence > 0.5 ? category : 'legitimate'
    };
  }

  /**
   * Generate a unique browser fingerprint for visitor identification
   */
  static generateFingerprint(): VisitorFingerprint {
    if (typeof window === 'undefined') {
      throw new Error('Fingerprinting can only be done in browser environment');
    }

    const nav = window.navigator;
    const screen = window.screen;

    // Detect automation indicators
    const webdriver = !!(nav as any).webdriver || 
                     !!(window as any).webdriver ||
                     !!(window as any).callPhantom ||
                     !!(window as any)._phantom ||
                     !!(window as any).phantom;

    const headless = !window.outerHeight || 
                    !window.outerWidth ||
                    window.outerHeight === 0 ||
                    window.outerWidth === 0;

    const fingerprint: VisitorFingerprint = {
      id: '', // Will be generated from hash
      userAgent: nav.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: nav.language,
      platform: nav.platform,
      cookieEnabled: nav.cookieEnabled,
      doNotTrack: nav.doNotTrack === '1',
      touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      hardwareConcurrency: nav.hardwareConcurrency || 0,
      maxTouchPoints: nav.maxTouchPoints || 0,
      webdriver,
      headless
    };

    // Generate fingerprint ID from hash of all properties
    fingerprint.id = this.hashFingerprint(fingerprint);

    return fingerprint;
  }

  /**
   * Create a hash from fingerprint data for unique identification
   */
  private static hashFingerprint(fingerprint: Omit<VisitorFingerprint, 'id'>): string {
    const data = JSON.stringify(fingerprint);
    let hash = 0;
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `fp_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  }

  /**
   * Validate visitor behavior patterns for additional bot detection
   */
  static validateVisitorBehavior(sessionData: {
    pageViews: number;
    sessionDuration: number; // in seconds
    mouseMovements: number;
    clicks: number;
    scrollEvents: number;
    keystrokes: number;
  }): { isSuspicious: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let suspicious = false;

    // Too many page views in short time
    if (sessionData.pageViews > 50 && sessionData.sessionDuration < 60) {
      reasons.push('Excessive page views in short duration');
      suspicious = true;
    }

    // No human interaction
    if (sessionData.sessionDuration > 30 && 
        sessionData.mouseMovements === 0 && 
        sessionData.clicks === 0 && 
        sessionData.scrollEvents === 0) {
      reasons.push('No human interaction detected');
      suspicious = true;
    }

    // Unrealistic interaction patterns
    if (sessionData.clicks > sessionData.pageViews * 10) {
      reasons.push('Unrealistic click patterns');
      suspicious = true;
    }

    return { isSuspicious: suspicious, reasons };
  }
}
