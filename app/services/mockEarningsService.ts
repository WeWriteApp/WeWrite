/**
 * Mock Earnings Service
 * 
 * Centralized service for managing mock earnings functionality.
 * This service provides a clean interface for creating, detecting, and managing
 * mock earnings data for testing purposes.
 * 
 * FEATURES:
 * - Type-safe mock earnings operations
 * - Consistent error handling
 * - Centralized business logic
 * - Integration with existing APIs
 * 
 * SECURITY:
 * - Admin-only operations
 * - Safe mock data identification
 * - Comprehensive cleanup functionality
 */

import { 
  MOCK_IDENTIFIERS,
  CreateMockEarningsRequest,
  CreateMockEarningsResponse,
  ResetMockEarningsResponse,
  MockEarningsErrorResponse,
  TestModeStatus,
  tokensToUsd,
  formatMonth,
  isMockAllocation
} from '../types/mockEarnings';

export class MockEarningsService {
  
  /**
   * Create mock earnings for testing
   * 
   * @param request - Mock earnings creation parameters
   * @returns Promise with creation result
   */
  static async createMockEarnings(
    request: CreateMockEarningsRequest
  ): Promise<CreateMockEarningsResponse | MockEarningsErrorResponse> {
    try {
      const response = await fetch('/api/admin/mock-token-earnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to create mock earnings'
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Reset/remove all mock earnings
   * 
   * @returns Promise with reset result
   */
  static async resetMockEarnings(): Promise<ResetMockEarningsResponse | MockEarningsErrorResponse> {
    try {
      const response = await fetch('/api/admin/reset-mock-earnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to reset mock earnings'
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Get current test mode status
   * 
   * @param userId - User ID to check
   * @returns Promise with test mode status
   */
  static async getTestModeStatus(userId: string): Promise<TestModeStatus> {
    const { TestModeDetectionService } = await import('./testModeDetectionService');
    return TestModeDetectionService.detectTestModeStatus(userId);
  }

  /**
   * Validate mock earnings request
   * 
   * @param request - Request to validate
   * @returns Validation result
   */
  static validateCreateRequest(request: CreateMockEarningsRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.tokenAmount || request.tokenAmount <= 0) {
      errors.push('Token amount must be greater than 0');
    }

    if (request.tokenAmount > 10000) {
      errors.push('Token amount cannot exceed 10,000 for testing');
    }

    if (!request.month) {
      errors.push('Month is required');
    } else if (!/^\d{4}-\d{2}$/.test(request.month)) {
      errors.push('Month must be in YYYY-MM format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate mock earnings request for current month
   * 
   * @param tokenAmount - Number of tokens to allocate
   * @returns Mock earnings request object
   */
  static createRequestForCurrentMonth(tokenAmount: number): CreateMockEarningsRequest {
    return {
      tokenAmount,
      month: formatMonth()
    };
  }

  /**
   * Calculate USD value for token amount
   * 
   * @param tokens - Number of tokens
   * @returns USD value
   */
  static calculateUsdValue(tokens: number): number {
    return tokensToUsd(tokens);
  }

  /**
   * Check if allocation data is from mock system
   * 
   * @param allocation - Allocation data to check
   * @returns True if allocation is mock data
   */
  static isMockAllocation(allocation: any): boolean {
    return isMockAllocation(allocation);
  }

  /**
   * Get mock system identifiers
   * 
   * @returns Object containing all mock identifiers
   */
  static getMockIdentifiers() {
    return MOCK_IDENTIFIERS;
  }

  /**
   * Format mock earnings summary for display
   * 
   * @param status - Test mode status
   * @returns Formatted summary string
   */
  static formatMockEarningsSummary(status: TestModeStatus): string {
    if (!status.activeTests.mockEarnings) {
      return 'No mock earnings active';
    }

    const { mockEarningsCount, mockTokensAmount, mockUsdAmount } = status.details;
    
    return `${mockEarningsCount} mock allocation${mockEarningsCount !== 1 ? 's' : ''}, ` +
           `${mockTokensAmount} tokens ($${mockUsdAmount?.toFixed(2)})`;
  }

  /**
   * Create multiple mock earnings for testing
   * 
   * @param amounts - Array of token amounts to create
   * @param startMonth - Starting month (defaults to current)
   * @returns Promise with creation results
   */
  static async createMultipleMockEarnings(
    amounts: number[],
    startMonth?: string
  ): Promise<(CreateMockEarningsResponse | MockEarningsErrorResponse)[]> {
    const baseMonth = startMonth || formatMonth();
    const results: (CreateMockEarningsResponse | MockEarningsErrorResponse)[] = [];

    for (let i = 0; i < amounts.length; i++) {
      const date = new Date(baseMonth + '-01');
      date.setMonth(date.getMonth() - i);
      const month = formatMonth(date);

      const result = await this.createMockEarnings({
        tokenAmount: amounts[i],
        month
      });

      results.push(result);

      // Add small delay to prevent rate limiting
      if (i < amounts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Validate that user has admin privileges
   * 
   * @param userEmail - User email to check
   * @returns True if user is admin
   */
  static isAdminUser(userEmail?: string | null): boolean {
    if (!userEmail) return false;
    
    const adminEmails = [
      'jamiegray2234@gmail.com',
      'patrick@mailfischer.com',
      'skyler99ireland@gmail.com',
      'diamatryistmatov@gmail.com',
      'josiahsparrow@gmail.com'
    ];
    
    return adminEmails.includes(userEmail);
  }
}
