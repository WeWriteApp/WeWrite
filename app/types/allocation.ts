/**
 * Shared TypeScript interfaces for the allocation bar system
 * 
 * This file defines consistent types and interfaces used across all
 * allocation components to improve type safety and maintainability.
 */

// ============================================================================
// Core Data Types
// ============================================================================

export interface UsdBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
  lastUpdated: Date;
}

export interface PageStats {
  sponsorCount: number;
  totalPledgedUsdCents: number;
}

// Re-export Subscription interface from index types
export type { Subscription } from './index';

// ============================================================================
// Component Props Interfaces
// ============================================================================

/**
 * Base props shared by all allocation components
 */
export interface BaseAllocationProps {
  pageId: string;
  authorId: string;
  pageTitle: string;
  className?: string;
  source?: AllocationSource;
}

/**
 * Props for floating allocation bars (AllocationBar, UsdAllocationBar)
 */
export interface FloatingAllocationBarProps extends BaseAllocationProps {
  visible?: boolean;
}

/**
 * Props for embedded allocation bars (cards, search results)
 */
export interface EmbeddedAllocationBarProps extends BaseAllocationProps {
  // No additional props currently needed
}

/**
 * Props for user-to-user allocation bars
 */
export interface UserAllocationBarProps {
  recipientUserId: string;
  username: string;
  visible?: boolean;
  className?: string;
}

/**
 * Props for allocation controls in activity feeds
 */
export interface AllocationControlsProps extends BaseAllocationProps {
  // No additional props currently needed
}

// ============================================================================
// State Management Types
// ============================================================================

/**
 * Allocation state for a specific page
 */
export interface AllocationState {
  currentAllocationCents: number;
  optimisticAllocation?: number | null;
  isLoading: boolean;
  isOptimistic: boolean;
  lastUpdated: Date | null;
}

/**
 * Batching state for API calls
 */
export interface BatchingState {
  pendingChangeCents: number;
  timeoutRef: NodeJS.Timeout | null;
  isProcessing: boolean;
}

/**
 * Composition bar data for visual display
 */
export interface CompositionBarData {
  otherPagesPercentage: number;
  currentPageFundedPercentage: number;
  currentPageOverfundedPercentage: number;
  availablePercentage: number;
  isOutOfFunds: boolean;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useAllocationState hook
 */
export interface UseAllocationStateReturn {
  allocationState: AllocationState;
  refreshAllocation: () => Promise<void>;
  setOptimisticAllocation: (cents: number) => void;
}

/**
 * Return type for useAllocationActions hook
 */
export interface UseAllocationActionsReturn {
  handleAllocationChange: (amount: number, event?: React.MouseEvent) => Promise<void>;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Return type for useCompositionBar hook
 */
export interface UseCompositionBarReturn {
  compositionData: CompositionBarData;
  isOutOfFunds: boolean;
  hasBalance: boolean;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * API request for allocation changes
 */
export interface AllocationRequest {
  pageId: string;
  changeCents: number;
  source?: string;
}

/**
 * API response for allocation operations
 */
export interface AllocationResponse {
  success: boolean;
  currentAllocation: number;
  newBalance?: UsdBalance;
  error?: string;
}

/**
 * API response for page allocation data
 */
export interface PageAllocationResponse {
  currentAllocation: number;
  pageStats?: PageStats;
  error?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Custom event for allocation changes
 */
export interface AllocationChangeEvent extends CustomEvent {
  detail: {
    pageId: string;
    changeCents: number;
    newAllocationCents: number;
    source: string;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Allocation interval options
 */
export interface AllocationIntervalOption {
  label: string;
  cents: number;
}

/**
 * Allocation bar configuration
 */
export interface AllocationBarConfig {
  incrementAmount: number;
  batchDelayMs: number;
  maxRetries: number;
  showParticleEffects: boolean;
  showLoginBanner: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Direction for allocation changes
 */
export type AllocationDirection = 1 | -1;

/**
 * Source of allocation change (for analytics)
 */
export type AllocationSource = 
  | 'FloatingBar'
  | 'EmbeddedCard' 
  | 'ActivityCard'
  | 'UserProfile'
  | 'SearchResult'
  | 'RandomPage'
  | 'HomePage';

/**
 * Allocation bar variant
 */
export type AllocationBarVariant = 
  | 'floating'
  | 'embedded'
  | 'controls'
  | 'user';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Allocation-specific error types
 */
export class AllocationError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AllocationError';
  }
}

/**
 * Common allocation error codes
 */
export const ALLOCATION_ERROR_CODES = {
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type AllocationErrorCode = typeof ALLOCATION_ERROR_CODES[keyof typeof ALLOCATION_ERROR_CODES];
