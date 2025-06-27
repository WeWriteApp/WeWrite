/**
 * Payout Scheduler Service
 * 
 * Handles scheduling and triggering of automated payout processing
 * with configurable schedules and monitoring capabilities.
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
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

import { AutomatedPayoutService } from './automatedPayoutService';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

/**
 * Payout schedule configuration
 */
export interface PayoutScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  hour: number; // 0-23
  minute: number; // 0-59
  timezone: string;
  minimumThreshold: number;
  batchSize: number;
  maxRetries: number;
  notificationEmails: string[];
}

/**
 * Scheduled payout run record
 */
export interface ScheduledPayoutRun {
  id: string;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  totalPayouts: number;
  successfulPayouts: number;
  failedPayouts: number;
  totalAmount: number;
  errors: string[];
  correlationId: CorrelationId;
}

const DEFAULT_SCHEDULE_CONFIG: PayoutScheduleConfig = {
  enabled: true,
  frequency: 'monthly',
  dayOfMonth: 1, // 1st of each month (start-of-month processing)
  hour: 9, // 9 AM
  minute: 0,
  timezone: 'UTC',
  minimumThreshold: 25,
  batchSize: 10,
  maxRetries: 3,
  notificationEmails: []
};

export class PayoutSchedulerService {
  private static instance: PayoutSchedulerService;
  private scheduleConfig: PayoutScheduleConfig;
  private isRunning = false;
  private currentRun?: ScheduledPayoutRun;

  private constructor() {
    this.scheduleConfig = DEFAULT_SCHEDULE_CONFIG;
  }

  static getInstance(): PayoutSchedulerService {
    if (!PayoutSchedulerService.instance) {
      PayoutSchedulerService.instance = new PayoutSchedulerService();
    }
    return PayoutSchedulerService.instance;
  }

  /**
   * Initialize the scheduler with configuration from database
   */
  async initialize(): Promise<FinancialOperationResult<void>> {
    const correlationId = FinancialUtils.generateCorrelationId();

    try {
      const configDoc = await getDoc(doc(db, 'system', 'payoutSchedule'));
      
      if (configDoc.exists()) {
        this.scheduleConfig = {
          ...DEFAULT_SCHEDULE_CONFIG,
          ...configDoc.data()
        };
      } else {
        // Create default configuration
        await setDoc(doc(db, 'system', 'payoutSchedule'), {
          ...DEFAULT_SCHEDULE_CONFIG,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      FinancialLogger.logOperation('SCHEDULER_INITIALIZED', {
        correlationId,
        config: this.scheduleConfig
      });

      return {
        success: true,
        correlationId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.INITIALIZATION_ERROR,
        `Failed to initialize payout scheduler: ${error.message}`,
        true,
        { correlationId, originalError: error }
      );

      FinancialLogger.logError(financialError, correlationId);

      return {
        success: false,
        error: financialError,
        correlationId
      };
    }
  }

  /**
   * Update scheduler configuration
   */
  async updateScheduleConfig(
    config: Partial<PayoutScheduleConfig>,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      this.scheduleConfig = {
        ...this.scheduleConfig,
        ...config
      };

      await updateDoc(doc(db, 'system', 'payoutSchedule'), {
        ...this.scheduleConfig,
        updatedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('SCHEDULER_CONFIG_UPDATED', {
        correlationId: corrId,
        config: this.scheduleConfig
      });

      return {
        success: true,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.CONFIGURATION_ERROR,
        `Failed to update scheduler configuration: ${error.message}`,
        true,
        { correlationId: corrId, originalError: error }
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
   * Check if it's time to run scheduled payouts
   */
  shouldRunScheduledPayouts(): boolean {
    if (!this.scheduleConfig.enabled || this.isRunning) {
      return false;
    }

    const now = new Date();
    const targetTime = this.getNextScheduledTime();

    // Check if we're within 5 minutes of the scheduled time
    const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
    return timeDiff <= 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  /**
   * Get the next scheduled time for payout processing
   */
  getNextScheduledTime(): Date {
    const now = new Date();
    const scheduled = new Date();

    scheduled.setHours(this.scheduleConfig.hour);
    scheduled.setMinutes(this.scheduleConfig.minute);
    scheduled.setSeconds(0);
    scheduled.setMilliseconds(0);

    switch (this.scheduleConfig.frequency) {
      case 'daily':
        if (scheduled <= now) {
          scheduled.setDate(scheduled.getDate() + 1);
        }
        break;

      case 'weekly':
        const targetDayOfWeek = this.scheduleConfig.dayOfWeek || 0;
        const currentDayOfWeek = scheduled.getDay();
        let daysUntilTarget = targetDayOfWeek - currentDayOfWeek;
        
        if (daysUntilTarget <= 0 || (daysUntilTarget === 0 && scheduled <= now)) {
          daysUntilTarget += 7;
        }
        
        scheduled.setDate(scheduled.getDate() + daysUntilTarget);
        break;

      case 'monthly':
        const targetDayOfMonth = this.scheduleConfig.dayOfMonth || 1;
        scheduled.setDate(targetDayOfMonth);
        
        if (scheduled <= now) {
          scheduled.setMonth(scheduled.getMonth() + 1);
          scheduled.setDate(targetDayOfMonth);
        }
        break;
    }

    return scheduled;
  }

  /**
   * Run scheduled payout processing
   */
  async runScheduledPayouts(
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<ScheduledPayoutRun>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    if (this.isRunning) {
      return {
        success: false,
        error: new FinancialError(
          FinancialErrorCode.OPERATION_IN_PROGRESS,
          'Scheduled payout processing already in progress',
          false,
          { correlationId: corrId }
        ),
        correlationId: corrId
      };
    }

    try {
      this.isRunning = true;

      // Create scheduled run record
      const runId = `scheduled_run_${Date.now()}`;
      this.currentRun = {
        id: runId,
        scheduledAt: this.getNextScheduledTime(),
        startedAt: new Date(),
        status: 'running',
        totalPayouts: 0,
        successfulPayouts: 0,
        failedPayouts: 0,
        totalAmount: 0,
        errors: [],
        correlationId: corrId
      };

      // Save run record to database
      await setDoc(doc(db, 'payoutRuns', runId), {
        ...this.currentRun,
        startedAt: serverTimestamp()
      });

      FinancialLogger.logOperation('SCHEDULED_PAYOUT_RUN_START', {
        correlationId: corrId,
        runId,
        config: this.scheduleConfig
      });

      // Get automated payout service instance
      const payoutService = AutomatedPayoutService.getInstance({
        batchSize: this.scheduleConfig.batchSize,
        maxRetries: this.scheduleConfig.maxRetries,
        minimumThreshold: this.scheduleConfig.minimumThreshold
      });

      // Process all pending payouts
      const processingResult = await payoutService.processAllPendingPayouts(corrId);

      // Update run record with results
      this.currentRun.completedAt = new Date();
      this.currentRun.status = processingResult.success ? 'completed' : 'failed';

      if (processingResult.success && processingResult.data) {
        this.currentRun.totalPayouts = processingResult.data.totalProcessed;
        this.currentRun.successfulPayouts = processingResult.data.successful;
        this.currentRun.failedPayouts = processingResult.data.failed;
        this.currentRun.errors = processingResult.data.errors.map(e => e.error);
      } else {
        this.currentRun.errors.push(
          processingResult.error?.message || 'Unknown processing error'
        );
      }

      // Update run record in database
      await updateDoc(doc(db, 'payoutRuns', runId), {
        ...this.currentRun,
        completedAt: serverTimestamp()
      });

      this.isRunning = false;

      FinancialLogger.logOperation('SCHEDULED_PAYOUT_RUN_COMPLETE', {
        correlationId: corrId,
        runId,
        result: this.currentRun
      });

      return {
        success: true,
        data: this.currentRun,
        correlationId: corrId
      };

    } catch (error: any) {
      this.isRunning = false;

      if (this.currentRun) {
        this.currentRun.status = 'failed';
        this.currentRun.completedAt = new Date();
        this.currentRun.errors.push(`Scheduler error: ${error.message}`);

        // Update run record in database
        await updateDoc(doc(db, 'payoutRuns', this.currentRun.id), {
          ...this.currentRun,
          completedAt: serverTimestamp()
        }).catch(() => {
          // Ignore update errors during error handling
        });
      }

      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `Scheduled payout processing failed: ${error.message}`,
        true,
        { correlationId: corrId, originalError: error }
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
   * Get current scheduler status
   */
  getSchedulerStatus() {
    return {
      isRunning: this.isRunning,
      currentRun: this.currentRun,
      config: this.scheduleConfig,
      nextScheduledTime: this.getNextScheduledTime()
    };
  }

  /**
   * Get recent payout runs
   */
  async getRecentRuns(limit = 10): Promise<ScheduledPayoutRun[]> {
    try {
      const runsQuery = query(
        collection(db, 'payoutRuns'),
        where('status', 'in', ['completed', 'failed']),
        limit(limit)
      );

      const runsSnapshot = await getDocs(runsQuery);
      return runsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ScheduledPayoutRun));

    } catch (error) {
      console.error('Error fetching recent payout runs:', error);
      return [];
    }
  }
}
