/**
 * Fraud Response Service
 * 
 * Automated response system for handling fraud detection results
 * with configurable actions and escalation procedures.
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
  getDocs,
  writeBatch,
  serverTimestamp,
  increment
} from 'firebase/firestore';

import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

import {
  FraudDetectionResult,
  FraudAction,
  FraudSeverity,
  FraudAlert
} from './fraudDetectionEngine';

/**
 * Response action execution result
 */
export interface ResponseActionResult {
  action: FraudAction;
  success: boolean;
  error?: string;
  details: Record<string, any>;
  executedAt: Date;
}

/**
 * Fraud response configuration
 */
export interface FraudResponseConfig {
  enabled: boolean;
  autoExecuteActions: boolean;
  escalationThresholds: {
    alertCount: number;
    timeWindowHours: number;
    riskScoreThreshold: number;
  };
  actionLimits: {
    maxSuspensionsPerHour: number;
    maxRateLimitsPerUser: number;
    cooldownPeriodHours: number;
  };
  notificationSettings: {
    emailAlerts: boolean;
    slackWebhook?: string;
    adminEmails: string[];
  };
}

/**
 * User account restrictions
 */
export interface AccountRestrictions {
  userId: string;
  restrictions: {
    suspended: boolean;
    rateLimited: boolean;
    requiresVerification: boolean;
    paymentBlocked: boolean;
    tokenTransferBlocked: boolean;
  };
  appliedAt: Date;
  expiresAt?: Date;
  reason: string;
  correlationId: CorrelationId;
}

const DEFAULT_RESPONSE_CONFIG: FraudResponseConfig = {
  enabled: true,
  autoExecuteActions: true,
  escalationThresholds: {
    alertCount: 3,
    timeWindowHours: 24,
    riskScoreThreshold: 80
  },
  actionLimits: {
    maxSuspensionsPerHour: 10,
    maxRateLimitsPerUser: 5,
    cooldownPeriodHours: 24
  },
  notificationSettings: {
    emailAlerts: true,
    adminEmails: []
  }
};

export class FraudResponseService {
  private static instance: FraudResponseService;
  private config: FraudResponseConfig;

  private constructor(config: Partial<FraudResponseConfig> = {}) {
    this.config = { ...DEFAULT_RESPONSE_CONFIG, ...config };
  }

  static getInstance(config?: Partial<FraudResponseConfig>): FraudResponseService {
    if (!FraudResponseService.instance) {
      FraudResponseService.instance = new FraudResponseService(config);
    }
    return FraudResponseService.instance;
  }

  /**
   * Execute automated response to fraud detection
   */
  async executeResponse(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<ResponseActionResult[]>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      if (!this.config.enabled || !this.config.autoExecuteActions) {
        return {
          success: true,
          data: [],
          correlationId: corrId
        };
      }

      FinancialLogger.logOperation('FRAUD_RESPONSE_START', {
        correlationId: corrId,
        userId,
        riskScore: fraudResult.riskScore,
        actions: fraudResult.recommendedActions
      });

      const results: ResponseActionResult[] = [];

      // Execute each recommended action
      for (const action of fraudResult.recommendedActions) {
        const actionResult = await this.executeAction(userId, action, fraudResult, corrId);
        results.push(actionResult);

        // Stop execution if critical action fails
        if (!actionResult.success && this.isCriticalAction(action)) {
          break;
        }
      }

      // Check for escalation
      await this.checkEscalation(userId, fraudResult, corrId);

      // Send notifications if configured
      if (this.config.notificationSettings.emailAlerts) {
        await this.sendNotifications(userId, fraudResult, results, corrId);
      }

      FinancialLogger.logOperation('FRAUD_RESPONSE_COMPLETE', {
        correlationId: corrId,
        userId,
        actionsExecuted: results.length,
        successfulActions: results.filter(r => r.success).length
      });

      return {
        success: true,
        data: results,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Fraud response execution failed: ${error.message}`, corrId, true, {  userId, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Execute a specific fraud response action
   */
  private async executeAction(
    userId: string,
    action: FraudAction,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<ResponseActionResult> {
    const result: ResponseActionResult = {
      action,
      success: false,
      details: {},
      executedAt: new Date()
    };

    try {
      switch (action) {
        case FraudAction.LOG_ONLY:
          result.success = await this.executeLogOnly(userId, fraudResult, correlationId);
          break;

        case FraudAction.FLAG_ACCOUNT:
          result.success = await this.executeFlagAccount(userId, fraudResult, correlationId);
          break;

        case FraudAction.REQUIRE_VERIFICATION:
          result.success = await this.executeRequireVerification(userId, fraudResult, correlationId);
          break;

        case FraudAction.RATE_LIMIT:
          result.success = await this.executeRateLimit(userId, fraudResult, correlationId);
          break;

        case FraudAction.BLOCK_TRANSACTION:
          result.success = await this.executeBlockTransaction(userId, fraudResult, correlationId);
          break;

        case FraudAction.SUSPEND_ACCOUNT:
          result.success = await this.executeSuspendAccount(userId, fraudResult, correlationId);
          break;

        case FraudAction.MANUAL_REVIEW:
          result.success = await this.executeManualReview(userId, fraudResult, correlationId);
          break;

        default:
          result.error = `Unknown action: ${action}`;
          break;
      }

      if (result.success) {
        FinancialLogger.logOperation('FRAUD_ACTION_EXECUTED', {
          correlationId,
          userId,
          action,
          riskScore: fraudResult.riskScore
        });
      }

    } catch (error: any) {
      result.error = error.message;
      FinancialLogger.logError(
        FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Fraud action ${action} failed: ${error.message}`, { correlationId, userId, action, originalError: error }, true),
        correlationId
      );
    }

    return result;
  }

  /**
   * Execute log-only action
   */
  private async executeLogOnly(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<boolean> {
    // Already logged by fraud detection engine
    return true;
  }

  /**
   * Execute flag account action
   */
  private async executeFlagAccount(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        fraudFlags: increment(1),
        lastFraudFlagAt: serverTimestamp(),
        fraudFlagReason: `Risk score: ${fraudResult.riskScore}`,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error flagging account:', error);
      return false;
    }
  }

  /**
   * Execute require verification action
   */
  private async executeRequireVerification(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<boolean> {
    try {
      const restrictions: AccountRestrictions = {
        userId,
        restrictions: {
          suspended: false,
          rateLimited: false,
          requiresVerification: true,
          paymentBlocked: false,
          tokenTransferBlocked: false
        },
        appliedAt: new Date(),
        reason: `Fraud detection: Risk score ${fraudResult.riskScore}`,
        correlationId
      };

      await setDoc(doc(db, 'accountRestrictions', userId), {
        ...restrictions,
        appliedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error requiring verification:', error);
      return false;
    }
  }

  /**
   * Execute rate limit action
   */
  private async executeRateLimit(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<boolean> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.config.actionLimits.cooldownPeriodHours);

      const restrictions: AccountRestrictions = {
        userId,
        restrictions: {
          suspended: false,
          rateLimited: true,
          requiresVerification: false,
          paymentBlocked: false,
          tokenTransferBlocked: false
        },
        appliedAt: new Date(),
        expiresAt,
        reason: `Rate limited due to suspicious activity`,
        correlationId
      };

      await setDoc(doc(db, 'accountRestrictions', userId), {
        ...restrictions,
        appliedAt: serverTimestamp(),
        expiresAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error applying rate limit:', error);
      return false;
    }
  }

  /**
   * Execute block transaction action
   */
  private async executeBlockTransaction(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<boolean> {
    try {
      const restrictions: AccountRestrictions = {
        userId,
        restrictions: {
          suspended: false,
          rateLimited: false,
          requiresVerification: false,
          paymentBlocked: true,
          tokenTransferBlocked: true
        },
        appliedAt: new Date(),
        reason: `Transaction blocked due to fraud detection`,
        correlationId
      };

      await setDoc(doc(db, 'accountRestrictions', userId), {
        ...restrictions,
        appliedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error blocking transactions:', error);
      return false;
    }
  }

  /**
   * Execute suspend account action
   */
  private async executeSuspendAccount(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<boolean> {
    try {
      const restrictions: AccountRestrictions = {
        userId,
        restrictions: {
          suspended: true,
          rateLimited: true,
          requiresVerification: true,
          paymentBlocked: true,
          tokenTransferBlocked: true
        },
        appliedAt: new Date(),
        reason: `Account suspended due to high fraud risk (${fraudResult.riskScore})`,
        correlationId
      };

      await setDoc(doc(db, 'accountRestrictions', userId), {
        ...restrictions,
        appliedAt: serverTimestamp()
      });

      // Also update user status
      await updateDoc(doc(db, 'users', userId), {
        status: 'suspended',
        suspendedAt: serverTimestamp(),
        suspensionReason: restrictions.reason,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error suspending account:', error);
      return false;
    }
  }

  /**
   * Execute manual review action
   */
  private async executeManualReview(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<boolean> {
    try {
      const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await setDoc(doc(db, 'manualReviews', reviewId), {
        id: reviewId,
        userId,
        type: 'fraud_detection',
        priority: fraudResult.severity === FraudSeverity.CRITICAL ? 'high' : 'medium',
        status: 'pending',
        riskScore: fraudResult.riskScore,
        triggeredRules: fraudResult.triggeredRules.map(r => r.id),
        metadata: fraudResult.metadata,
        createdAt: serverTimestamp(),
        correlationId
      });

      return true;
    } catch (error) {
      console.error('Error creating manual review:', error);
      return false;
    }
  }

  /**
   * Check if action is critical (failure should stop execution)
   */
  private isCriticalAction(action: FraudAction): boolean {
    return [
      FraudAction.SUSPEND_ACCOUNT,
      FraudAction.BLOCK_TRANSACTION
    ].includes(action);
  }

  /**
   * Check for escalation conditions
   */
  private async checkEscalation(
    userId: string,
    fraudResult: FraudDetectionResult,
    correlationId: CorrelationId
  ): Promise<void> {
    try {
      const thresholds = this.config.escalationThresholds;
      const timeWindow = thresholds.timeWindowHours * 60 * 60 * 1000;
      const cutoffTime = new Date(Date.now() - timeWindow);

      // Get recent alerts for this user
      const alertsQuery = query(
        collection(db, 'fraudAlerts'),
        where('userId', '==', userId),
        where('triggeredAt', '>=', cutoffTime)
      );

      const alertsSnapshot = await getDocs(alertsQuery);
      const recentAlerts = alertsSnapshot.size;

      // Check escalation conditions
      const shouldEscalate =
        recentAlerts >= thresholds.alertCount ||
        fraudResult.riskScore >= thresholds.riskScoreThreshold;

      if (shouldEscalate) {
        await this.escalateToAdmin(userId, fraudResult, recentAlerts, correlationId);
      }

    } catch (error) {
      console.error('Error checking escalation:', error);
    }
  }

  /**
   * Escalate to admin review
   */
  private async escalateToAdmin(
    userId: string,
    fraudResult: FraudDetectionResult,
    alertCount: number,
    correlationId: CorrelationId
  ): Promise<void> {
    try {
      const escalationId = `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await setDoc(doc(db, 'adminEscalations', escalationId), {
        id: escalationId,
        userId,
        type: 'fraud_escalation',
        priority: 'high',
        status: 'pending',
        reason: `High fraud risk: ${alertCount} alerts, risk score ${fraudResult.riskScore}`,
        riskScore: fraudResult.riskScore,
        alertCount,
        triggeredRules: fraudResult.triggeredRules.map(r => r.id),
        metadata: fraudResult.metadata,
        createdAt: serverTimestamp(),
        correlationId
      });

      FinancialLogger.logOperation('FRAUD_ESCALATION_CREATED', {
        correlationId,
        escalationId,
        userId,
        riskScore: fraudResult.riskScore,
        alertCount
      });

    } catch (error) {
      console.error('Error escalating to admin:', error);
    }
  }

  /**
   * Send fraud notifications
   */
  private async sendNotifications(
    userId: string,
    fraudResult: FraudDetectionResult,
    actionResults: ResponseActionResult[],
    correlationId: CorrelationId
  ): Promise<void> {
    try {
      // This would integrate with email/notification service
      // For now, just log the notification
      FinancialLogger.logOperation('FRAUD_NOTIFICATION_SENT', {
        correlationId,
        userId,
        riskScore: fraudResult.riskScore,
        severity: fraudResult.severity,
        actionsExecuted: actionResults.length,
        recipients: this.config.notificationSettings.adminEmails
      });

      // TODO: Implement actual email/Slack notifications

    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  /**
   * Get account restrictions for a user
   */
  async getAccountRestrictions(userId: string): Promise<AccountRestrictions | null> {
    try {
      const restrictionsDoc = await getDoc(doc(db, 'accountRestrictions', userId));

      if (restrictionsDoc.exists()) {
        return restrictionsDoc.data() as AccountRestrictions;
      }

      return null;
    } catch (error) {
      console.error('Error getting account restrictions:', error);
      return null;
    }
  }

  /**
   * Remove account restrictions
   */
  async removeRestrictions(
    userId: string,
    reason: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      // Remove restrictions document
      await updateDoc(doc(db, 'accountRestrictions', userId), {
        restrictions: {
          suspended: false,
          rateLimited: false,
          requiresVerification: false,
          paymentBlocked: false,
          tokenTransferBlocked: false
        },
        removedAt: serverTimestamp(),
        removalReason: reason,
        updatedAt: serverTimestamp()
      });

      // Update user status if suspended
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists() && userDoc.data().status === 'suspended') {
        await updateDoc(doc(db, 'users', userId), {
          status: 'active',
          suspendedAt: null,
          suspensionReason: null,
          updatedAt: serverTimestamp()
        });
      }

      FinancialLogger.logOperation('RESTRICTIONS_REMOVED', {
        correlationId: corrId,
        userId,
        reason
      });

      return {
        success: true,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to remove restrictions: ${error.message}`, corrId, true, {  userId, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Check if user has active restrictions
   */
  async hasActiveRestrictions(userId: string): Promise<boolean> {
    try {
      const restrictions = await this.getAccountRestrictions(userId);

      if (!restrictions) return false;

      // Check if restrictions have expired
      if (restrictions.expiresAt && new Date() > restrictions.expiresAt) {
        return false;
      }

      // Check if any restrictions are active
      const activeRestrictions = Object.values(restrictions.restrictions);
      return activeRestrictions.some(restriction => restriction === true);

    } catch (error) {
      console.error('Error checking active restrictions:', error);
      return false;
    }
  }

  /**
   * Get fraud response configuration
   */
  getConfig(): FraudResponseConfig {
    return { ...this.config };
  }

  /**
   * Update fraud response configuration
   */
  updateConfig(config: Partial<FraudResponseConfig>): void {
    this.config = { ...this.config, ...config };
  }
}