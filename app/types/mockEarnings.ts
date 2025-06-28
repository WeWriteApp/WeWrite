/**
 * Mock Earnings System Type Definitions
 * 
 * Provides comprehensive type safety for the mock earnings testing system.
 * These types ensure consistency across API endpoints, services, and UI components.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Mock allocation identifiers used to distinguish test data from real data
 */
export const MOCK_IDENTIFIERS = {
  SYSTEM_USER_ID: 'system_mock_allocator',
  USERNAME: 'Mock System',
  RESOURCE_PREFIX: 'mock_page_',
  ALLOCATION_PREFIX: 'mock_allocation_'
} as const;

/**
 * Mock allocation data structure
 * Mirrors real allocation format but uses mock identifiers
 */
export interface MockAllocation {
  id: string; // Format: mock_allocation_${timestamp}
  userId: typeof MOCK_IDENTIFIERS.SYSTEM_USER_ID;
  fromUserId: typeof MOCK_IDENTIFIERS.SYSTEM_USER_ID;
  recipientUserId: string; // Real admin user ID
  tokens: number;
  resourceId: string; // Format: mock_page_${timestamp}
  resourceType: 'page';
  month: string; // YYYY-MM format
  timestamp: Date;
  allocatedAt: Date;
  description: string;
}

/**
 * Mock earnings allocation data stored in database
 */
export interface MockEarningsAllocation {
  allocationId: string;
  fromUserId: typeof MOCK_IDENTIFIERS.SYSTEM_USER_ID;
  fromUsername: typeof MOCK_IDENTIFIERS.USERNAME;
  resourceType: 'page';
  resourceId: string; // Format: mock_page_${timestamp}
  resourceTitle: 'Mock Test Page';
  tokens: number;
  usdValue: number; // tokens * 0.10
}

/**
 * API request body for creating mock earnings
 */
export interface CreateMockEarningsRequest {
  tokenAmount: number;
  month: string; // YYYY-MM format
}

/**
 * API response for successful mock earnings creation
 */
export interface CreateMockEarningsResponse {
  success: true;
  message: string;
  data: {
    targetUserId: string;
    tokenAmount: number;
    month: string;
    earningsId: string; // Format: ${userId}_${month}
    usdValue: number;
  };
}

/**
 * API response for mock earnings reset
 */
export interface ResetMockEarningsResponse {
  success: true;
  message: string;
  data: {
    tokensRemoved: number;
    usdRemoved: number;
    recordsModified: number;
  };
}

/**
 * Test mode status information
 */
export interface TestModeStatus {
  isTestModeActive: boolean;
  activeTests: {
    mockEarnings: boolean;
    inactiveSubscription: boolean;
  };
  details: {
    mockEarningsCount?: number;
    mockTokensAmount?: number;
    mockUsdAmount?: number;
  };
}

/**
 * Mock earnings detection result
 */
export interface MockEarningsDetection {
  hasMockEarnings: boolean;
  count: number;
  totalTokens: number;
  totalUsd: number;
}

/**
 * Admin user verification
 */
export interface AdminVerification {
  isAdmin: boolean;
  userEmail?: string;
  userId?: string;
}

/**
 * Error response format for mock earnings APIs
 */
export interface MockEarningsErrorResponse {
  success: false;
  error: string;
  details?: string;
}

/**
 * Type guard to check if allocation is mock data
 */
export function isMockAllocation(allocation: any): allocation is MockEarningsAllocation {
  return (
    allocation.fromUserId === MOCK_IDENTIFIERS.SYSTEM_USER_ID ||
    allocation.fromUsername === MOCK_IDENTIFIERS.USERNAME ||
    (allocation.resourceId && allocation.resourceId.includes(MOCK_IDENTIFIERS.RESOURCE_PREFIX))
  );
}

/**
 * Type guard to check if user ID is mock system user
 */
export function isMockSystemUser(userId: string): boolean {
  return userId === MOCK_IDENTIFIERS.SYSTEM_USER_ID;
}

/**
 * Utility to generate mock resource ID
 */
export function generateMockResourceId(): string {
  return `${MOCK_IDENTIFIERS.RESOURCE_PREFIX}${Date.now()}`;
}

/**
 * Utility to generate mock allocation ID
 */
export function generateMockAllocationId(): string {
  return `${MOCK_IDENTIFIERS.ALLOCATION_PREFIX}${Date.now()}`;
}

/**
 * Utility to convert tokens to USD (WeWrite rate: $0.10 per token)
 */
export function tokensToUsd(tokens: number): number {
  return tokens * 0.10;
}

/**
 * Utility to format month string (YYYY-MM)
 */
export function formatMonth(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
