/**
 * Account Security Service
 *
 * Provides account-level security features including:
 * - Disposable email detection
 * - Account velocity limits (max accounts per IP)
 * - Trust score calculation based on account behavior
 *
 * @see app/services/RiskScoringService.ts
 */

import { adminDb } from '../lib/firebase-admin';

// Types
export type TrustLevel = 'new' | 'basic' | 'verified' | 'trusted' | 'premium';

export interface AccountTrustScore {
  level: TrustLevel;
  score: number; // 0-100 (higher = more trusted)
  factors: TrustFactor[];
  restrictions: string[];
}

export interface TrustFactor {
  name: string;
  score: number; // -50 to +50 contribution
  reason: string;
}

export interface EmailValidationResult {
  isValid: boolean;
  isDisposable: boolean;
  isFreeProvider: boolean;
  domain: string;
  reasons: string[];
}

export interface AccountVelocityResult {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  windowHours: number;
  reasons: string[];
}

// Common disposable email domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Popular temp mail services
  '10minutemail.com',
  '10minmail.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  'guerrillamail.biz',
  'mailinator.com',
  'maildrop.cc',
  'throwaway.email',
  'throwawaymail.com',
  'fakeinbox.com',
  'getnada.com',
  'yopmail.com',
  'yopmail.fr',
  'sharklasers.com',
  'dispostable.com',
  'mailnesia.com',
  'trashmail.com',
  'trash-mail.com',
  'mintemail.com',
  'mytrashmail.com',
  'mt2009.com',
  'thankyou2010.com',
  'trash2009.com',
  'tempr.email',
  'discard.email',
  'discardmail.com',
  'spamgourmet.com',
  'mailexpire.com',
  'tempail.com',
  'emailondeck.com',
  'getairmail.com',
  'mohmal.com',
  'crazymailing.com',
  'tempinbox.com',
  'fakemailgenerator.com',
  'emailfake.com',
  'mailcatch.com',
  'inboxalias.com',
  'mailsac.com',
  'burnermail.io',
  'temp-mail.io',
  'tempmailo.com',
  'tmpmail.org',
  'tmpmail.net',
  'tempmailaddress.com',
  'tempmails.org',
  '1secmail.com',
  '1secmail.org',
  '1secmail.net',
  'dropmail.me',
  'harakirimail.com',
  'spambox.us',
  'spamfree24.org',
  'trashmail.net',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wegwerfmail.org',
  // Additional common ones
  'mailnator.com',
  'gmailnator.com',
  'tempemails.net',
  'emailtemporar.ro',
  'fakemail.net',
  'tempinbox.co.uk',
  'sofimail.com',
  'tempomail.fr',
  'mytemp.email',
  'tempsky.com',
  'nwytg.com',
  'mailseal.de',
  'otherinbox.com',
]);

// Free email providers (not disposable, but track for analytics)
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'tutanota.com',
  'fastmail.com',
]);

// Account velocity limits
const VELOCITY_LIMITS = {
  ACCOUNTS_PER_IP_24H: 3,
  ACCOUNTS_PER_IP_7D: 5,
  ACCOUNTS_PER_DEVICE_24H: 2,
};

// Trust score thresholds
const TRUST_THRESHOLDS = {
  NEW: 0,
  BASIC: 20,
  VERIFIED: 40,
  TRUSTED: 60,
  PREMIUM: 80,
};

export class AccountSecurityService {
  /**
   * Validate email address for registration
   */
  validateEmail(email: string): EmailValidationResult {
    const reasons: string[] = [];

    // Basic validation
    if (!email || typeof email !== 'string') {
      return {
        isValid: false,
        isDisposable: false,
        isFreeProvider: false,
        domain: '',
        reasons: ['Invalid email format'],
      };
    }

    const emailLower = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(emailLower)) {
      return {
        isValid: false,
        isDisposable: false,
        isFreeProvider: false,
        domain: '',
        reasons: ['Invalid email format'],
      };
    }

    const domain = emailLower.split('@')[1];

    // Check for disposable email
    const isDisposable = DISPOSABLE_EMAIL_DOMAINS.has(domain);
    if (isDisposable) {
      reasons.push('Disposable email addresses are not allowed');
    }

    // Check for free provider
    const isFreeProvider = FREE_EMAIL_PROVIDERS.has(domain);

    return {
      isValid: !isDisposable,
      isDisposable,
      isFreeProvider,
      domain,
      reasons,
    };
  }

  /**
   * Check if email domain is disposable
   */
  isDisposableEmail(email: string): boolean {
    if (!email) return false;
    const domain = email.toLowerCase().split('@')[1];
    return domain ? DISPOSABLE_EMAIL_DOMAINS.has(domain) : false;
  }

  /**
   * Check account creation velocity for an IP
   */
  async checkAccountVelocity(ip: string): Promise<AccountVelocityResult> {
    const reasons: string[] = [];

    try {
      // Query recent accounts from this IP in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentAccountsSnapshot = await adminDb
        .collection('accountVelocity')
        .where('ip', '==', ip)
        .where('createdAt', '>=', twentyFourHoursAgo)
        .get();

      const currentCount = recentAccountsSnapshot.size;
      const maxAllowed = VELOCITY_LIMITS.ACCOUNTS_PER_IP_24H;
      const allowed = currentCount < maxAllowed;

      if (!allowed) {
        reasons.push(
          `Maximum ${maxAllowed} accounts allowed per IP address every 24 hours`
        );
      }

      return {
        allowed,
        currentCount,
        maxAllowed,
        windowHours: 24,
        reasons,
      };
    } catch (error) {
      console.error('[AccountSecurity] Velocity check error:', error);
      // On error, allow but log
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: VELOCITY_LIMITS.ACCOUNTS_PER_IP_24H,
        windowHours: 24,
        reasons: ['Velocity check unavailable'],
      };
    }
  }

  /**
   * Record account creation for velocity tracking
   */
  async recordAccountCreation(
    userId: string,
    ip: string,
    email: string,
    deviceFingerprint?: string
  ): Promise<void> {
    try {
      await adminDb.collection('accountVelocity').add({
        userId,
        ip,
        emailDomain: email.split('@')[1]?.toLowerCase(),
        deviceFingerprint: deviceFingerprint || null,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('[AccountSecurity] Record creation error:', error);
    }
  }

  /**
   * Calculate trust score for a user account
   */
  async calculateTrustScore(userData: {
    uid: string;
    createdAt?: Date | any;
    emailVerified?: boolean;
    email?: string;
    totalPages?: number;
    totalReplies?: number;
    hasSubscription?: boolean;
    reportCount?: number;
    flagCount?: number;
  }): Promise<AccountTrustScore> {
    const factors: TrustFactor[] = [];
    let score = 50; // Start at neutral

    // 1. Account age
    if (userData.createdAt) {
      const createdDate =
        userData.createdAt?.toDate?.() || new Date(userData.createdAt);
      const ageInDays = Math.floor(
        (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (ageInDays > 365) {
        factors.push({
          name: 'account_age',
          score: 20,
          reason: 'Account older than 1 year',
        });
        score += 20;
      } else if (ageInDays > 90) {
        factors.push({
          name: 'account_age',
          score: 15,
          reason: 'Account older than 90 days',
        });
        score += 15;
      } else if (ageInDays > 30) {
        factors.push({
          name: 'account_age',
          score: 10,
          reason: 'Account older than 30 days',
        });
        score += 10;
      } else if (ageInDays < 7) {
        factors.push({
          name: 'account_age',
          score: -10,
          reason: 'Account less than 7 days old',
        });
        score -= 10;
      }
    }

    // 2. Email verification
    if (userData.emailVerified) {
      factors.push({
        name: 'email_verified',
        score: 15,
        reason: 'Email address verified',
      });
      score += 15;
    } else {
      factors.push({
        name: 'email_verified',
        score: -5,
        reason: 'Email not verified',
      });
      score -= 5;
    }

    // 3. Content creation (engagement)
    const totalContent = (userData.totalPages || 0) + (userData.totalReplies || 0);
    if (totalContent > 100) {
      factors.push({
        name: 'content_creation',
        score: 15,
        reason: 'Active content creator (100+ items)',
      });
      score += 15;
    } else if (totalContent > 20) {
      factors.push({
        name: 'content_creation',
        score: 10,
        reason: 'Regular content creator (20+ items)',
      });
      score += 10;
    } else if (totalContent > 5) {
      factors.push({
        name: 'content_creation',
        score: 5,
        reason: 'Some content created (5+ items)',
      });
      score += 5;
    }

    // 4. Subscription status
    if (userData.hasSubscription) {
      factors.push({
        name: 'subscription',
        score: 10,
        reason: 'Active subscription',
      });
      score += 10;
    }

    // 5. Report/flag history
    const reportCount = userData.reportCount || 0;
    const flagCount = userData.flagCount || 0;

    if (reportCount > 5 || flagCount > 3) {
      factors.push({
        name: 'reports',
        score: -25,
        reason: `Multiple reports (${reportCount}) or flags (${flagCount})`,
      });
      score -= 25;
    } else if (reportCount > 0 || flagCount > 0) {
      factors.push({
        name: 'reports',
        score: -10,
        reason: `Some reports (${reportCount}) or flags (${flagCount})`,
      });
      score -= 10;
    }

    // 6. Email domain quality
    if (userData.email) {
      const domain = userData.email.split('@')[1]?.toLowerCase();
      if (domain && !FREE_EMAIL_PROVIDERS.has(domain) && !DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
        // Custom domain (business email) is more trustworthy
        factors.push({
          name: 'email_domain',
          score: 5,
          reason: 'Uses custom email domain',
        });
        score += 5;
      }
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine trust level
    const level = this.scoreToTrustLevel(score);

    // Determine restrictions based on trust level
    const restrictions = this.getRestrictionsForLevel(level);

    return {
      level,
      score,
      factors,
      restrictions,
    };
  }

  /**
   * Convert score to trust level
   */
  private scoreToTrustLevel(score: number): TrustLevel {
    if (score >= TRUST_THRESHOLDS.PREMIUM) return 'premium';
    if (score >= TRUST_THRESHOLDS.TRUSTED) return 'trusted';
    if (score >= TRUST_THRESHOLDS.VERIFIED) return 'verified';
    if (score >= TRUST_THRESHOLDS.BASIC) return 'basic';
    return 'new';
  }

  /**
   * Get restrictions for a trust level
   */
  private getRestrictionsForLevel(level: TrustLevel): string[] {
    const restrictions: string[] = [];

    switch (level) {
      case 'new':
        restrictions.push('Limited to 3 pages per hour');
        restrictions.push('Maximum 1 external link per page');
        restrictions.push('Subject to CAPTCHA challenges');
        restrictions.push('Cannot access premium features');
        break;
      case 'basic':
        restrictions.push('Limited to 10 pages per hour');
        restrictions.push('Maximum 3 external links per page');
        restrictions.push('May see occasional CAPTCHA');
        break;
      case 'verified':
        restrictions.push('Limited to 20 pages per hour');
        restrictions.push('Maximum 5 external links per page');
        break;
      case 'trusted':
      case 'premium':
        // No significant restrictions
        break;
    }

    return restrictions;
  }

  /**
   * Quick check if user is trusted enough to skip challenges
   */
  async isUserTrusted(userId: string): Promise<boolean> {
    try {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) return false;

      const userData = userDoc.data();
      const trustScore = await this.calculateTrustScore({
        uid: userId,
        ...userData,
      });

      return trustScore.level === 'trusted' || trustScore.level === 'premium';
    } catch (error) {
      console.error('[AccountSecurity] Trust check error:', error);
      return false;
    }
  }

  /**
   * Get the list of disposable domains (for admin use)
   */
  getDisposableDomainsList(): string[] {
    return Array.from(DISPOSABLE_EMAIL_DOMAINS).sort();
  }

  /**
   * Add a domain to the disposable list (runtime only, for hot-fixes)
   */
  addDisposableDomain(domain: string): void {
    DISPOSABLE_EMAIL_DOMAINS.add(domain.toLowerCase());
  }
}

// Singleton instance
let instance: AccountSecurityService | null = null;

export function getAccountSecurityService(): AccountSecurityService {
  if (!instance) {
    instance = new AccountSecurityService();
  }
  return instance;
}

export default AccountSecurityService;
