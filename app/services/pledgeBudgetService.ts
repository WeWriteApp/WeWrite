/**
 * Pledge Budget Validation Service
 * 
 * Handles subscription downgrade and cancellation scenarios by:
 * - Validating pledges against subscription budget
 * - Categorizing pledges as active/suspended based on budget constraints
 * - Implementing prioritization logic (smallest pledges first)
 * - Preserving pledge data during subscription changes
 * - Enabling pledge restoration when subscriptions are upgraded
 */

// Client-side service for pledge budget validation
// Server-side operations are handled via API routes

export interface PledgeItem {
  id: string;
  pageId: string;
  pageTitle: string;
  authorId: string;
  authorUsername: string;
  amount: number;
  status: 'active' | 'suspended' | 'over_budget';
  originalAmount?: number; // Store original amount for restoration
  createdAt: any;
  updatedAt?: any;
  suspendedAt?: any;
  suspensionReason?: string;
}

export interface BudgetValidationResult {
  totalPledges: number;
  subscriptionBudget: number;
  overBudgetAmount: number;
  activePledges: PledgeItem[];
  suspendedPledges: PledgeItem[];
  isOverBudget: boolean;
  canAffordAll: boolean;
}

export interface SubscriptionBudget {
  monthlyAmount: number;
  status: string;
  isActive: boolean;
}

export interface PledgeHistoryEntry {
  id: string;
  userId: string;
  pageId: string;
  pageTitle: string;
  authorId: string;
  authorUsername: string;
  amount: number;
  previousAmount: number;
  action: 'created' | 'increased' | 'decreased' | 'suspended' | 'restored' | 'deleted';
  reason: string;
  subscriptionStatus: string;
  subscriptionAmount: number;
  timestamp: any;
}

/**
 * Get user's current subscription budget via API
 */
export const getUserSubscriptionBudget = async (userId: string): Promise<SubscriptionBudget> => {
  try {
    const response = await fetch('/api/subscription/budget');
    if (!response.ok) {
      throw new Error('Failed to fetch subscription budget');
    }

    const data = await response.json();
    return data.budget || {
      monthlyAmount: 0,
      status: 'none',
      isActive: false
    };
  } catch (error) {
    console.error('Error getting subscription budget:', error);
    return {
      monthlyAmount: 0,
      status: 'error',
      isActive: false
    };
  }
};

/**
 * Get all user pledges with enhanced metadata via API
 */
export const getUserPledges = async (userId: string): Promise<PledgeItem[]> => {
  try {
    const response = await fetch('/api/pledges/list');
    if (!response.ok) {
      throw new Error('Failed to fetch user pledges');
    }

    const data = await response.json();
    return data.pledges || [];
  } catch (error) {
    console.error('Error getting user pledges:', error);
    return [];
  }
};

/**
 * Validate pledges against subscription budget and categorize them via API
 */
export const validatePledgeBudget = async (userId: string): Promise<BudgetValidationResult> => {
  try {
    const response = await fetch('/api/pledges/validate-budget');
    if (!response.ok) {
      throw new Error('Failed to validate pledge budget');
    }

    const data = await response.json();
    return data.validation || {
      totalPledges: 0,
      subscriptionBudget: 0,
      overBudgetAmount: 0,
      activePledges: [],
      suspendedPledges: [],
      isOverBudget: false,
      canAffordAll: false
    };
  } catch (error) {
    console.error('Error validating pledge budget:', error);
    return {
      totalPledges: 0,
      subscriptionBudget: 0,
      overBudgetAmount: 0,
      activePledges: [],
      suspendedPledges: [],
      isOverBudget: false,
      canAffordAll: false
    };
  }
};

/**
 * Update pledge status via API
 */
export const updatePledgeStatus = async (
  userId: string,
  pledgeId: string,
  status: 'active' | 'suspended' | 'over_budget',
  suspensionReason?: string
): Promise<boolean> => {
  try {
    const response = await fetch('/api/pledges/update-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pledgeId,
        status,
        suspensionReason
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error updating pledge status:', error);
    return false;
  }
};

/**
 * Batch update pledge statuses based on budget validation via API
 */
export const applyBudgetValidation = async (
  userId: string,
  validationResult: BudgetValidationResult
): Promise<boolean> => {
  try {
    const response = await fetch('/api/pledges/apply-budget-validation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        validationResult
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error applying budget validation:', error);
    return false;
  }
};

/**
 * Reduce a pledge amount to fit within budget via API
 */
export const reducePledgeAmount = async (
  userId: string,
  pledgeId: string,
  newAmount: number
): Promise<boolean> => {
  try {
    const response = await fetch('/api/pledges/reduce-amount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pledgeId,
        newAmount
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error reducing pledge amount:', error);
    return false;
  }
};

/**
 * Handle subscription status changes via API
 */
export const handleSubscriptionStatusChange = async (
  userId: string,
  oldStatus: string,
  newStatus: string,
  oldAmount: number,
  newAmount: number
): Promise<boolean> => {
  try {
    const response = await fetch('/api/subscription/handle-status-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oldStatus,
        newStatus,
        oldAmount,
        newAmount
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error handling subscription status change:', error);
    return false;
  }
};

/**
 * Record a pledge history entry via API
 */
export const recordPledgeHistory = async (
  userId: string,
  pageId: string,
  pageTitle: string,
  authorId: string,
  authorUsername: string,
  amount: number,
  previousAmount: number,
  action: 'created' | 'increased' | 'decreased' | 'suspended' | 'restored' | 'deleted',
  reason: string,
  subscriptionStatus: string,
  subscriptionAmount: number
): Promise<boolean> => {
  try {
    const response = await fetch('/api/pledges/record-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pageId,
        pageTitle,
        authorId,
        authorUsername,
        amount,
        previousAmount,
        action,
        reason,
        subscriptionStatus,
        subscriptionAmount
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error recording pledge history:', error);
    return false;
  }
};

/**
 * Get pledge history for a user via API
 */
export const getPledgeHistory = async (userId: string, limitCount: number = 50): Promise<PledgeHistoryEntry[]> => {
  try {
    const response = await fetch(`/api/pledges/history?limit=${limitCount}`);
    if (!response.ok) {
      throw new Error('Failed to fetch pledge history');
    }

    const data = await response.json();
    return data.history || [];
  } catch (error) {
    console.error('Error getting pledge history:', error);
    return [];
  }
};

/**
 * Get restoration suggestions based on pledge history via API
 */
export const getRestorationSuggestions = async (userId: string): Promise<PledgeItem[]> => {
  try {
    const response = await fetch('/api/pledges/restoration-suggestions');
    if (!response.ok) {
      throw new Error('Failed to fetch restoration suggestions');
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Error getting restoration suggestions:', error);
    return [];
  }
};

/**
 * Restore pledges from suggestions via API
 */
export const restorePledgesFromSuggestions = async (
  userId: string,
  suggestions: PledgeItem[],
  maxBudget: number
): Promise<{ restored: PledgeItem[], skipped: PledgeItem[] }> => {
  try {
    const response = await fetch('/api/pledges/restore-from-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        suggestions,
        maxBudget
      })
    });

    if (!response.ok) {
      throw new Error('Failed to restore pledges');
    }

    const data = await response.json();
    return data.result || { restored: [], skipped: suggestions };
  } catch (error) {
    console.error('Error restoring pledges from suggestions:', error);
    return { restored: [], skipped: suggestions };
  }
};
