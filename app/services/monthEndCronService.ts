/**
 * Month-End Cron Service
 * 
 * Automated service to handle month-end processing:
 * 1. Lock current month allocations
 * 2. Calculate earnings
 * 3. Open next month allocation window
 * 4. Schedule payouts
 */

import { monthlyAllocationLockService } from './monthlyAllocationLockService';
import { earningsCalculationEngine } from './earningsCalculationEngine';
import { useItOrLoseItService } from './useItOrLoseItService';
import { platformRevenueService } from './platformRevenueService';
import { formatUsdCents } from '../utils/formatCurrency';

export interface MonthEndProcessingResult {
  month: string;
  success: boolean;
  steps: {
    lockAllocations: { success: boolean; error?: string; duration?: number };
    calculateEarnings: { success: boolean; error?: string; duration?: number };
    openNextMonth: { success: boolean; error?: string; duration?: number };
    schedulePayouts: { success: boolean; error?: string; duration?: number };
  };
  totalDuration: number;
  errors: string[];
  summary: {
    usersProcessed: number;
    totalAllocationsLocked: number;
    totalAmountLocked: number;
    totalEarningsCalculated: number;
    payoutsScheduled: number;
  };
}

export class MonthEndCronService {
  private static instance: MonthEndCronService;

  static getInstance(): MonthEndCronService {
    if (!this.instance) {
      this.instance = new MonthEndCronService();
    }
    return this.instance;
  }

  /**
   * Execute complete month-end processing
   */
  async executeMonthEndProcessing(
    month?: string
  ): Promise<MonthEndProcessingResult> {
    const processStartTime = Date.now();
    const targetMonth = month || this.getCurrentMonth();

    const result: MonthEndProcessingResult = {
      month: targetMonth,
      success: false,
      steps: {
        lockAllocations: { success: false },
        calculateEarnings: { success: false },
        openNextMonth: { success: false },
        schedulePayouts: { success: false }
      },
      totalDuration: 0,
      errors: [],
      summary: {
        usersProcessed: 0,
        totalAllocationsLocked: 0,
        totalAmountLocked: 0,
        totalEarningsCalculated: 0,
        payoutsScheduled: 0
      }
    };

    try {
      // Step 1: Lock current month allocations
      const lockStartTime = Date.now();
      
      const lockResult = await monthlyAllocationLockService.lockMonthlyAllocations(
        targetMonth,
        'automated'
      );

      result.steps.lockAllocations = {
        success: lockResult.success,
        error: lockResult.error,
        duration: Date.now() - lockStartTime
      };

      if (!lockResult.success) {
        result.errors.push(`Allocation lock failed: ${lockResult.error}`);
        throw new Error(`Failed to lock allocations: ${lockResult.error}`);
      }

      // Update summary from lock results
      if (lockResult.lockStatus) {
        result.summary.usersProcessed = lockResult.lockStatus.totalUsers;
        result.summary.totalAllocationsLocked = lockResult.lockStatus.totalAllocations;
        result.summary.totalAmountLocked = lockResult.lockStatus.totalAmountLocked;
      }

      // Step 2: Calculate earnings
      const earningsStartTime = Date.now();

      try {
        const earningsResult = await earningsCalculationEngine.calculateMonthlyEarnings(targetMonth);

        if (earningsResult.success && earningsResult.report) {
          result.steps.calculateEarnings = {
            success: true,
            duration: Date.now() - earningsStartTime
          };

          // Update summary with earnings data
          result.summary.totalEarningsCalculated = earningsResult.report.totalNetEarnings;

          // Process unallocated funds ("use it or lose it")
          await useItOrLoseItService.processUnallocatedFunds(targetMonth);

          // Calculate platform revenue
          await platformRevenueService.calculatePlatformRevenue(targetMonth);
        } else {
          throw new Error(earningsResult.error || 'Earnings calculation failed');
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.steps.calculateEarnings = {
          success: false,
          error: errorMsg,
          duration: Date.now() - earningsStartTime
        };
        result.errors.push(`Earnings calculation failed: ${errorMsg}`);
      }

      // Step 3: Open next month allocation window
      const nextMonthStartTime = Date.now();
      
      try {
        const transition = await monthlyAllocationLockService.openNextMonthAllocation(targetMonth);
        
        result.steps.openNextMonth = {
          success: transition.status === 'completed',
          error: transition.status === 'failed' ? transition.errors.join(', ') : undefined,
          duration: Date.now() - nextMonthStartTime
        };

        if (transition.status !== 'completed') {
          result.errors.push(`Next month opening failed: ${transition.errors.join(', ')}`);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.steps.openNextMonth = {
          success: false,
          error: errorMsg,
          duration: Date.now() - nextMonthStartTime
        };
        result.errors.push(`Next month opening failed: ${errorMsg}`);
      }

      // Step 4: Schedule payouts (placeholder for now)
      const payoutsStartTime = Date.now();
      
      try {
        // This would integrate with the payout processing service
        // For now, we'll simulate the process
        await this.simulatePayoutScheduling(targetMonth);
        
        result.steps.schedulePayouts = {
          success: true,
          duration: Date.now() - payoutsStartTime
        };

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.steps.schedulePayouts = {
          success: false,
          error: errorMsg,
          duration: Date.now() - payoutsStartTime
        };
        result.errors.push(`Payout scheduling failed: ${errorMsg}`);
      }

      // Determine overall success
      result.success = result.steps.lockAllocations.success && 
                      result.steps.calculateEarnings.success &&
                      result.steps.openNextMonth.success &&
                      result.steps.schedulePayouts.success;

      result.totalDuration = Date.now() - processStartTime;

      if (result.success) {
        console.log(`🎉 [MONTH END] Month-end processing completed successfully for ${targetMonth}`, {
          duration: `${result.totalDuration}ms`,
          usersProcessed: result.summary.usersProcessed,
          amountLocked: formatUsdCents(result.summary.totalAmountLocked * 100)
        });
      } else {
        console.error(`❌ [MONTH END] Month-end processing completed with errors for ${targetMonth}`, {
          duration: `${result.totalDuration}ms`,
          errors: result.errors
        });
      }

      return result;

    } catch (error) {
      result.totalDuration = Date.now() - processStartTime;
      result.success = false;
      
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Critical error: ${errorMsg}`);
      
      console.error(`💥 [MONTH END] Critical error in month-end processing for ${targetMonth}:`, error);
      
      return result;
    }
  }

  /**
   * Check if month-end processing should run
   */
  shouldRunMonthEndProcessing(): boolean {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Run on the last day of the month at 23:00 UTC or later
    const isLastDay = now.getDate() === lastDayOfMonth.getDate();
    const isAfter23UTC = now.getUTCHours() >= 23;
    
    return isLastDay && isAfter23UTC;
  }

  /**
   * Get the current month in YYYY-MM format
   */
  getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7);
  }

  /**
   * Get the previous month in YYYY-MM format
   */
  getPreviousMonth(): string {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prevMonth.toISOString().slice(0, 7);
  }

  /**
   * Schedule automatic month-end processing
   */
  scheduleAutomaticProcessing(): void {
    console.log(`⏰ [MONTH END] Scheduling automatic month-end processing`);
    
    // Check every hour if we should run month-end processing
    setInterval(async () => {
      if (this.shouldRunMonthEndProcessing()) {
        console.log(`🗓️ [MONTH END] Triggering automatic month-end processing`);
        
        try {
          const result = await this.executeMonthEndProcessing();
          
          if (result.success) {
            console.log(`✅ [MONTH END] Automatic processing completed successfully`);
          } else {
            console.error(`❌ [MONTH END] Automatic processing failed:`, result.errors);
          }
          
        } catch (error) {
          console.error(`💥 [MONTH END] Error in automatic processing:`, error);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  /**
   * Private helper methods
   */
  private async simulateEarningsCalculation(month: string): Promise<void> {
    // Simulate earnings calculation process
    console.log(`💰 [MONTH END] Simulating earnings calculation for ${month}`);
    
    // This would be replaced with actual earnings calculation logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`💰 [MONTH END] Earnings calculation simulation completed for ${month}`);
  }

  private async simulatePayoutScheduling(month: string): Promise<void> {
    // Simulate payout scheduling process
    console.log(`💸 [MONTH END] Simulating payout scheduling for ${month}`);
    
    // This would be replaced with actual payout scheduling logic
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`💸 [MONTH END] Payout scheduling simulation completed for ${month}`);
  }
}

export const monthEndCronService = MonthEndCronService.getInstance();
