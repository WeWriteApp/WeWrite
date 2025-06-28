/**
 * Fraud Detection Engine
 * 
 * Real-time fraud detection for suspicious payment patterns, token manipulation,
 * and account abuse with automated response mechanisms.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

/**
 * Fraud detection rule types
 */
export enum FraudRuleType {
  VELOCITY_CHECK = 'velocity_check',
  PATTERN_ANALYSIS = 'pattern_analysis',
  BEHAVIORAL_ANOMALY = 'behavioral_anomaly',
  ACCOUNT_ABUSE = 'account_abuse',
  TOKEN_MANIPULATION = 'token_manipulation',
  PAYMENT_FRAUD = 'payment_fraud',
  GEOGRAPHIC_ANOMALY = 'geographic_anomaly',
  DEVICE_FINGERPRINT = 'device_fingerprint'
}

/**
 * Fraud alert severity levels
 */
export enum FraudSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Automated response actions
 */
export enum FraudAction {
  LOG_ONLY = 'log_only',
  FLAG_ACCOUNT = 'flag_account',
  REQUIRE_VERIFICATION = 'require_verification',
  SUSPEND_ACCOUNT = 'suspend_account',
  BLOCK_TRANSACTION = 'block_transaction',
  RATE_LIMIT = 'rate_limit',
  MANUAL_REVIEW = 'manual_review'
}

/**
 * Fraud detection result
 */
export interface FraudDetectionResult {
  isFraudulent: boolean;
  riskScore: number; // 0-100
  severity: FraudSeverity;
  triggeredRules: FraudRule[];
  recommendedActions: FraudAction[];
  metadata: Record<string, any>;
  correlationId: CorrelationId;
}

/**
 * Fraud detection rule
 */
export interface FraudRule {
  id: string;
  type: FraudRuleType;
  name: string;
  description: string;
  enabled: boolean;
  riskWeight: number; // 0-100
  threshold: number;
  conditions: Record<string, any>;
  actions: FraudAction[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fraud alert record
 */
export interface FraudAlert {
  id: string;
  userId: string;
  ruleId: string;
  severity: FraudSeverity;
  riskScore: number;
  description: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  actions: FraudAction[];
  metadata: Record<string, any>;
  correlationId: CorrelationId;
}

/**
 * User risk profile
 */
export interface UserRiskProfile {
  userId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
  factors: {
    accountAge: number;
    transactionHistory: number;
    behavioralConsistency: number;
    geographicStability: number;
    deviceConsistency: number;
    socialSignals: number;
  };
  flags: string[];
  restrictions: string[];
}

/**
 * Transaction analysis context
 */
export interface TransactionContext {
  userId: string;
  transactionType: string;
  amount: number;
  currency: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
    latitude?: number;
    longitude?: number;
  };
  metadata: Record<string, any>;
}

const DEFAULT_FRAUD_RULES: Omit<FraudRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    type: FraudRuleType.VELOCITY_CHECK,
    name: 'High Transaction Velocity',
    description: 'Detects unusually high transaction frequency',
    enabled: true,
    riskWeight: 80,
    threshold: 10, // transactions per hour
    conditions: {
      timeWindow: 3600, // 1 hour in seconds
      maxTransactions: 10
    },
    actions: [FraudAction.FLAG_ACCOUNT, FraudAction.RATE_LIMIT]
  },
  {
    type: FraudRuleType.PATTERN_ANALYSIS,
    name: 'Suspicious Amount Pattern',
    description: 'Detects suspicious transaction amount patterns',
    enabled: true,
    riskWeight: 70,
    threshold: 5, // number of similar amounts
    conditions: {
      timeWindow: 86400, // 24 hours
      amountVariance: 0.01 // 1% variance
    },
    actions: [FraudAction.FLAG_ACCOUNT, FraudAction.MANUAL_REVIEW]
  },
  {
    type: FraudRuleType.ACCOUNT_ABUSE,
    name: 'Multiple Account Creation',
    description: 'Detects potential multiple account abuse',
    enabled: true,
    riskWeight: 90,
    threshold: 3, // accounts from same IP/device
    conditions: {
      timeWindow: 86400, // 24 hours
      maxAccountsPerIP: 3,
      maxAccountsPerDevice: 2
    },
    actions: [FraudAction.SUSPEND_ACCOUNT, FraudAction.MANUAL_REVIEW]
  },
  {
    type: FraudRuleType.TOKEN_MANIPULATION,
    name: 'Token Balance Anomaly',
    description: 'Detects suspicious token balance changes',
    enabled: true,
    riskWeight: 95,
    threshold: 1000, // tokens
    conditions: {
      unexpectedIncrease: 1000,
      timeWindow: 3600 // 1 hour
    },
    actions: [FraudAction.SUSPEND_ACCOUNT, FraudAction.BLOCK_TRANSACTION]
  },
  {
    type: FraudRuleType.GEOGRAPHIC_ANOMALY,
    name: 'Geographic Inconsistency',
    description: 'Detects impossible geographic travel patterns',
    enabled: true,
    riskWeight: 75,
    threshold: 1000, // km/hour
    conditions: {
      maxTravelSpeed: 1000, // km/hour
      timeWindow: 3600 // 1 hour
    },
    actions: [FraudAction.REQUIRE_VERIFICATION, FraudAction.FLAG_ACCOUNT]
  }
];

export class FraudDetectionEngine {
  private static instance: FraudDetectionEngine;
  private rules: Map<string, FraudRule> = new Map();
  private userProfiles: Map<string, UserRiskProfile> = new Map();

  private constructor() {
    this.initializeDefaultRules();
  }

  static getInstance(): FraudDetectionEngine {
    if (!FraudDetectionEngine.instance) {
      FraudDetectionEngine.instance = new FraudDetectionEngine();
    }
    return FraudDetectionEngine.instance;
  }

  /**
   * Analyze transaction for fraud indicators
   */
  async analyzeTransaction(
    context: TransactionContext,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FraudDetectionResult>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      FinancialLogger.logOperation('FRAUD_ANALYSIS_START', {
        correlationId: corrId,
        userId: context.userId,
        transactionType: context.transactionType,
        amount: context.amount
      });

      // Get user risk profile
      const userProfile = await this.getUserRiskProfile(context.userId, corrId);
      
      // Run all enabled fraud rules
      const triggeredRules: FraudRule[] = [];
      let totalRiskScore = 0;
      let maxSeverity = FraudSeverity.LOW;

      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;

        const ruleResult = await this.evaluateRule(rule, context, userProfile, corrId);
        
        if (ruleResult.triggered) {
          triggeredRules.push(rule);
          totalRiskScore += rule.riskWeight;
          
          // Update max severity
          if (rule.riskWeight >= 90) maxSeverity = FraudSeverity.CRITICAL;
          else if (rule.riskWeight >= 70 && maxSeverity !== FraudSeverity.CRITICAL) maxSeverity = FraudSeverity.HIGH;
          else if (rule.riskWeight >= 50 && maxSeverity === FraudSeverity.LOW) maxSeverity = FraudSeverity.MEDIUM;
        }
      }

      // Calculate final risk score (0-100)
      const riskScore = Math.min(100, totalRiskScore);
      const isFraudulent = riskScore >= 50 || triggeredRules.some(r => r.riskWeight >= 90);

      // Determine recommended actions
      const recommendedActions = this.determineActions(triggeredRules, riskScore);

      const result: FraudDetectionResult = {
        isFraudulent,
        riskScore,
        severity: maxSeverity,
        triggeredRules,
        recommendedActions,
        metadata: {
          userRiskLevel: userProfile?.riskLevel || 'unknown',
          analysisTimestamp: new Date().toISOString(),
          rulesEvaluated: this.rules.size
        },
        correlationId: corrId
      };

      // Create fraud alert if necessary
      if (isFraudulent || riskScore >= 30) {
        await this.createFraudAlert(context, result, corrId);
      }

      // Update user risk profile
      await this.updateUserRiskProfile(context.userId, result, corrId);

      FinancialLogger.logOperation('FRAUD_ANALYSIS_COMPLETE', {
        correlationId: corrId,
        userId: context.userId,
        isFraudulent,
        riskScore,
        triggeredRules: triggeredRules.length
      });

      return {
        success: true,
        data: result,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `Fraud analysis failed: ${error.message}`,
        true,
        { correlationId: corrId, userId: context.userId, originalError: error }
      );

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Evaluate a specific fraud rule against transaction context
   */
  private async evaluateRule(
    rule: FraudRule,
    context: TransactionContext,
    userProfile: UserRiskProfile | null,
    correlationId: CorrelationId
  ): Promise<{ triggered: boolean; details: any }> {
    try {
      switch (rule.type) {
        case FraudRuleType.VELOCITY_CHECK:
          return await this.evaluateVelocityRule(rule, context, correlationId);

        case FraudRuleType.PATTERN_ANALYSIS:
          return await this.evaluatePatternRule(rule, context, correlationId);

        case FraudRuleType.ACCOUNT_ABUSE:
          return await this.evaluateAccountAbuseRule(rule, context, correlationId);

        case FraudRuleType.TOKEN_MANIPULATION:
          return await this.evaluateTokenManipulationRule(rule, context, correlationId);

        case FraudRuleType.GEOGRAPHIC_ANOMALY:
          return await this.evaluateGeographicRule(rule, context, correlationId);

        case FraudRuleType.BEHAVIORAL_ANOMALY:
          return await this.evaluateBehavioralRule(rule, context, userProfile, correlationId);

        default:
          return { triggered: false, details: { reason: 'Unknown rule type' } };
      }
    } catch (error) {
      console.error(`Error evaluating fraud rule ${rule.id}:`, error);
      return { triggered: false, details: { error: error.message } };
    }
  }

  /**
   * Evaluate velocity-based fraud rule
   */
  private async evaluateVelocityRule(
    rule: FraudRule,
    context: TransactionContext,
    correlationId: CorrelationId
  ): Promise<{ triggered: boolean; details: any }> {
    const timeWindow = rule.conditions.timeWindow * 1000; // Convert to milliseconds
    const maxTransactions = rule.conditions.maxTransactions;
    const cutoffTime = new Date(context.timestamp.getTime() - timeWindow);

    // Query recent transactions for this user
    const transactionsQuery = query(
      collection(db, 'financialTransactions'),
      where('fromUserId', '==', context.userId),
      where('createdAt', '>=', cutoffTime),
      orderBy('createdAt', 'desc')
    );

    const transactionsSnapshot = await getDocs(transactionsQuery);
    const recentTransactionCount = transactionsSnapshot.size;

    const triggered = recentTransactionCount >= maxTransactions;

    return {
      triggered,
      details: {
        recentTransactionCount,
        maxAllowed: maxTransactions,
        timeWindowHours: rule.conditions.timeWindow / 3600
      }
    };
  }

  /**
   * Evaluate pattern-based fraud rule
   */
  private async evaluatePatternRule(
    rule: FraudRule,
    context: TransactionContext,
    correlationId: CorrelationId
  ): Promise<{ triggered: boolean; details: any }> {
    const timeWindow = rule.conditions.timeWindow * 1000;
    const amountVariance = rule.conditions.amountVariance;
    const cutoffTime = new Date(context.timestamp.getTime() - timeWindow);

    // Get recent transactions
    const transactionsQuery = query(
      collection(db, 'financialTransactions'),
      where('fromUserId', '==', context.userId),
      where('createdAt', '>=', cutoffTime),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const transactionsSnapshot = await getDocs(transactionsQuery);
    const transactions = transactionsSnapshot.docs.map(doc => doc.data());

    // Look for suspicious amount patterns
    const amounts = transactions.map(t => t.amount);
    const similarAmounts = amounts.filter(amount => {
      const variance = Math.abs(amount - context.amount) / context.amount;
      return variance <= amountVariance;
    });

    const triggered = similarAmounts.length >= rule.threshold;

    return {
      triggered,
      details: {
        similarAmountCount: similarAmounts.length,
        threshold: rule.threshold,
        currentAmount: context.amount,
        variance: amountVariance
      }
    };
  }

  /**
   * Evaluate account abuse rule
   */
  private async evaluateAccountAbuseRule(
    rule: FraudRule,
    context: TransactionContext,
    correlationId: CorrelationId
  ): Promise<{ triggered: boolean; details: any }> {
    if (!context.ipAddress && !context.deviceFingerprint) {
      return { triggered: false, details: { reason: 'No IP or device data available' } };
    }

    const timeWindow = rule.conditions.timeWindow * 1000;
    const cutoffTime = new Date(context.timestamp.getTime() - timeWindow);

    let accountsFromSameSource = 0;
    const details: any = {};

    // Check for multiple accounts from same IP
    if (context.ipAddress) {
      const ipQuery = query(
        collection(db, 'userSessions'),
        where('ipAddress', '==', context.ipAddress),
        where('createdAt', '>=', cutoffTime)
      );

      const ipSnapshot = await getDocs(ipQuery);
      const uniqueUsers = new Set(ipSnapshot.docs.map(doc => doc.data().userId));
      accountsFromSameSource = Math.max(accountsFromSameSource, uniqueUsers.size);
      details.accountsFromIP = uniqueUsers.size;
    }

    // Check for multiple accounts from same device
    if (context.deviceFingerprint) {
      const deviceQuery = query(
        collection(db, 'userSessions'),
        where('deviceFingerprint', '==', context.deviceFingerprint),
        where('createdAt', '>=', cutoffTime)
      );

      const deviceSnapshot = await getDocs(deviceQuery);
      const uniqueUsers = new Set(deviceSnapshot.docs.map(doc => doc.data().userId));
      accountsFromSameSource = Math.max(accountsFromSameSource, uniqueUsers.size);
      details.accountsFromDevice = uniqueUsers.size;
    }

    const triggered = accountsFromSameSource >= rule.threshold;

    return {
      triggered,
      details: {
        ...details,
        maxAccountsDetected: accountsFromSameSource,
        threshold: rule.threshold
      }
    };
  }

  /**
   * Evaluate token manipulation rule
   */
  private async evaluateTokenManipulationRule(
    rule: FraudRule,
    context: TransactionContext,
    correlationId: CorrelationId
  ): Promise<{ triggered: boolean; details: any }> {
    // Get user's token balance history
    const balanceDoc = await getDoc(doc(db, 'writerTokenBalances', context.userId));

    if (!balanceDoc.exists()) {
      return { triggered: false, details: { reason: 'No token balance found' } };
    }

    const balance = balanceDoc.data();
    const timeWindow = rule.conditions.timeWindow * 1000;
    const cutoffTime = new Date(context.timestamp.getTime() - timeWindow);

    // Check for unexpected token increases
    const earningsQuery = query(
      collection(db, 'writerTokenEarnings'),
      where('userId', '==', context.userId),
      where('createdAt', '>=', cutoffTime),
      orderBy('createdAt', 'desc')
    );

    const earningsSnapshot = await getDocs(earningsQuery);
    const recentEarnings = earningsSnapshot.docs.map(doc => doc.data());
    const totalRecentEarnings = recentEarnings.reduce((sum, earning) => sum + (earning.tokensEarned || 0), 0);

    const triggered = totalRecentEarnings >= rule.conditions.unexpectedIncrease;

    return {
      triggered,
      details: {
        recentTokenEarnings: totalRecentEarnings,
        threshold: rule.conditions.unexpectedIncrease,
        currentBalance: balance.availableTokens || 0,
        timeWindowHours: rule.conditions.timeWindow / 3600
      }
    };
  }

  /**
   * Evaluate geographic anomaly rule
   */
  private async evaluateGeographicRule(
    rule: FraudRule,
    context: TransactionContext,
    correlationId: CorrelationId
  ): Promise<{ triggered: boolean; details: any }> {
    if (!context.geolocation) {
      return { triggered: false, details: { reason: 'No geolocation data available' } };
    }

    const timeWindow = rule.conditions.timeWindow * 1000;
    const cutoffTime = new Date(context.timestamp.getTime() - timeWindow);

    // Get recent sessions with geolocation
    const sessionsQuery = query(
      collection(db, 'userSessions'),
      where('userId', '==', context.userId),
      where('createdAt', '>=', cutoffTime),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const sessionsSnapshot = await getDocs(sessionsQuery);
    const sessions = sessionsSnapshot.docs.map(doc => doc.data());

    let maxTravelSpeed = 0;
    let suspiciousTravel = false;

    for (const session of sessions) {
      if (session.geolocation && session.geolocation.latitude && session.geolocation.longitude) {
        const distance = this.calculateDistance(
          context.geolocation.latitude!,
          context.geolocation.longitude!,
          session.geolocation.latitude,
          session.geolocation.longitude
        );

        const timeDiff = (context.timestamp.getTime() - new Date(session.createdAt).getTime()) / 1000 / 3600; // hours
        const speed = distance / Math.max(timeDiff, 0.1); // km/hour

        maxTravelSpeed = Math.max(maxTravelSpeed, speed);

        if (speed > rule.conditions.maxTravelSpeed) {
          suspiciousTravel = true;
        }
      }
    }

    return {
      triggered: suspiciousTravel,
      details: {
        maxTravelSpeed: Math.round(maxTravelSpeed),
        threshold: rule.conditions.maxTravelSpeed,
        currentLocation: `${context.geolocation.city}, ${context.geolocation.country}`,
        sessionsAnalyzed: sessions.length
      }
    };
  }

  /**
   * Evaluate behavioral anomaly rule
   */
  private async evaluateBehavioralRule(
    rule: FraudRule,
    context: TransactionContext,
    userProfile: UserRiskProfile | null,
    correlationId: CorrelationId
  ): Promise<{ triggered: boolean; details: any }> {
    if (!userProfile) {
      return { triggered: false, details: { reason: 'No user profile available' } };
    }

    // Check for behavioral inconsistencies
    const behavioralScore = userProfile.factors.behavioralConsistency;
    const deviceScore = userProfile.factors.deviceConsistency;
    const geoScore = userProfile.factors.geographicStability;

    // Calculate overall behavioral risk
    const behavioralRisk = 100 - ((behavioralScore + deviceScore + geoScore) / 3);
    const triggered = behavioralRisk >= rule.threshold;

    return {
      triggered,
      details: {
        behavioralRisk: Math.round(behavioralRisk),
        threshold: rule.threshold,
        factors: {
          behavioral: behavioralScore,
          device: deviceScore,
          geographic: geoScore
        }
      }
    };
  }

  /**
   * Get or create user risk profile
   */
  private async getUserRiskProfile(
    userId: string,
    correlationId: CorrelationId
  ): Promise<UserRiskProfile | null> {
    try {
      // Check cache first
      if (this.userProfiles.has(userId)) {
        return this.userProfiles.get(userId)!;
      }

      // Get from database
      const profileDoc = await getDoc(doc(db, 'userRiskProfiles', userId));

      if (profileDoc.exists()) {
        const profile = profileDoc.data() as UserRiskProfile;
        this.userProfiles.set(userId, profile);
        return profile;
      }

      // Create new profile
      const newProfile = await this.createUserRiskProfile(userId, correlationId);
      return newProfile;

    } catch (error) {
      console.error('Error getting user risk profile:', error);
      return null;
    }
  }

  /**
   * Create new user risk profile
   */
  private async createUserRiskProfile(
    userId: string,
    correlationId: CorrelationId
  ): Promise<UserRiskProfile> {
    const profile: UserRiskProfile = {
      userId,
      riskScore: 50, // Start with neutral score
      riskLevel: 'medium',
      lastUpdated: new Date(),
      factors: {
        accountAge: 50,
        transactionHistory: 50,
        behavioralConsistency: 50,
        geographicStability: 50,
        deviceConsistency: 50,
        socialSignals: 50
      },
      flags: [],
      restrictions: []
    };

    // Calculate initial factors based on available data
    await this.calculateRiskFactors(profile, correlationId);

    // Store in database
    await setDoc(doc(db, 'userRiskProfiles', userId), {
      ...profile,
      lastUpdated: serverTimestamp()
    });

    // Cache the profile
    this.userProfiles.set(userId, profile);

    return profile;
  }

  /**
   * Calculate risk factors for user profile
   */
  private async calculateRiskFactors(
    profile: UserRiskProfile,
    correlationId: CorrelationId
  ): Promise<void> {
    try {
      // Get user account information
      const userDoc = await getDoc(doc(db, 'users', profile.userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const accountAge = Date.now() - new Date(userData.createdAt).getTime();
        const ageInDays = accountAge / (1000 * 60 * 60 * 24);

        // Account age factor (newer accounts are riskier)
        profile.factors.accountAge = Math.min(100, Math.max(0, (ageInDays / 30) * 20 + 30));
      }

      // Get transaction history
      const transactionsQuery = query(
        collection(db, 'financialTransactions'),
        where('fromUserId', '==', profile.userId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactions = transactionsSnapshot.docs.map(doc => doc.data());

      // Transaction history factor
      const transactionCount = transactions.length;
      profile.factors.transactionHistory = Math.min(100, (transactionCount / 10) * 20 + 20);

      // Behavioral consistency (based on transaction patterns)
      if (transactions.length > 5) {
        const amounts = transactions.map(t => t.amount);
        const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
        const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
        const consistency = Math.max(0, 100 - (variance / avgAmount) * 100);
        profile.factors.behavioralConsistency = Math.min(100, consistency);
      }

      // Update overall risk score
      const factorValues = Object.values(profile.factors);
      const avgScore = factorValues.reduce((sum, score) => sum + score, 0) / factorValues.length;
      profile.riskScore = 100 - avgScore; // Invert so higher score = higher risk

      // Determine risk level
      if (profile.riskScore >= 80) profile.riskLevel = 'critical';
      else if (profile.riskScore >= 60) profile.riskLevel = 'high';
      else if (profile.riskScore >= 40) profile.riskLevel = 'medium';
      else profile.riskLevel = 'low';

    } catch (error) {
      console.error('Error calculating risk factors:', error);
    }
  }

  /**
   * Update user risk profile based on fraud detection result
   */
  private async updateUserRiskProfile(
    userId: string,
    result: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<void> {
    try {
      const profile = await this.getUserRiskProfile(userId, correlationId);
      if (!profile) return;

      // Adjust risk score based on detection result
      if (result.isFraudulent) {
        profile.riskScore = Math.min(100, profile.riskScore + 10);

        // Add flags for triggered rules
        result.triggeredRules.forEach(rule => {
          const flag = `${rule.type}_${Date.now()}`;
          if (!profile.flags.includes(flag)) {
            profile.flags.push(flag);
          }
        });
      } else {
        // Gradually reduce risk score for legitimate activity
        profile.riskScore = Math.max(0, profile.riskScore - 1);
      }

      // Update risk level
      if (profile.riskScore >= 80) profile.riskLevel = 'critical';
      else if (profile.riskScore >= 60) profile.riskLevel = 'high';
      else if (profile.riskScore >= 40) profile.riskLevel = 'medium';
      else profile.riskLevel = 'low';

      profile.lastUpdated = new Date();

      // Update in database
      await updateDoc(doc(db, 'userRiskProfiles', userId), {
        riskScore: profile.riskScore,
        riskLevel: profile.riskLevel,
        flags: profile.flags,
        lastUpdated: serverTimestamp()
      });

      // Update cache
      this.userProfiles.set(userId, profile);

    } catch (error) {
      console.error('Error updating user risk profile:', error);
    }
  }

  /**
   * Create fraud alert
   */
  private async createFraudAlert(
    context: TransactionContext,
    result: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<void> {
    try {
      const alertId = `fraud_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const alert: FraudAlert = {
        id: alertId,
        userId: context.userId,
        ruleId: result.triggeredRules.map(r => r.id).join(','),
        severity: result.severity,
        riskScore: result.riskScore,
        description: this.generateAlertDescription(result.triggeredRules, context),
        triggeredAt: new Date(),
        status: 'open',
        actions: result.recommendedActions,
        metadata: {
          transactionType: context.transactionType,
          amount: context.amount,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          geolocation: context.geolocation,
          triggeredRules: result.triggeredRules.map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            riskWeight: r.riskWeight
          }))
        },
        correlationId
      };

      await setDoc(doc(db, 'fraudAlerts', alertId), {
        ...alert,
        triggeredAt: serverTimestamp()
      });

      FinancialLogger.logOperation('FRAUD_ALERT_CREATED', {
        correlationId,
        alertId,
        userId: context.userId,
        severity: result.severity,
        riskScore: result.riskScore
      });

    } catch (error) {
      console.error('Error creating fraud alert:', error);
    }
  }

  /**
   * Determine recommended actions based on triggered rules and risk score
   */
  private determineActions(triggeredRules: FraudRule[], riskScore: number): FraudAction[] {
    const actions = new Set<FraudAction>();

    // Add actions from triggered rules
    triggeredRules.forEach(rule => {
      rule.actions.forEach(action => actions.add(action));
    });

    // Add risk-based actions
    if (riskScore >= 90) {
      actions.add(FraudAction.SUSPEND_ACCOUNT);
      actions.add(FraudAction.MANUAL_REVIEW);
    } else if (riskScore >= 70) {
      actions.add(FraudAction.REQUIRE_VERIFICATION);
      actions.add(FraudAction.FLAG_ACCOUNT);
    } else if (riskScore >= 50) {
      actions.add(FraudAction.FLAG_ACCOUNT);
      actions.add(FraudAction.RATE_LIMIT);
    } else if (riskScore >= 30) {
      actions.add(FraudAction.LOG_ONLY);
    }

    return Array.from(actions);
  }

  /**
   * Generate human-readable alert description
   */
  private generateAlertDescription(triggeredRules: FraudRule[], context: TransactionContext): string {
    if (triggeredRules.length === 0) {
      return 'Suspicious activity detected';
    }

    const ruleNames = triggeredRules.map(r => r.name);
    const description = `Fraud rules triggered: ${ruleNames.join(', ')}. ` +
      `Transaction: ${context.transactionType} for $${context.amount} by user ${context.userId}.`;

    return description;
  }

  /**
   * Calculate distance between two geographic points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Initialize default fraud rules
   */
  private async initializeDefaultRules(): Promise<void> {
    try {
      for (const ruleData of DEFAULT_FRAUD_RULES) {
        const ruleId = `rule_${ruleData.type}_${Date.now()}`;
        const rule: FraudRule = {
          ...ruleData,
          id: ruleId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        this.rules.set(ruleId, rule);
      }
    } catch (error) {
      console.error('Error initializing default fraud rules:', error);
    }
  }

  /**
   * Add or update fraud rule
   */
  async addRule(rule: Omit<FraudRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ruleId = `rule_${rule.type}_${Date.now()}`;
    const fullRule: FraudRule = {
      ...rule,
      id: ruleId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.rules.set(ruleId, fullRule);

    // Store in database
    await setDoc(doc(db, 'fraudRules', ruleId), {
      ...fullRule,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return ruleId;
  }

  /**
   * Get all fraud rules
   */
  getRules(): FraudRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get fraud alerts for a user
   */
  async getFraudAlerts(
    userId: string,
    status?: 'open' | 'investigating' | 'resolved' | 'false_positive'
  ): Promise<FraudAlert[]> {
    try {
      let alertsQuery = query(
        collection(db, 'fraudAlerts'),
        where('userId', '==', userId),
        orderBy('triggeredAt', 'desc'),
        limit(50)
      );

      if (status) {
        alertsQuery = query(
          collection(db, 'fraudAlerts'),
          where('userId', '==', userId),
          where('status', '==', status),
          orderBy('triggeredAt', 'desc'),
          limit(50)
        );
      }

      const alertsSnapshot = await getDocs(alertsQuery);
      return alertsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FraudAlert));

    } catch (error) {
      console.error('Error getting fraud alerts:', error);
      return [];
    }
  }

  /**
   * Resolve fraud alert
   */
  async resolveAlert(
    alertId: string,
    status: 'resolved' | 'false_positive',
    correlationId?: CorrelationId
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'fraudAlerts', alertId), {
        status,
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('FRAUD_ALERT_RESOLVED', {
        correlationId: correlationId || FinancialUtils.generateCorrelationId(),
        alertId,
        status
      });

    } catch (error) {
      console.error('Error resolving fraud alert:', error);
    }
  }
}
