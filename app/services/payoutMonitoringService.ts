/**
 * Payout Monitoring Service
 * 
 * Monitors payout processing health, tracks metrics, and generates alerts
 * for failed payouts, processing delays, and system issues.
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
 * Payout monitoring metrics
 */
export interface PayoutMetrics {
  totalPayouts: number;
  successfulPayouts: number;
  failedPayouts: number;
  pendingPayouts: number;
  totalAmount: number;
  averageProcessingTime: number;
  successRate: number;
  failureRate: number;
  retryRate: number;
  lastUpdated: Date;
}

/**
 * Payout alert configuration
 */
export interface PayoutAlertConfig {
  enabled: boolean;
  failureRateThreshold: number; // Percentage
  pendingPayoutThreshold: number; // Count
  processingDelayThreshold: number; // Hours
  totalAmountThreshold: number; // USD
  notificationEmails: string[];
  webhookUrls: string[];
}

/**
 * Payout alert
 */
export interface PayoutAlert {
  id: string;
  type: 'failure_rate' | 'pending_threshold' | 'processing_delay' | 'amount_threshold' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metrics: Partial<PayoutMetrics>;
  createdAt: Date;
  resolvedAt?: Date;
  acknowledged: boolean;
  correlationId: CorrelationId;
}

/**
 * Payout health status
 */
export interface PayoutHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  metrics: PayoutMetrics;
  activeAlerts: PayoutAlert[];
  lastCheckAt: Date;
  systemLoad: {
    processingQueue: number;
    retryQueue: number;
    failedPayouts: number;
  };
}

const DEFAULT_ALERT_CONFIG: PayoutAlertConfig = {
  enabled: true,
  failureRateThreshold: 10, // 10%
  pendingPayoutThreshold: 50,
  processingDelayThreshold: 24, // 24 hours
  totalAmountThreshold: 10000, // $10,000
  notificationEmails: [],
  webhookUrls: []
};

export class PayoutMonitoringService {
  private static instance: PayoutMonitoringService;
  private alertConfig: PayoutAlertConfig;
  private activeAlerts: Map<string, PayoutAlert> = new Map();

  private constructor() {
    this.alertConfig = DEFAULT_ALERT_CONFIG;
  }

  static getInstance(): PayoutMonitoringService {
    if (!PayoutMonitoringService.instance) {
      PayoutMonitoringService.instance = new PayoutMonitoringService();
    }
    return PayoutMonitoringService.instance;
  }

  /**
   * Initialize monitoring service
   */
  async initialize(): Promise<FinancialOperationResult<void>> {
    const correlationId = FinancialUtils.generateCorrelationId();

    try {
      // Load alert configuration
      const configDoc = await getDoc(doc(db, 'system', 'payoutAlerts'));
      
      if (configDoc.exists()) {
        this.alertConfig = {
          ...DEFAULT_ALERT_CONFIG,
          ...configDoc.data()
        };
      } else {
        // Create default configuration
        await setDoc(doc(db, 'system', 'payoutAlerts'), {
          ...DEFAULT_ALERT_CONFIG,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Load active alerts
      await this.loadActiveAlerts(correlationId);

      FinancialLogger.logOperation('MONITORING_INITIALIZED', {
        correlationId,
        config: this.alertConfig,
        activeAlerts: this.activeAlerts.size
      });

      return {
        success: true,
        correlationId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.INITIALIZATION_ERROR, `Failed to initialize payout monitoring: ${error.message}`, { correlationId, originalError: error }, true);

      FinancialLogger.logError(financialError, correlationId);

      return {
        success: false,
        error: financialError,
        correlationId
      };
    }
  }

  /**
   * Calculate current payout metrics
   */
  async calculateMetrics(
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<PayoutMetrics>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get payouts from last 24 hours
      const payoutsQuery = query(
        collection(db, 'payouts'),
        where('createdAt', '>=', last24Hours),
        orderBy('createdAt', 'desc')
      );

      const payoutsSnapshot = await getDocs(payoutsQuery);
      const payouts = payoutsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate metrics
      const totalPayouts = payouts.length;
      const successfulPayouts = payouts.filter(p => p.status === 'completed').length;
      const failedPayouts = payouts.filter(p => p.status === 'failed').length;
      const pendingPayouts = payouts.filter(p => p.status === 'pending').length;
      const totalAmount = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Calculate processing times for completed payouts
      const completedPayouts = payouts.filter(p => 
        p.status === 'completed' && p.createdAt && p.completedAt
      );
      
      const processingTimes = completedPayouts.map(p => {
        const created = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
        const completed = p.completedAt.toDate ? p.completedAt.toDate() : new Date(p.completedAt);
        return completed.getTime() - created.getTime();
      });

      const averageProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      const successRate = totalPayouts > 0 ? (successfulPayouts / totalPayouts) * 100 : 100;
      const failureRate = totalPayouts > 0 ? (failedPayouts / totalPayouts) * 100 : 0;
      const retryRate = payouts.filter(p => (p.retryCount || 0) > 0).length / Math.max(totalPayouts, 1) * 100;

      const metrics: PayoutMetrics = {
        totalPayouts,
        successfulPayouts,
        failedPayouts,
        pendingPayouts,
        totalAmount,
        averageProcessingTime,
        successRate,
        failureRate,
        retryRate,
        lastUpdated: now
      };

      // Store metrics
      await setDoc(doc(db, 'metrics', 'payouts'), {
        ...metrics,
        lastUpdated: serverTimestamp()
      });

      FinancialLogger.logOperation('METRICS_CALCULATED', {
        correlationId: corrId,
        metrics
      });

      return {
        success: true,
        data: metrics,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to calculate payout metrics: ${error.message}`, corrId, true, {  originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Check for alert conditions and generate alerts
   */
  async checkAlertConditions(
    metrics: PayoutMetrics,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<PayoutAlert[]>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const newAlerts: PayoutAlert[] = [];

    try {
      if (!this.alertConfig.enabled) {
        return {
          success: true,
          data: newAlerts,
          correlationId: corrId
        };
      }

      // Check failure rate threshold
      if (metrics.failureRate > this.alertConfig.failureRateThreshold) {
        const alert = await this.createAlert(
          'failure_rate',
          'high',
          'High Payout Failure Rate',
          `Payout failure rate (${metrics.failureRate.toFixed(1)}%) exceeds threshold (${this.alertConfig.failureRateThreshold}%)`,
          metrics,
          corrId
        );
        newAlerts.push(alert);
      }

      // Check pending payout threshold
      if (metrics.pendingPayouts > this.alertConfig.pendingPayoutThreshold) {
        const alert = await this.createAlert(
          'pending_threshold',
          'medium',
          'High Pending Payout Count',
          `Pending payouts (${metrics.pendingPayouts}) exceed threshold (${this.alertConfig.pendingPayoutThreshold})`,
          metrics,
          corrId
        );
        newAlerts.push(alert);
      }

      // Check total amount threshold
      if (metrics.totalAmount > this.alertConfig.totalAmountThreshold) {
        const alert = await this.createAlert(
          'amount_threshold',
          'medium',
          'High Payout Volume',
          `Total payout amount ($${metrics.totalAmount.toFixed(2)}) exceeds threshold ($${this.alertConfig.totalAmountThreshold})`,
          metrics,
          corrId
        );
        newAlerts.push(alert);
      }

      // Check processing delay (if average processing time > threshold)
      const delayThresholdMs = this.alertConfig.processingDelayThreshold * 60 * 60 * 1000;
      if (metrics.averageProcessingTime > delayThresholdMs) {
        const delayHours = (metrics.averageProcessingTime / (60 * 60 * 1000)).toFixed(1);
        const alert = await this.createAlert(
          'processing_delay',
          'high',
          'Slow Payout Processing',
          `Average processing time (${delayHours}h) exceeds threshold (${this.alertConfig.processingDelayThreshold}h)`,
          metrics,
          corrId
        );
        newAlerts.push(alert);
      }

      FinancialLogger.logOperation('ALERT_CONDITIONS_CHECKED', {
        correlationId: corrId,
        newAlerts: newAlerts.length,
        metrics
      });

      return {
        success: true,
        data: newAlerts,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to check alert conditions: ${error.message}`, corrId, true, {  originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Get current health status
   */
  async getHealthStatus(
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<PayoutHealthStatus>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      // Calculate current metrics
      const metricsResult = await this.calculateMetrics(corrId);
      if (!metricsResult.success || !metricsResult.data) {
        throw new Error(`Failed to calculate metrics: ${metricsResult.error?.message}`);
      }

      const metrics = metricsResult.data;

      // Check for alerts
      const alertsResult = await this.checkAlertConditions(metrics, corrId);
      if (!alertsResult.success || !alertsResult.data) {
        throw new Error(`Failed to check alerts: ${alertsResult.error?.message}`);
      }

      const newAlerts = alertsResult.data;

      // Add new alerts to active alerts
      for (const alert of newAlerts) {
        this.activeAlerts.set(alert.id, alert);
      }

      // Determine overall health status
      const criticalAlerts = Array.from(this.activeAlerts.values()).filter(a => a.severity === 'critical');
      const highAlerts = Array.from(this.activeAlerts.values()).filter(a => a.severity === 'high');

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (criticalAlerts.length > 0) {
        status = 'critical';
      } else if (highAlerts.length > 0 || metrics.failureRate > 5) {
        status = 'warning';
      }

      // Get system load information
      const systemLoad = await this.getSystemLoad(corrId);

      const healthStatus: PayoutHealthStatus = {
        status,
        metrics,
        activeAlerts: Array.from(this.activeAlerts.values()),
        lastCheckAt: new Date(),
        systemLoad
      };

      return {
        success: true,
        data: healthStatus,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to get health status: ${error.message}`, corrId, true, {  originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Create a new alert
   */
  private async createAlert(
    type: PayoutAlert['type'],
    severity: PayoutAlert['severity'],
    title: string,
    message: string,
    metrics: Partial<PayoutMetrics>,
    correlationId: CorrelationId
  ): Promise<PayoutAlert> {
    const alertId = `alert_${type}_${Date.now()}`;

    const alert: PayoutAlert = {
      id: alertId,
      type,
      severity,
      title,
      message,
      metrics,
      createdAt: new Date(),
      acknowledged: false,
      correlationId
    };

    // Store alert in database
    await setDoc(doc(db, 'payoutAlerts', alertId), {
      ...alert,
      createdAt: serverTimestamp()
    });

    FinancialLogger.logOperation('ALERT_CREATED', {
      correlationId,
      alert: {
        id: alertId,
        type,
        severity,
        title
      }
    });

    return alert;
  }

  /**
   * Load active alerts from database
   */
  private async loadActiveAlerts(correlationId: CorrelationId): Promise<void> {
    try {
      const alertsQuery = query(
        collection(db, 'payoutAlerts'),
        where('resolvedAt', '==', null),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const alertsSnapshot = await getDocs(alertsQuery);

      this.activeAlerts.clear();
      alertsSnapshot.docs.forEach(doc => {
        const alert = { id: doc.id, ...doc.data() } as PayoutAlert;
        this.activeAlerts.set(alert.id, alert);
      });

    } catch (error) {
      console.error('Error loading active alerts:', error);
    }
  }

  /**
   * Get system load information
   */
  private async getSystemLoad(correlationId: CorrelationId): Promise<{
    processingQueue: number;
    retryQueue: number;
    failedPayouts: number;
  }> {
    try {
      // Get processing queue count
      const processingQuery = query(
        collection(db, 'payouts'),
        where('status', '==', 'processing')
      );
      const processingSnapshot = await getDocs(processingQuery);

      // Get retry queue count (pending with retry count > 0)
      const retryQuery = query(
        collection(db, 'payouts'),
        where('status', '==', 'pending'),
        where('retryCount', '>', 0)
      );
      const retrySnapshot = await getDocs(retryQuery);

      // Get failed payouts count (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedQuery = query(
        collection(db, 'payouts'),
        where('status', '==', 'failed'),
        where('updatedAt', '>=', yesterday)
      );
      const failedSnapshot = await getDocs(failedQuery);

      return {
        processingQueue: processingSnapshot.size,
        retryQueue: retrySnapshot.size,
        failedPayouts: failedSnapshot.size
      };

    } catch (error) {
      console.error('Error getting system load:', error);
      return {
        processingQueue: 0,
        retryQueue: 0,
        failedPayouts: 0
      };
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.NOT_FOUND, `Alert ${alertId} not found`, corrId, false, {  alertId  }),
          correlationId: corrId
        };
      }

      alert.acknowledged = true;
      this.activeAlerts.set(alertId, alert);

      await updateDoc(doc(db, 'payoutAlerts', alertId), {
        acknowledged: true,
        acknowledgedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('ALERT_ACKNOWLEDGED', {
        correlationId: corrId,
        alertId
      });

      return {
        success: true,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to acknowledge alert: ${error.message}`, corrId, true, {  alertId, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.NOT_FOUND, `Alert ${alertId} not found`, corrId, false, {  alertId  }),
          correlationId: corrId
        };
      }

      alert.resolvedAt = new Date();
      this.activeAlerts.delete(alertId);

      await updateDoc(doc(db, 'payoutAlerts', alertId), {
        resolvedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('ALERT_RESOLVED', {
        correlationId: corrId,
        alertId
      });

      return {
        success: true,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to resolve alert: ${error.message}`, corrId, true, {  alertId, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Update alert configuration
   */
  async updateAlertConfig(
    config: Partial<PayoutAlertConfig>,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      this.alertConfig = {
        ...this.alertConfig,
        ...config
      };

      await updateDoc(doc(db, 'system', 'payoutAlerts'), {
        ...this.alertConfig,
        updatedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('ALERT_CONFIG_UPDATED', {
        correlationId: corrId,
        config: this.alertConfig
      });

      return {
        success: true,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.CONFIGURATION_ERROR, `Failed to update alert configuration: ${error.message}`, corrId, true, {  originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Get alert configuration
   */
  getAlertConfig(): PayoutAlertConfig {
    return { ...this.alertConfig };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PayoutAlert[] {
    return Array.from(this.activeAlerts.values());
  }
}
