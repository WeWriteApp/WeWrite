/**
 * Risk Scoring Service
 *
 * Central risk assessment engine that combines multiple signals to calculate
 * a risk score (0-100) for actions and users.
 *
 * RISK SCORE THRESHOLDS:
 * - 0-30:  ALLOW     - No challenge required
 * - 31-60: SOFT      - Invisible Turnstile challenge
 * - 61-85: HARD      - Visible Turnstile challenge required
 * - 86-100: BLOCK    - Action blocked, logged for review
 *
 * RISK FACTORS:
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
    score: number;      // 0-100
    confidence: number; // 0-1
    reasons: string[];
    category?: string;
  };
  ipReputation: {
    score: number;      // 0-100
    isProxy: boolean;
    isVpn: boolean;
    isTor: boolean;
    isDatacenter: boolean;
    country?: string;
    threatLevel?: 'none' | 'low' | 'medium' | 'high';
  };
  accountTrust: {
    score: number;      // 0-100 (higher = more trusted = lower risk)
    accountAge: number; // days
    emailVerified: boolean;
    hasActivity: boolean;
    contentCount: number;
    trustLevel: 'new' | 'regular' | 'trusted' | 'verified';
  };
  behavioral: {
    score: number;      // 0-100
    sessionDuration: number; // seconds
    interactions: number;
    suspiciousPatterns: string[];
  };
  velocity: {
    score: number;      // 0-100
    recentActions: number;
    threshold: number;
    exceededLimit: boolean;
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

const RISK_THRESHOLDS = {
  ALLOW: 30,
  SOFT_CHALLENGE: 60,
  HARD_CHALLENGE: 85,
  BLOCK: 100
};

const FACTOR_WEIGHTS = {
  botDetection: 0.30,     // 30% - Bot signals are strong indicators
  ipReputation: 0.15,     // 15% - IP reputation
  accountTrust: 0.25,     // 25% - Account history matters
  behavioral: 0.15,       // 15% - Behavioral patterns
  velocity: 0.15          // 15% - Action velocity
};

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
   * Calculate comprehensive risk score for an action
   */
  static async assessRisk(input: RiskAssessmentInput): Promise<RiskAssessment> {
    const factors: RiskFactors = {
      botDetection: await this.assessBotRisk(input),
      ipReputation: await this.assessIPRisk(input.ip),
      accountTrust: await this.assessAccountTrust(input.userId),
      behavioral: this.assessBehavioralRisk(input.sessionData),
      velocity: await this.assessVelocityRisk(input)
    };

    // Calculate weighted score
    const weightedScore =
      factors.botDetection.score * FACTOR_WEIGHTS.botDetection +
      factors.ipReputation.score * FACTOR_WEIGHTS.ipReputation +
      // Invert account trust score (high trust = low risk)
      (100 - factors.accountTrust.score) * FACTOR_WEIGHTS.accountTrust +
      factors.behavioral.score * FACTOR_WEIGHTS.behavioral +
      factors.velocity.score * FACTOR_WEIGHTS.velocity;

    const score = Math.min(100, Math.max(0, Math.round(weightedScore)));
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
   * Quick risk check without full assessment (for high-volume endpoints)
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

    // If clearly a bot, short-circuit
    if (botResult.isBot && botResult.confidence > 0.8) {
      return {
        score: 90,
        level: 'block',
        shouldChallenge: false // Block instead of challenge
      };
    }

    // Quick account age check
    let accountScore = 50; // Default to medium risk
    if (input.userId) {
      const userData = await this.getCachedUserData(input.userId);
      if (userData?.createdAt) {
        const ageInDays = this.getAccountAgeDays(userData.createdAt);
        accountScore = ageInDays > ACCOUNT_AGE_THRESHOLDS.TRUSTED ? 20 : ageInDays > ACCOUNT_AGE_THRESHOLDS.REGULAR ? 40 : 60;
      }
    }

    const score = Math.round(
      botResult.confidence * 100 * 0.5 + accountScore * 0.5
    );
    const level = this.scoreToLevel(score);

    return {
      score,
      level,
      shouldChallenge: level === 'soft_challenge' || level === 'hard_challenge'
    };
  }

  /**
   * Get risk level for a user (for display in admin)
   */
  static async getUserRiskLevel(userId: string): Promise<{
    score: number;
    level: RiskLevel;
    factors: RiskFactors;
    lastAssessment?: Date;
  }> {
    const factors: RiskFactors = {
      botDetection: { score: 0, confidence: 0, reasons: [] },
      ipReputation: await this.assessIPRisk(undefined), // Will use cached/default
      accountTrust: await this.assessAccountTrust(userId),
      behavioral: { score: 0, suspiciousPatterns: [], sessionDuration: 0, interactions: 0 },
      velocity: await this.assessVelocityRisk({ action: 'create_page', userId })
    };

    // For user-level risk, weight account trust and velocity more heavily
    const weightedScore =
      (100 - factors.accountTrust.score) * 0.50 +
      factors.velocity.score * 0.30 +
      factors.ipReputation.score * 0.20;

    const score = Math.min(100, Math.max(0, Math.round(weightedScore)));

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
      return { score: 30, confidence: 0, reasons: ['No user agent provided'] };
    }

    const result = BotDetectionService.detectBot(input.userAgent, input.fingerprint);

    // Convert confidence (0-1) to risk score (0-100)
    const score = Math.round(result.confidence * 100);

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
        score: 20, // Low default risk
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
          return cached.reputation as RiskFactors['ipReputation'];
        }
      }
    } catch {
      // Cache miss or error, proceed with assessment
    }

    // For now, return default (external IP service integration in Phase 6)
    // This will be enhanced with IPQualityScore or AbuseIPDB
    const reputation: RiskFactors['ipReputation'] = {
      score: 20,
      isProxy: false,
      isVpn: false,
      isTor: false,
      isDatacenter: false,
      threatLevel: 'none'
    };

    // Detect common datacenter/proxy ranges (basic check)
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
      reputation.score = 40;
      reputation.isDatacenter = true;
    }

    return reputation;
  }

  private static async assessAccountTrust(userId?: string): Promise<RiskFactors['accountTrust']> {
    // No user = high risk
    if (!userId) {
      return {
        score: 20, // Low trust score = high risk
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
        score: 20,
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

    return {
      score: Math.min(100, score),
      accountAge,
      emailVerified,
      hasActivity,
      contentCount,
      trustLevel
    };
  }

  private static assessBehavioralRisk(sessionData?: RiskAssessmentInput['sessionData']): RiskFactors['behavioral'] {
    if (!sessionData) {
      return {
        score: 30, // Medium-low risk when no session data
        sessionDuration: 0,
        interactions: 0,
        suspiciousPatterns: []
      };
    }

    const suspiciousPatterns: string[] = [];
    let score = 0;

    // Very short session with high activity = suspicious
    if (sessionData.duration < 5 && sessionData.pageViews > 10) {
      suspiciousPatterns.push('Rapid page navigation');
      score += 40;
    }

    // No interactions after significant session time = suspicious
    if (sessionData.duration > 30 && sessionData.interactions === 0) {
      suspiciousPatterns.push('No user interactions detected');
      score += 30;
    }

    // Extremely high page views = suspicious
    if (sessionData.pageViews > 100 && sessionData.duration < 300) {
      suspiciousPatterns.push('Excessive page views');
      score += 50;
    }

    // Perfect behavior (possible automation)
    if (sessionData.interactions > 0 && sessionData.interactions === sessionData.pageViews) {
      suspiciousPatterns.push('Uniform interaction pattern');
      score += 20;
    }

    return {
      score: Math.min(100, score),
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
          score: 30,
          recentActions: 0,
          threshold,
          exceededLimit: false
        };
      }

      const snapshot = await getDocs(q);
      recentActions = snapshot.size;
    } catch {
      // If we can't check velocity, assume low risk
      return {
        score: 20,
        recentActions: 0,
        threshold,
        exceededLimit: false
      };
    }

    const exceededLimit = recentActions >= threshold;
    const utilizationRatio = recentActions / threshold;

    // Calculate score based on utilization
    let score = 0;
    if (exceededLimit) {
      score = 100;
    } else if (utilizationRatio > 0.8) {
      score = 70;
    } else if (utilizationRatio > 0.5) {
      score = 40;
    } else if (utilizationRatio > 0.2) {
      score = 20;
    }

    return {
      score,
      recentActions,
      threshold,
      exceededLimit
    };
  }

  // ============================================================================
  // Private: Helper Methods
  // ============================================================================

  private static scoreToLevel(score: number): RiskLevel {
    if (score <= RISK_THRESHOLDS.ALLOW) return 'allow';
    if (score <= RISK_THRESHOLDS.SOFT_CHALLENGE) return 'soft_challenge';
    if (score <= RISK_THRESHOLDS.HARD_CHALLENGE) return 'hard_challenge';
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

    // Behavioral reasons
    reasons.push(...factors.behavioral.suspiciousPatterns);

    // Velocity reasons
    if (factors.velocity.exceededLimit) {
      reasons.push('Rate limit exceeded');
    } else if (factors.velocity.score > 50) {
      reasons.push('High action velocity');
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
