/**
 * Risk Scoring Service
 *
 * Central risk assessment engine that combines multiple signals to calculate
 * a trust score (0-100) for actions and users.
 *
 * TRUST SCORE THRESHOLDS (higher = more trusted):
 * - 75-100: ALLOW     - No challenge required (trusted)
 * - 50-74:  SOFT      - Invisible Turnstile challenge
 * - 25-49:  HARD      - Visible Turnstile challenge required
 * - 0-24:   BLOCK     - Action blocked, logged for review
 *
 * TRUST FACTORS (higher = more trusted):
 * - Bot detection confidence (from BotDetectionService)
 * - IP reputation
 * - Account age & trust level
 * - Behavioral patterns (session duration, interactions)
 * - Action velocity (rate of similar actions)
 *
 * @see docs/security/ANTI_SPAM_SYSTEM.md
 */

import { BotDetectionService } from './BotDetectionService';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs, limit, Timestamp, setDoc, orderBy } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';

// ============================================================================
// Types
// ============================================================================

export type RiskLevel = 'allow' | 'soft_challenge' | 'hard_challenge' | 'block';

export type ActionType =
  | 'login'
  | 'register'
  | 'create_page'
  | 'edit_page'
  | 'create_reply'
  | 'send_message'
  | 'password_reset'
  | 'email_change'
  | 'account_delete';

export interface RiskFactors {
  botDetection: {
    score: number;      // 0-100 (higher = more trusted/human)
    confidence: number; // 0-1
    reasons: string[];
    category?: string;
  };
  ipReputation: {
    score: number;      // 0-100 (higher = cleaner IP)
    isProxy: boolean;
    isVpn: boolean;
    isTor: boolean;
    isDatacenter: boolean;
    country?: string;
    threatLevel?: 'none' | 'low' | 'medium' | 'high';
  };
  accountTrust: {
    score: number;      // 0-100 (higher = more trusted)
    accountAge: number; // days
    emailVerified: boolean;
    hasActivity: boolean;
    contentCount: number;
    trustLevel: 'new' | 'regular' | 'trusted' | 'verified';
    pwaSpoof?: boolean; // True if PWA claimed but never verified + no content (bot farm indicator)
  };
  behavioral: {
    score: number;      // 0-100 (higher = more trusted/normal)
    sessionDuration: number; // seconds
    interactions: number;
    suspiciousPatterns: string[];
  };
  velocity: {
    score: number;      // 0-100 (higher = normal rate)
    recentActions: number;
    threshold: number;
    exceededLimit: boolean;
  };
  contentBehavior: {
    score: number;      // 0-100 (higher = good content patterns)
    pageCount: number;
    hasExternalLinks: boolean;
    externalLinkCount: number;
    hasInternalLinks: boolean;
    internalLinkCount: number;
    suspiciousPatterns: string[];
  };
  financialTrust: {
    score: number;      // 0-100 (higher = paying user, more trusted)
    hasActiveSubscription: boolean;
    subscriptionAmountCents: number;
    hasAllocatedToOthers: boolean;  // Key trust signal: spending money to support others
    totalAllocatedCents: number;
    hasEarnings: boolean;
    totalEarningsCents: number;
    hasPayoutSetup: boolean;
    trustIndicators: string[];      // Positive signals
    riskIndicators: string[];       // Negative signals
  };
}

export interface RiskAssessment {
  score: number;           // 0-100
  level: RiskLevel;
  factors: RiskFactors;
  action: ActionType;
  timestamp: Date;
  userId?: string;
  ip?: string;
  recommendation: 'allow' | 'challenge_invisible' | 'challenge_visible' | 'block';
  reasons: string[];
}

export interface RiskAssessmentInput {
  action: ActionType;
  userId?: string;
  ip?: string;
  userAgent?: string;
  fingerprint?: any;
  sessionData?: {
    duration: number;
    interactions: number;
    pageViews: number;
  };
  contentLength?: number;
  hasLinks?: boolean;
  linkCount?: number;
}

// ============================================================================
// Configuration
// ============================================================================

// Trust score thresholds (higher = more trusted)
const RISK_THRESHOLDS = {
  ALLOW: 75,           // 75-100: Trusted
  SOFT_CHALLENGE: 50,  // 50-74: Medium
  HARD_CHALLENGE: 25,  // 25-49: Suspicious
  BLOCK: 0             // 0-24: Very suspicious
};

// Trust factor importance multipliers
// Higher importance = factor counts more in the weighted average
// Financial trust is 3x because paying users are extremely unlikely to be bots
export const RISK_FACTOR_IMPORTANCE: Record<string, number> = {
  botDetection: 1,
  ipReputation: 1,
  accountTrust: 1,
  behavioral: 1,
  velocity: 1,
  contentBehavior: 1,
  financialTrust: 3,  // 3x importance - paying users are far more trusted
};

// Calculate total weight for weighted average
const TOTAL_IMPORTANCE_WEIGHT = Object.values(RISK_FACTOR_IMPORTANCE).reduce((a, b) => a + b, 0); // = 9

// Account age thresholds (in days)
const ACCOUNT_AGE_THRESHOLDS = {
  NEW: 7,           // < 7 days = new account
  REGULAR: 30,      // 7-30 days = regular
  TRUSTED: 90       // > 90 days = trusted
};

// Velocity limits per action type (per hour)
const VELOCITY_LIMITS: Record<ActionType, { newAccount: number; regular: number; trusted: number }> = {
  login: { newAccount: 5, regular: 10, trusted: 20 },
  register: { newAccount: 1, regular: 1, trusted: 1 },
  create_page: { newAccount: 3, regular: 20, trusted: 100 },
  edit_page: { newAccount: 10, regular: 50, trusted: 200 },
  create_reply: { newAccount: 5, regular: 30, trusted: 100 },
  send_message: { newAccount: 10, regular: 50, trusted: 100 },
  password_reset: { newAccount: 3, regular: 5, trusted: 5 },
  email_change: { newAccount: 2, regular: 3, trusted: 5 },
  account_delete: { newAccount: 1, regular: 1, trusted: 1 }
};

// ============================================================================
// Risk Scoring Service
// ============================================================================

export class RiskScoringService {
  // Cache for user data to avoid repeated queries
  private static userCache = new Map<string, { data: any; timestamp: number }>();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate comprehensive trust score for an action
   *
   * IMPORTANT: All factors use 0-100 scale where HIGHER = MORE TRUSTED
   * The overall score is a weighted average based on RISK_FACTOR_IMPORTANCE
   * Financial trust has 3x importance because paying users are unlikely to be bots
   */
  static async assessRisk(input: RiskAssessmentInput): Promise<RiskAssessment> {
    const factors: RiskFactors = {
      botDetection: await this.assessBotRisk(input),
      ipReputation: await this.assessIPRisk(input.ip),
      accountTrust: await this.assessAccountTrust(input.userId),
      behavioral: this.assessBehavioralRisk(input.sessionData),
      velocity: await this.assessVelocityRisk(input),
      contentBehavior: await this.assessContentBehavior(input.userId),
      financialTrust: await this.assessFinancialTrust(input.userId)
    };

    // Calculate weighted average of all trust scores (higher = more trusted)
    // Financial trust has 3x importance because paying users are unlikely to be bots
    const weightedTrustScore =
      factors.botDetection.score * RISK_FACTOR_IMPORTANCE.botDetection +
      factors.ipReputation.score * RISK_FACTOR_IMPORTANCE.ipReputation +
      factors.accountTrust.score * RISK_FACTOR_IMPORTANCE.accountTrust +
      factors.behavioral.score * RISK_FACTOR_IMPORTANCE.behavioral +
      factors.velocity.score * RISK_FACTOR_IMPORTANCE.velocity +
      factors.contentBehavior.score * RISK_FACTOR_IMPORTANCE.contentBehavior +
      factors.financialTrust.score * RISK_FACTOR_IMPORTANCE.financialTrust;

    const score = Math.min(100, Math.max(0, Math.round(weightedTrustScore / TOTAL_IMPORTANCE_WEIGHT)));
    const level = this.scoreToLevel(score);
    const reasons = this.collectReasons(factors);

    const assessment: RiskAssessment = {
      score,
      level,
      factors,
      action: input.action,
      timestamp: new Date(),
      userId: input.userId,
      ip: input.ip,
      recommendation: this.levelToRecommendation(level),
      reasons
    };

    // Log assessment for analytics (async, don't await)
    this.logRiskEvent(assessment).catch(() => {});

    return assessment;
  }

  /**
   * Quick trust check without full assessment (for high-volume endpoints)
   */
  static async quickRiskCheck(input: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    action: ActionType;
  }): Promise<{ score: number; level: RiskLevel; shouldChallenge: boolean }> {
    // Bot check is fast and reliable
    const botResult = input.userAgent
      ? BotDetectionService.detectBot(input.userAgent)
      : { isBot: false, confidence: 0 };

    // If clearly a bot, short-circuit with low trust
    if (botResult.isBot && botResult.confidence > 0.8) {
      return {
        score: 10,  // Very low trust
        level: 'block',
        shouldChallenge: false // Block instead of challenge
      };
    }

    // Quick account age check - higher = more trusted
    let accountTrustScore = 50; // Default to medium
    if (input.userId) {
      const userData = await this.getCachedUserData(input.userId);
      if (userData?.createdAt) {
        const ageInDays = this.getAccountAgeDays(userData.createdAt);
        accountTrustScore = ageInDays > ACCOUNT_AGE_THRESHOLDS.TRUSTED ? 80 : ageInDays > ACCOUNT_AGE_THRESHOLDS.REGULAR ? 60 : 40;
      }
    }

    // Bot trust score: high confidence bot = low trust
    const botTrustScore = Math.round((1 - botResult.confidence) * 100);

    const score = Math.round(botTrustScore * 0.5 + accountTrustScore * 0.5);
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      shouldChallenge: level === 'soft_challenge' || level === 'hard_challenge'
    };
  }

  /**
   * Get trust level for a user (for display in admin)
   *
   * Uses weighted average based on RISK_FACTOR_IMPORTANCE
   * Financial trust has 3x importance because paying users are unlikely to be bots
   */
  static async getUserRiskLevel(userId: string): Promise<{
    score: number;
    level: RiskLevel;
    factors: RiskFactors;
    lastAssessment?: Date;
  }> {
    const factors: RiskFactors = {
      botDetection: { score: 100, confidence: 0, reasons: [] }, // Default to trusted (no bot info)
      ipReputation: await this.assessIPRisk(undefined), // Will use cached/default
      accountTrust: await this.assessAccountTrust(userId),
      behavioral: { score: 100, suspiciousPatterns: [], sessionDuration: 0, interactions: 0 }, // Default to trusted
      velocity: await this.assessVelocityRisk({ action: 'create_page', userId }),
      contentBehavior: await this.assessContentBehavior(userId),
      financialTrust: await this.assessFinancialTrust(userId)
    };

    // Weighted average of all trust scores (higher = more trusted)
    // Financial trust has 3x importance because paying users are unlikely to be bots
    const weightedTrustScore =
      factors.botDetection.score * RISK_FACTOR_IMPORTANCE.botDetection +
      factors.ipReputation.score * RISK_FACTOR_IMPORTANCE.ipReputation +
      factors.accountTrust.score * RISK_FACTOR_IMPORTANCE.accountTrust +
      factors.behavioral.score * RISK_FACTOR_IMPORTANCE.behavioral +
      factors.velocity.score * RISK_FACTOR_IMPORTANCE.velocity +
      factors.contentBehavior.score * RISK_FACTOR_IMPORTANCE.contentBehavior +
      factors.financialTrust.score * RISK_FACTOR_IMPORTANCE.financialTrust;

    const score = Math.min(100, Math.max(0, Math.round(weightedTrustScore / TOTAL_IMPORTANCE_WEIGHT)));

    // Get last assessment timestamp
    let lastAssessment: Date | undefined;
    try {
      const eventsRef = collection(db, getCollectionName('riskEvents'));
      const q = query(
        eventsRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        lastAssessment = data.timestamp?.toDate?.() || new Date(data.timestamp);
      }
    } catch {
      // Ignore errors fetching last assessment
    }

    return {
      score,
      level: this.scoreToLevel(score),
      factors,
      lastAssessment
    };
  }

  // ============================================================================
  // Private: Individual Risk Factor Assessments
  // ============================================================================

  private static async assessBotRisk(input: RiskAssessmentInput): Promise<RiskFactors['botDetection']> {
    if (!input.userAgent) {
      return { score: 70, confidence: 0, reasons: ['No user agent provided'] };
    }

    const result = BotDetectionService.detectBot(input.userAgent, input.fingerprint);

    // Convert confidence (0-1) to trust score (0-100)
    // High bot confidence = low trust
    const score = Math.round((1 - result.confidence) * 100);

    return {
      score,
      confidence: result.confidence,
      reasons: result.reasons,
      category: result.category
    };
  }

  private static async assessIPRisk(ip?: string): Promise<RiskFactors['ipReputation']> {
    // Default response for when IP is not available
    if (!ip) {
      return {
        score: 80, // High default trust (no IP doesn't mean risky)
        isProxy: false,
        isVpn: false,
        isTor: false,
        isDatacenter: false,
        threatLevel: 'none'
      };
    }

    // Check cache first
    const cacheKey = `ip:${ip}`;
    try {
      const cacheRef = doc(db, getCollectionName('ipReputationCache'), cacheKey);
      const cacheDoc = await getDoc(cacheRef);

      if (cacheDoc.exists()) {
        const cached = cacheDoc.data();
        const cacheAge = Date.now() - (cached.cachedAt?.toMillis?.() || 0);

        // Cache valid for 24 hours
        if (cacheAge < 24 * 60 * 60 * 1000) {
          // Invert old cached scores to new trust scores
          const oldScore = cached.reputation?.score ?? 20;
          return {
            ...cached.reputation,
            score: 100 - oldScore
          } as RiskFactors['ipReputation'];
        }
      }
    } catch {
      // Cache miss or error, proceed with assessment
    }

    // For now, return default (external IP service integration in Phase 6)
    // This will be enhanced with IPQualityScore or AbuseIPDB
    // Higher score = more trusted
    const reputation: RiskFactors['ipReputation'] = {
      score: 80, // Default to trusted
      isProxy: false,
      isVpn: false,
      isTor: false,
      isDatacenter: false,
      threatLevel: 'none'
    };

    // Detect common datacenter/proxy ranges (basic check) - reduce trust
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
      reputation.score = 60; // Lower trust for datacenter IPs
      reputation.isDatacenter = true;
    }

    return reputation;
  }

  private static async assessAccountTrust(userId?: string): Promise<RiskFactors['accountTrust']> {
    // No user = low trust
    if (!userId) {
      return {
        score: 20, // Low trust score
        accountAge: 0,
        emailVerified: false,
        hasActivity: false,
        contentCount: 0,
        trustLevel: 'new'
      };
    }

    const userData = await this.getCachedUserData(userId);

    if (!userData) {
      return {
        score: 20, // Low trust for unknown user
        accountAge: 0,
        emailVerified: false,
        hasActivity: false,
        contentCount: 0,
        trustLevel: 'new'
      };
    }

    const accountAge = this.getAccountAgeDays(userData.createdAt);
    const emailVerified = !!userData.emailVerified;
    const contentCount = userData.pagesCount || 0;
    const hasActivity = contentCount > 0;

    // Calculate trust level
    let trustLevel: RiskFactors['accountTrust']['trustLevel'] = 'new';
    if (accountAge > ACCOUNT_AGE_THRESHOLDS.TRUSTED && contentCount > 10) {
      trustLevel = 'trusted';
    } else if (accountAge > ACCOUNT_AGE_THRESHOLDS.REGULAR && contentCount > 0) {
      trustLevel = 'regular';
    } else if (userData.isVerified || userData.role === 'admin') {
      trustLevel = 'verified';
    }

    // Calculate trust score (higher = more trusted)
    let score = 20; // Base score

    // Account age bonus (up to +30)
    if (accountAge > ACCOUNT_AGE_THRESHOLDS.TRUSTED) {
      score += 30;
    } else if (accountAge > ACCOUNT_AGE_THRESHOLDS.REGULAR) {
      score += 20;
    } else if (accountAge > ACCOUNT_AGE_THRESHOLDS.NEW) {
      score += 10;
    }

    // Email verification bonus (+20)
    if (emailVerified) {
      score += 20;
    }

    // Activity bonus (up to +20)
    if (contentCount > 50) {
      score += 20;
    } else if (contentCount > 10) {
      score += 15;
    } else if (contentCount > 0) {
      score += 10;
    }

    // Admin/verified user bonus (+10)
    if (userData.role === 'admin' || userData.isVerified) {
      score += 10;
    }

    let trustScore = Math.min(100, score);

    // Check for PWA spoofing: claimed install but never verified + no content
    // This is a strong bot farm indicator - they spoof PWA install events
    const pwaStatus = await this.checkPWAStatus(userId);
    let pwaSpoof = false;
    if (pwaStatus.hasPWAInstall && !pwaStatus.hasPWAVerified && contentCount === 0) {
      // Reduce trust score
      trustScore = Math.max(0, trustScore - 15);
      pwaSpoof = true;
    }

    return {
      score: trustScore,
      accountAge,
      emailVerified,
      hasActivity,
      contentCount,
      trustLevel,
      // Include PWA spoofing flag in the return for potential UI display
      ...(pwaSpoof ? { pwaSpoof: true } : {})
    };
  }

  /**
   * Assess content behavior trust for a user
   *
   * Good indicators (increase trust):
   * - Multiple pages
   * - Internal links to other WeWrite pages (interconnection)
   * - Being linked TO by other pages (backlinks)
   *
   * Suspicious indicators (decrease trust):
   * - Only 1 page created
   * - Pages contain external links without internal links
   */
  private static async assessContentBehavior(userId?: string): Promise<RiskFactors['contentBehavior']> {
    // No user = moderate trust
    if (!userId) {
      return {
        score: 50,
        pageCount: 0,
        hasExternalLinks: false,
        externalLinkCount: 0,
        hasInternalLinks: false,
        internalLinkCount: 0,
        suspiciousPatterns: ['No user data available']
      };
    }

    const suspiciousPatterns: string[] = [];
    let trustScore = 50; // Start at medium trust

    try {
      // Get user's pages
      const pagesRef = collection(db, getCollectionName('pages'));
      const pagesQuery = query(
        pagesRef,
        where('userId', '==', userId),
        limit(20) // Limit to keep query fast
      );
      const pagesSnapshot = await getDocs(pagesQuery);
      const pageCount = pagesSnapshot.size;

      // Count external and internal links from the user's pages
      let externalLinkCount = 0;
      let internalLinkCount = 0;
      let totalBacklinks = 0;

      for (const pageDoc of pagesSnapshot.docs) {
        const pageData = pageDoc.data();

        // Count backlinks (pages linking TO this user's page)
        totalBacklinks += pageData.backlinkCount || 0;

        // Try to get link counts from the external links index
        try {
          const externalLinksRef = collection(db, getCollectionName('externalLinks'));
          const externalLinksQuery = query(
            externalLinksRef,
            where('pageId', '==', pageDoc.id),
            limit(50)
          );
          const externalLinksSnapshot = await getDocs(externalLinksQuery);
          externalLinkCount += externalLinksSnapshot.size;
        } catch {
          // Ignore errors accessing external links
        }

        // Count internal links from page content (simplified check)
        // Internal links are stored with pageId in the link nodes
        const content = pageData.content;
        if (content && Array.isArray(content)) {
          const countInternalLinks = (nodes: any[]): number => {
            let count = 0;
            for (const node of nodes) {
              if (node.type === 'link' && (node.pageId || node.isPageLink)) {
                count++;
              }
              if (node.children && Array.isArray(node.children)) {
                count += countInternalLinks(node.children);
              }
            }
            return count;
          };
          internalLinkCount += countInternalLinks(content);
        }
      }

      const hasExternalLinks = externalLinkCount > 0;
      const hasInternalLinks = internalLinkCount > 0;

      // Trust scoring logic (higher = more trusted):

      // Multiple pages is GOOD behavior (+15 trust for 2+, +25 for 5+)
      if (pageCount >= 5) {
        trustScore += 25;
      } else if (pageCount >= 2) {
        trustScore += 15;
      } else if (pageCount === 1) {
        // Only 1 page is suspicious (-20 trust)
        trustScore -= 20;
        suspiciousPatterns.push('Only 1 page created');
      } else {
        // No pages yet - lower trust
        trustScore -= 15;
        suspiciousPatterns.push('No pages created');
      }

      // Internal links are GOOD behavior (+10 trust per link, max +25)
      if (internalLinkCount > 0) {
        const internalBonus = Math.min(25, internalLinkCount * 10);
        trustScore += internalBonus;
      }

      // Being linked TO by others is GOOD behavior (+15 trust)
      if (totalBacklinks > 0) {
        trustScore += 15;
      }

      // External links reduce trust (-10 trust per link, max -30)
      if (externalLinkCount > 0) {
        const externalPenalty = Math.min(30, externalLinkCount * 10);
        trustScore -= externalPenalty;
        suspiciousPatterns.push(`${externalLinkCount} external link${externalLinkCount > 1 ? 's' : ''}`);
      }

      // HIGH EXTERNAL / LOW INTERNAL RATIO is very suspicious
      // This is a strong spam indicator: spammers add external links but don't engage with the community
      if (externalLinkCount > 0 && internalLinkCount === 0) {
        // External links but NO internal links = very suspicious (-25 trust)
        trustScore -= 25;
        suspiciousPatterns.push('External links without any internal links');
      } else if (externalLinkCount > internalLinkCount * 2 && externalLinkCount >= 2) {
        // More than 2x external links vs internal links = suspicious (-15 trust)
        trustScore -= 15;
        suspiciousPatterns.push('High external-to-internal link ratio');
      }

      return {
        score: Math.min(100, Math.max(0, trustScore)),
        pageCount,
        hasExternalLinks,
        externalLinkCount,
        hasInternalLinks,
        internalLinkCount,
        suspiciousPatterns
      };
    } catch (error) {
      // On error, return moderate trust
      return {
        score: 50,
        pageCount: 0,
        hasExternalLinks: false,
        externalLinkCount: 0,
        hasInternalLinks: false,
        internalLinkCount: 0,
        suspiciousPatterns: ['Error assessing content behavior']
      };
    }
  }

  /**
   * Assess financial trust for a user
   *
   * HIGHEST TRUST SIGNALS (dramatically increase trust):
   * - Has active subscription (paying customer)
   * - Has allocated money to other writers (supporting the platform)
   *
   * GOOD TRUST SIGNALS (increase trust):
   * - Has earnings (legitimate creator)
   * - Has payout setup (committed to platform)
   *
   * This factor is critical for identifying legitimate vs spam accounts:
   * - Spammers don't pay for subscriptions
   * - Spammers don't allocate money to other writers
   * - Legitimate users often have financial relationships
   */
  private static async assessFinancialTrust(userId?: string): Promise<RiskFactors['financialTrust']> {
    // No user = low trust (no financial trust)
    if (!userId) {
      return {
        score: 30, // Low trust for no user
        hasActiveSubscription: false,
        subscriptionAmountCents: 0,
        hasAllocatedToOthers: false,
        totalAllocatedCents: 0,
        hasEarnings: false,
        totalEarningsCents: 0,
        hasPayoutSetup: false,
        trustIndicators: [],
        riskIndicators: ['No user data available']
      };
    }

    const trustIndicators: string[] = [];
    const riskIndicators: string[] = [];
    let trustScore = 50; // Start at medium trust

    try {
      // Get user data for basic financial info
      const userData = await this.getCachedUserData(userId);

      // Check for Stripe connected account (payout setup)
      const hasPayoutSetup = !!userData?.stripeConnectedAccountId;
      if (hasPayoutSetup) {
        trustScore += 10;
        trustIndicators.push('Payout account setup');
      }

      // Check subscription status
      let hasActiveSubscription = false;
      let subscriptionAmountCents = 0;

      try {
        const userRef = doc(db, getCollectionName('users'), userId);
        const subscriptionRef = doc(userRef, 'subscriptions', 'current');
        const subscriptionDoc = await getDoc(subscriptionRef);

        if (subscriptionDoc.exists()) {
          const subData = subscriptionDoc.data();
          if (subData?.status === 'active' || subData?.status === 'trialing') {
            hasActiveSubscription = true;
            subscriptionAmountCents = subData?.amount || 0;

            // MAJOR trust signal - paying customer
            trustScore += 30; // Significant trust boost
            trustIndicators.push(`Active subscription ($${(subscriptionAmountCents / 100).toFixed(2)}/mo)`);

            // Higher subscription = even more trust
            if (subscriptionAmountCents >= 2000) { // $20+/mo
              trustScore += 10;
              trustIndicators.push('Premium subscriber');
            }
          }
        }
      } catch {
        // Ignore subscription check errors
      }

      // Check allocations (money given to other writers)
      let hasAllocatedToOthers = false;
      let totalAllocatedCents = 0;

      try {
        const allocationsRef = collection(db, getCollectionName('usdAllocations'));
        const allocationsQuery = query(
          allocationsRef,
          where('userId', '==', userId),
          where('status', '==', 'active'),
          limit(50)
        );
        const allocationsSnapshot = await getDocs(allocationsQuery);

        if (!allocationsSnapshot.empty) {
          hasAllocatedToOthers = true;
          allocationsSnapshot.docs.forEach(doc => {
            totalAllocatedCents += doc.data().usdCents || 0;
          });

          // MAJOR trust signal - actively supporting other writers
          trustScore += 25; // Significant trust boost
          trustIndicators.push(`Allocated $${(totalAllocatedCents / 100).toFixed(2)} to ${allocationsSnapshot.size} writer(s)`);
        }
      } catch {
        // Ignore allocation check errors
      }

      // Check earnings (money received from others)
      let hasEarnings = false;
      let totalEarningsCents = 0;

      try {
        const earningsRef = collection(db, getCollectionName('writerUsdEarnings'));
        const earningsQuery = query(
          earningsRef,
          where('userId', '==', userId),
          limit(10)
        );
        const earningsSnapshot = await getDocs(earningsQuery);

        if (!earningsSnapshot.empty) {
          hasEarnings = true;
          earningsSnapshot.docs.forEach(doc => {
            totalEarningsCents += doc.data().totalUsdCentsReceived || 0;
          });

          // Good trust signal - legitimate creator
          trustScore += 15;
          trustIndicators.push(`Earned $${(totalEarningsCents / 100).toFixed(2)} from supporters`);
        }
      } catch {
        // Ignore earnings check errors
      }

      // Reduce trust for accounts with no financial activity
      if (!hasActiveSubscription && !hasAllocatedToOthers && !hasEarnings && !hasPayoutSetup) {
        riskIndicators.push('No financial activity');
        trustScore -= 10; // Slight decrease in trust
      }

      return {
        score: Math.min(100, Math.max(0, trustScore)),
        hasActiveSubscription,
        subscriptionAmountCents,
        hasAllocatedToOthers,
        totalAllocatedCents,
        hasEarnings,
        totalEarningsCents,
        hasPayoutSetup,
        trustIndicators,
        riskIndicators
      };
    } catch (error) {
      // On error, return moderate trust
      return {
        score: 50,
        hasActiveSubscription: false,
        subscriptionAmountCents: 0,
        hasAllocatedToOthers: false,
        totalAllocatedCents: 0,
        hasEarnings: false,
        totalEarningsCents: 0,
        hasPayoutSetup: false,
        trustIndicators: [],
        riskIndicators: ['Error assessing financial trust']
      };
    }
  }

  private static assessBehavioralRisk(sessionData?: RiskAssessmentInput['sessionData']): RiskFactors['behavioral'] {
    if (!sessionData) {
      return {
        score: 70, // Medium-high trust when no session data (can't evaluate)
        sessionDuration: 0,
        interactions: 0,
        suspiciousPatterns: []
      };
    }

    const suspiciousPatterns: string[] = [];
    let trustScore = 100; // Start at full trust

    // Very short session with high activity = suspicious
    if (sessionData.duration < 5 && sessionData.pageViews > 10) {
      suspiciousPatterns.push('Rapid page navigation');
      trustScore -= 40;
    }

    // No interactions after significant session time = suspicious
    if (sessionData.duration > 30 && sessionData.interactions === 0) {
      suspiciousPatterns.push('No user interactions detected');
      trustScore -= 30;
    }

    // Extremely high page views = suspicious
    if (sessionData.pageViews > 100 && sessionData.duration < 300) {
      suspiciousPatterns.push('Excessive page views');
      trustScore -= 50;
    }

    // Perfect behavior (possible automation)
    if (sessionData.interactions > 0 && sessionData.interactions === sessionData.pageViews) {
      suspiciousPatterns.push('Uniform interaction pattern');
      trustScore -= 20;
    }

    return {
      score: Math.max(0, trustScore),
      sessionDuration: sessionData.duration,
      interactions: sessionData.interactions,
      suspiciousPatterns
    };
  }

  private static async assessVelocityRisk(input: RiskAssessmentInput): Promise<RiskFactors['velocity']> {
    const limits = VELOCITY_LIMITS[input.action];

    // Get user's trust level for appropriate limit
    let trustLevel: 'newAccount' | 'regular' | 'trusted' = 'newAccount';
    if (input.userId) {
      const accountTrust = await this.assessAccountTrust(input.userId);
      if (accountTrust.trustLevel === 'trusted' || accountTrust.trustLevel === 'verified') {
        trustLevel = 'trusted';
      } else if (accountTrust.trustLevel === 'regular') {
        trustLevel = 'regular';
      }
    }

    const threshold = limits[trustLevel];

    // Count recent actions (last hour)
    let recentActions = 0;
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const eventsRef = collection(db, getCollectionName('riskEvents'));

      let q;
      if (input.userId) {
        q = query(
          eventsRef,
          where('userId', '==', input.userId),
          where('action', '==', input.action),
          where('timestamp', '>=', Timestamp.fromDate(oneHourAgo))
        );
      } else if (input.ip) {
        q = query(
          eventsRef,
          where('ip', '==', input.ip),
          where('action', '==', input.action),
          where('timestamp', '>=', Timestamp.fromDate(oneHourAgo))
        );
      } else {
        return {
          score: 70, // Medium-high trust when can't check
          recentActions: 0,
          threshold,
          exceededLimit: false
        };
      }

      const snapshot = await getDocs(q);
      recentActions = snapshot.size;
    } catch {
      // If we can't check velocity, assume medium trust
      return {
        score: 80, // High trust when can't check
        recentActions: 0,
        threshold,
        exceededLimit: false
      };
    }

    const exceededLimit = recentActions >= threshold;
    const utilizationRatio = recentActions / threshold;

    // Calculate trust score based on utilization (higher = more trusted/normal)
    let trustScore = 100;
    if (exceededLimit) {
      trustScore = 0; // Rate limit exceeded = no trust
    } else if (utilizationRatio > 0.8) {
      trustScore = 30;
    } else if (utilizationRatio > 0.5) {
      trustScore = 60;
    } else if (utilizationRatio > 0.2) {
      trustScore = 80;
    }

    return {
      score: trustScore,
      recentActions,
      threshold,
      exceededLimit
    };
  }

  // ============================================================================
  // Private: Helper Methods
  // ============================================================================

  private static scoreToLevel(score: number): RiskLevel {
    // Higher scores = more trusted
    if (score >= RISK_THRESHOLDS.ALLOW) return 'allow';
    if (score >= RISK_THRESHOLDS.SOFT_CHALLENGE) return 'soft_challenge';
    if (score >= RISK_THRESHOLDS.HARD_CHALLENGE) return 'hard_challenge';
    return 'block';
  }

  private static levelToRecommendation(level: RiskLevel): RiskAssessment['recommendation'] {
    switch (level) {
      case 'allow':
        return 'allow';
      case 'soft_challenge':
        return 'challenge_invisible';
      case 'hard_challenge':
        return 'challenge_visible';
      case 'block':
        return 'block';
    }
  }

  private static collectReasons(factors: RiskFactors): string[] {
    const reasons: string[] = [];

    // Bot detection reasons
    if (factors.botDetection.score > 50) {
      reasons.push(...factors.botDetection.reasons);
    }

    // IP reputation reasons
    if (factors.ipReputation.isProxy) reasons.push('Proxy detected');
    if (factors.ipReputation.isVpn) reasons.push('VPN detected');
    if (factors.ipReputation.isTor) reasons.push('Tor exit node');
    if (factors.ipReputation.isDatacenter) reasons.push('Datacenter IP');

    // Account trust reasons
    if (factors.accountTrust.accountAge < ACCOUNT_AGE_THRESHOLDS.NEW) {
      reasons.push('New account');
    }
    if (!factors.accountTrust.emailVerified) {
      reasons.push('Email not verified');
    }
    if (!factors.accountTrust.hasActivity) {
      reasons.push('No prior activity');
    }
    if (factors.accountTrust.pwaSpoof) {
      reasons.push('PWA claimed but never verified (possible spoofing)');
    }

    // Behavioral reasons
    reasons.push(...factors.behavioral.suspiciousPatterns);

    // Velocity reasons
    if (factors.velocity.exceededLimit) {
      reasons.push('Rate limit exceeded');
    } else if (factors.velocity.score > 50) {
      reasons.push('High action velocity');
    }

    // Content behavior reasons
    if (factors.contentBehavior.suspiciousPatterns.length > 0) {
      reasons.push(...factors.contentBehavior.suspiciousPatterns);
    }

    // Financial trust reasons (only add risk indicators, not trust indicators)
    if (factors.financialTrust.riskIndicators.length > 0) {
      reasons.push(...factors.financialTrust.riskIndicators);
    }

    return reasons;
  }

  private static async getCachedUserData(userId: string): Promise<any> {
    const cached = this.userCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const userRef = doc(db, getCollectionName('users'), userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        this.userCache.set(userId, { data, timestamp: Date.now() });
        return data;
      }
    } catch {
      // Error fetching user data
    }

    return null;
  }

  /**
   * Check PWA installation status for a user
   *
   * Returns whether the user has:
   * - claimed PWA install (pwa_install event)
   * - verified PWA usage (pwa_usage_verified event - actually used in standalone mode)
   *
   * PWA claimed but never verified + no content = likely bot farm spoofing
   */
  private static async checkPWAStatus(userId: string): Promise<{
    hasPWAInstall: boolean;
    hasPWAVerified: boolean;
  }> {
    try {
      const analyticsRef = collection(db, 'analytics_events');

      // Check for pwa_install event
      const installQuery = query(
        analyticsRef,
        where('userId', '==', userId),
        where('eventType', '==', 'pwa_install'),
        limit(1)
      );
      const installSnapshot = await getDocs(installQuery);
      const hasPWAInstall = !installSnapshot.empty;

      // Check for pwa_usage_verified event (actual standalone mode usage)
      const verifiedQuery = query(
        analyticsRef,
        where('userId', '==', userId),
        where('eventType', '==', 'pwa_usage_verified'),
        limit(1)
      );
      const verifiedSnapshot = await getDocs(verifiedQuery);
      const hasPWAVerified = !verifiedSnapshot.empty;

      return { hasPWAInstall, hasPWAVerified };
    } catch {
      // On error, assume no PWA status (don't add penalty)
      return { hasPWAInstall: false, hasPWAVerified: false };
    }
  }

  private static getAccountAgeDays(createdAt: any): number {
    let createdDate: Date;

    if (createdAt?.toDate) {
      createdDate = createdAt.toDate();
    } else if (createdAt?.seconds) {
      createdDate = new Date(createdAt.seconds * 1000);
    } else if (typeof createdAt === 'string') {
      createdDate = new Date(createdAt);
    } else {
      return 0;
    }

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  private static async logRiskEvent(assessment: RiskAssessment): Promise<void> {
    try {
      const eventId = `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const eventRef = doc(db, getCollectionName('riskEvents'), eventId);

      await setDoc(eventRef, {
        ...assessment,
        timestamp: Timestamp.fromDate(assessment.timestamp),
        factors: {
          botDetection: assessment.factors.botDetection,
          ipReputation: assessment.factors.ipReputation,
          accountTrust: assessment.factors.accountTrust,
          behavioral: assessment.factors.behavioral,
          velocity: {
            score: assessment.factors.velocity.score,
            recentActions: assessment.factors.velocity.recentActions,
            exceededLimit: assessment.factors.velocity.exceededLimit
          }
        }
      });
    } catch {
      // Don't throw on logging errors
    }
  }

  // ============================================================================
  // Public: Admin Actions
  // ============================================================================

  /**
   * Clear risk flags for a user (admin action)
   */
  static async clearUserRiskFlags(userId: string, adminId: string): Promise<void> {
    try {
      const userRef = doc(db, getCollectionName('users'), userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      // Log the admin action
      const eventId = `admin_clear_${Date.now()}`;
      const eventRef = doc(db, getCollectionName('riskEvents'), eventId);
      await setDoc(eventRef, {
        action: 'admin_clear_risk',
        userId,
        adminId,
        timestamp: Timestamp.now(),
        score: 0,
        level: 'allow',
        reasons: ['Risk cleared by admin']
      });

      // Clear user cache
      this.userCache.delete(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Flag a user for review (admin action)
   */
  static async flagUserForReview(userId: string, adminId: string, reason: string): Promise<void> {
    try {
      const eventId = `admin_flag_${Date.now()}`;
      const eventRef = doc(db, getCollectionName('riskEvents'), eventId);
      await setDoc(eventRef, {
        action: 'admin_flag_review',
        userId,
        adminId,
        reason,
        timestamp: Timestamp.now(),
        score: 100,
        level: 'block',
        reasons: [`Flagged by admin: ${reason}`]
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get risk history for a user (admin view)
   */
  static async getUserRiskHistory(
    userId: string,
    limitCount: number = 10
  ): Promise<Array<{
    timestamp: Date;
    action: ActionType;
    score: number;
    level: RiskLevel;
    reasons: string[];
  }>> {
    try {
      const eventsRef = collection(db, getCollectionName('riskEvents'));
      const q = query(
        eventsRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
          action: data.action,
          score: data.score,
          level: data.level,
          reasons: data.reasons || []
        };
      });
    } catch {
      return [];
    }
  }
}

// Export singleton instance for convenience
export const riskScoringService = RiskScoringService;
