"use client";

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCollectionName } from "../utils/environmentConfig";

/**
 * Test mode status information
 * Provides comprehensive details about active testing modes
 */
export interface TestModeStatus {
  isTestModeActive: boolean;
  activeTests: {
    mockEarnings: boolean;
    inactiveSubscription: boolean;
    // Add other test modes here as they're created
  };
  details: {
    mockEarningsCount?: number;
    mockTokensAmount?: number;
    mockUsdAmount?: number;
  };
}

/**
 * Test Mode Detection Service
 *
 * Monitors the application for active testing modes and provides status information
 * to trigger appropriate UI alerts and warnings. This service helps prevent confusion
 * between test data and real financial data.
 *
 * DETECTION METHODS:
 * - Mock Earnings: Scans database for allocations with mock identifiers
 * - Inactive Subscription: Checks localStorage for test mode flags
 *
 * SECURITY CONSIDERATIONS:
 * - Only detects test modes, does not create or modify test data
 * - Uses Firebase client SDK with user permissions
 * - Provides read-only status information
 */
export class TestModeDetectionService {
  
  /**
   * Detect if any test modes are currently active for a user
   *
   * This is the main entry point for test mode detection. It checks all possible
   * test modes and returns a comprehensive status object.
   *
   * @param userId - The user ID to check for test modes
   * @returns Promise<TestModeStatus> - Comprehensive test mode status including:
   *   - Overall test mode status (active/inactive)
   *   - Individual test mode flags
   *   - Detailed information about active tests
   *
   * @example
   * ```typescript
   * const status = await TestModeDetectionService.detectTestModeStatus(userId);
   * if (status.isTestModeActive) {
   *   console.log('Test mode active:', status.activeTests);
   * }
   * ```
   */
  static async detectTestModeStatus(userId: string): Promise<TestModeStatus> {
    const status: TestModeStatus = {
      isTestModeActive: false,
      activeTests: {
        mockEarnings: false,
        inactiveSubscription: false},
      details: {}
    };

    try {
      // Check for mock earnings
      const mockEarningsStatus = await this.checkMockEarnings(userId);
      status.activeTests.mockEarnings = mockEarningsStatus.hasMockEarnings;
      if (mockEarningsStatus.hasMockEarnings) {
        status.details.mockEarningsCount = mockEarningsStatus.count;
        status.details.mockTokensAmount = mockEarningsStatus.totalTokens;
        status.details.mockUsdAmount = mockEarningsStatus.totalUsd;
      }

      // Check for inactive subscription test mode
      status.activeTests.inactiveSubscription = this.checkInactiveSubscriptionTest();

      // Determine if any test mode is active
      status.isTestModeActive = Object.values(status.activeTests).some(test => test);

      return status;

    } catch (error) {
      console.error('[TestModeDetection] Error detecting test mode:', error);
      return status;
    }
  }

  /**
   * Check for mock earnings in the database
   */
  /**
   * Check for mock earnings in the database
   *
   * Scans writerTokenEarnings collection for allocations with mock identifiers:
   * - fromUserId: 'system_mock_allocator'
   * - fromUsername: 'Mock System'
   * - resourceId: contains 'mock_page_'
   *
   * @param userId - User ID to check for mock earnings
   * @returns Object containing mock earnings status and totals
   */
  private static async checkMockEarnings(userId: string): Promise<{
    hasMockEarnings: boolean;
    count: number;
    totalTokens: number;
    totalUsd: number;
  }> {
    try {
      const earningsQuery = query(
        collection(db, getCollectionName('writerTokenEarnings')),
        where('userId', '==', userId)
      );

      const earningsSnapshot = await getDocs(earningsQuery);

      let mockCount = 0;
      let totalMockTokens = 0;
      let totalMockUsd = 0;

      earningsSnapshot.docs.forEach(doc => {
        const earning = doc.data();
        const allocations = earning.allocations || [];

        allocations.forEach((alloc: any) => {
          // Check if this is a mock allocation using distinct identifiers
          const isMock = alloc.fromUserId === 'system_mock_allocator' ||
                        alloc.fromUsername === 'Mock System' ||
                        (alloc.resourceId && alloc.resourceId.includes('mock_page_'));

          if (isMock) {
            mockCount++;
            totalMockTokens += alloc.tokens || 0;
            totalMockUsd += alloc.usdValue || 0;
          }
        });
      });

      return {
        hasMockEarnings: mockCount > 0,
        count: mockCount,
        totalTokens: totalMockTokens,
        totalUsd: totalMockUsd
      };

    } catch (error) {
      console.error('[TestModeDetection] Error checking mock earnings:', error);
      return {
        hasMockEarnings: false,
        count: 0,
        totalTokens: 0,
        totalUsd: 0
      };
    }
  }

  /**
   * Check if inactive subscription test mode is enabled
   */
  private static checkInactiveSubscriptionTest(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const testingEnabled = localStorage.getItem('admin-inactive-subscription-test');
      return testingEnabled ? JSON.parse(testingEnabled) : false;
    } catch (error) {
      console.error('[TestModeDetection] Error checking inactive subscription test:', error);
      return false;
    }
  }

  /**
   * Exit all test modes and return to normal
   */
  static async exitAllTestModes(userId: string): Promise<{
    success: boolean;
    message: string;
    details: string[];
  }> {
    const details: string[] = [];
    let hasErrors = false;

    try {
      // Reset mock earnings
      try {
        const response = await fetch('/api/admin/reset-mock-earnings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'},
          body: JSON.stringify({})
        });

        const result = await response.json();
        if (result.success) {
          if (result.data.tokensRemoved > 0) {
            details.push(`Removed ${result.data.tokensRemoved} mock tokens ($${result.data.usdRemoved.toFixed(2)})`);
          }
        } else {
          details.push('Failed to reset mock earnings');
          hasErrors = true;
        }
      } catch (error) {
        console.error('[TestModeDetection] Error resetting mock earnings:', error);
        details.push('Error resetting mock earnings');
        hasErrors = true;
      }

      // Reset inactive subscription test
      if (this.checkInactiveSubscriptionTest()) {
        try {
          localStorage.removeItem('admin-inactive-subscription-test');
          details.push('Disabled inactive subscription test mode');
        } catch (error) {
          console.error('[TestModeDetection] Error resetting inactive subscription test:', error);
          details.push('Error resetting inactive subscription test');
          hasErrors = true;
        }
      }

      return {
        success: !hasErrors,
        message: hasErrors 
          ? 'Some test modes could not be reset' 
          : 'All test modes have been reset to normal',
        details
      };

    } catch (error) {
      console.error('[TestModeDetection] Error exiting test modes:', error);
      return {
        success: false,
        message: 'Failed to exit test modes',
        details: ['Unexpected error occurred']
      };
    }
  }
}