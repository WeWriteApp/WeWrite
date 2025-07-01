/**
 * Scheduled Reconciliation Service
 * 
 * Handles automated financial reconciliation runs on a schedule
 * and manages reconciliation state and alerting.
 */

import { FinancialReconciliationService, ReconciliationReport, DiscrepancyType } from './financialReconciliationService';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

/**
 * Reconciliation schedule configuration
 */
export interface ReconciliationSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  timezone: string;
  lookbackDays: number;
  alertThresholds: {
    criticalDiscrepancies: number;
    totalAmountThreshold: number;
    discrepancyCountThreshold: number;
  };
}

/**
 * Default reconciliation schedule
 */
export const DEFAULT_RECONCILIATION_SCHEDULE: ReconciliationSchedule = {
  enabled: true,
  frequency: 'daily',
  time: '02:00', // 2 AM
  timezone: 'UTC',
  lookbackDays: 7,
  alertThresholds: {
    criticalDiscrepancies: 1,
    totalAmountThreshold: 100, // $100
    discrepancyCountThreshold: 10
  }
};

/**
 * Reconciliation alert interface
 */
export interface ReconciliationAlert {
  id: string;
  type: 'critical_discrepancy' | 'amount_threshold' | 'count_threshold' | 'system_error';
  severity: 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  reportId: string;
  correlationId: CorrelationId;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  metadata: Record<string, any>;
}

/**
 * Scheduled reconciliation service
 */
export class ScheduledReconciliationService {
  
  /**
   * Run scheduled reconciliation
   */
  static async runScheduledReconciliation(
    schedule: ReconciliationSchedule = DEFAULT_RECONCILIATION_SCHEDULE,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{
    report: ReconciliationReport;
    alerts: ReconciliationAlert[];
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'SCHEDULED_RECONCILIATION';
    
    try {
      FinancialLogger.logOperationStart(operation, corrId, {
        schedule: schedule.frequency,
        lookbackDays: schedule.lookbackDays
      });
      
      // Calculate reconciliation period
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - schedule.lookbackDays);
      
      // Run reconciliation
      const reconciliationResult = await FinancialReconciliationService.runReconciliation(
        startDate,
        endDate,
        corrId
      );
      
      if (!reconciliationResult.success) {
        const systemAlert = this.createSystemErrorAlert(
          reconciliationResult.error!,
          corrId
        );
        
        return FinancialUtils.createErrorResult(
          reconciliationResult.error!,
          operation
        );
      }
      
      const report = reconciliationResult.data!;
      
      // Generate alerts based on thresholds
      const alerts = this.generateAlertsFromReport(report, schedule, corrId);
      
      // Log alerts if any
      if (alerts.length > 0) {
        FinancialLogger.logOperationError(operation, corrId, 
          FinancialUtils.createError(
            FinancialErrorCode.DATA_CORRUPTION,
            `Reconciliation generated ${alerts.length} alerts`,
            corrId,
            false,
            { alertCount: alerts.length, criticalAlerts: alerts.filter(a => a.severity === 'critical').length }
          )
        );
      }
      
      FinancialLogger.logOperationSuccess(operation, corrId, {
        totalDiscrepancies: report.totalDiscrepancies,
        alertsGenerated: alerts.length,
        period: report.period
      });
      
      return FinancialUtils.createSuccessResult(
        { report, alerts },
        corrId,
        operation
      );
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.UNKNOWN_ERROR,
        `Scheduled reconciliation failed: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation }
      );
      
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Generate alerts from reconciliation report based on thresholds
   */
  private static generateAlertsFromReport(
    report: ReconciliationReport,
    schedule: ReconciliationSchedule,
    correlationId: CorrelationId
  ): ReconciliationAlert[] {
    const alerts: ReconciliationAlert[] = [];
    
    // Check for critical discrepancies
    const criticalCount = report.discrepanciesBySeverity.critical || 0;
    if (criticalCount >= schedule.alertThresholds.criticalDiscrepancies) {
      alerts.push({
        id: `critical_disc_${report.id}`,
        type: 'critical_discrepancy',
        severity: 'critical',
        title: 'Critical Financial Discrepancies Detected',
        description: `Found ${criticalCount} critical discrepancies in financial reconciliation`,
        reportId: report.id,
        correlationId,
        triggeredAt: new Date(),
        acknowledged: false,
        metadata: {
          criticalCount,
          threshold: schedule.alertThresholds.criticalDiscrepancies,
          period: report.period
        }
      });
    }
    
    // Check total amount threshold
    if (report.totalAmountDiscrepancy >= schedule.alertThresholds.totalAmountThreshold) {
      alerts.push({
        id: `amount_threshold_${report.id}`,
        type: 'amount_threshold',
        severity: report.totalAmountDiscrepancy >= schedule.alertThresholds.totalAmountThreshold * 5 ? 'critical' : 'error',
        title: 'High Financial Discrepancy Amount',
        description: `Total discrepancy amount ($${report.totalAmountDiscrepancy.toFixed(2)}) exceeds threshold`,
        reportId: report.id,
        correlationId,
        triggeredAt: new Date(),
        acknowledged: false,
        metadata: {
          totalAmount: report.totalAmountDiscrepancy,
          threshold: schedule.alertThresholds.totalAmountThreshold,
          period: report.period
        }
      });
    }
    
    // Check discrepancy count threshold
    if (report.totalDiscrepancies >= schedule.alertThresholds.discrepancyCountThreshold) {
      alerts.push({
        id: `count_threshold_${report.id}`,
        type: 'count_threshold',
        severity: 'warning',
        title: 'High Number of Financial Discrepancies',
        description: `Found ${report.totalDiscrepancies} discrepancies, exceeding threshold of ${schedule.alertThresholds.discrepancyCountThreshold}`,
        reportId: report.id,
        correlationId,
        triggeredAt: new Date(),
        acknowledged: false,
        metadata: {
          discrepancyCount: report.totalDiscrepancies,
          threshold: schedule.alertThresholds.discrepancyCountThreshold,
          period: report.period,
          byType: report.discrepanciesByType
        }
      });
    }
    
    return alerts;
  }
  
  /**
   * Create system error alert
   */
  private static createSystemErrorAlert(
    error: FinancialError,
    correlationId: CorrelationId
  ): ReconciliationAlert {
    return {
      id: `system_error_${correlationId}`,
      type: 'system_error',
      severity: 'critical',
      title: 'Reconciliation System Error',
      description: `Financial reconciliation failed: ${error.message}`,
      reportId: '',
      correlationId,
      triggeredAt: new Date(),
      acknowledged: false,
      metadata: {
        errorCode: error.code,
        errorMessage: error.message,
        retryable: error.retryable
      }
    };
  }
  
  /**
   * Get reconciliation health status
   */
  static async getReconciliationHealth(
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{
    status: 'healthy' | 'warning' | 'critical';
    lastReconciliation?: Date;
    pendingAlerts: number;
    criticalAlerts: number;
    systemStatus: string;
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'RECONCILIATION_HEALTH';
    
    try {
      // This would typically query stored reconciliation data
      // For now, return a healthy status
      const health = {
        status: 'healthy' as const,
        lastReconciliation: new Date(),
        pendingAlerts: 0,
        criticalAlerts: 0,
        systemStatus: 'All reconciliation systems operational'
      };
      
      return FinancialUtils.createSuccessResult(health, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to get reconciliation health: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation }
      );
      
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Acknowledge reconciliation alert
   */
  static async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'ACKNOWLEDGE_ALERT';
    
    try {
      // This would update the alert in the database
      // For now, just log the acknowledgment
      
      FinancialLogger.logOperationSuccess(operation, corrId, {
        alertId,
        acknowledgedBy,
        acknowledgedAt: new Date().toISOString()
      });
      
      return FinancialUtils.createSuccessResult(undefined, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to acknowledge alert: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, alertId }
      );
      
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
}