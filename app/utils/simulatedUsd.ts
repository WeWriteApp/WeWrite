/**
 * Simulated USD Allocation Utilities
 * 
 * Manages simulated USD allocations for logged-out users and logged-in users
 * without active subscriptions. Uses localStorage for persistence.
 * Replaces the token-based simulation system with direct USD amounts.
 */

import { formatUsdCents, dollarsToCents, centsToDollars } from './formatCurrency';

export interface SimulatedUsdAllocation {
  pageId: string;
  pageTitle: string;
  usdCents: number;
  timestamp: number;
}

export interface SimulatedUsdBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
  allocations: SimulatedUsdAllocation[];
  lastUpdated: number;
}

// Constants
const SIMULATED_MONTHLY_USD_CENTS = 1000; // Equivalent to $10/month
const STORAGE_KEY_PREFIX = 'wewrite_simulated_usd';
const LOGGED_OUT_STORAGE_KEY = `${STORAGE_KEY_PREFIX}_logged_out`;
const DEMO_BALANCE_VERSION = 4; // Force reset to show $2 in OTHER section for landing page

// Default "other pages" allocations for the landing page demo ($2 total)
const DEFAULT_OTHER_ALLOCATIONS: SimulatedUsdAllocation[] = [
  { pageId: 'demo-climate-solutions', pageTitle: 'Climate Change Solutions', usdCents: 75, timestamp: Date.now() },
  { pageId: 'demo-community-garden', pageTitle: 'Local Community Garden', usdCents: 50, timestamp: Date.now() },
  { pageId: 'demo-music-theory', pageTitle: 'Music Theory Basics', usdCents: 75, timestamp: Date.now() },
];
const DEFAULT_OTHER_ALLOCATED_CENTS = 200; // $2.00 total

/**
 * Get storage key for a specific user (logged-in users without subscription)
 */
const getUserStorageKey = (userId: string): string => {
  return `${STORAGE_KEY_PREFIX}_user_${userId}`;
};

/**
 * Save USD balance to localStorage
 */
const saveUsdBalance = (storageKey: string, balance: SimulatedUsdBalance): void => {
  try {
    const dataToStore = {
      version: DEMO_BALANCE_VERSION,
      allocatedUsdCents: balance.allocatedUsdCents,
      allocations: balance.allocations,
      lastUpdated: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(dataToStore));
  } catch (error) {
    console.warn('Error saving USD balance:', error);
  }
};

/**
 * Get simulated USD balance for logged-out users
 */
export const getLoggedOutUsdBalance = (): SimulatedUsdBalance => {
  try {
    // Check if we're on the server side
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return {
        totalUsdCents: 0,
        allocatedUsdCents: 0,
        availableUsdCents: 0,
        allocations: [],
        lastUpdated: Date.now()
      };
    }

    const stored = localStorage.getItem(LOGGED_OUT_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);

      // Check if we need to reset due to version change (to add mock allocations)
      if (data.version !== DEMO_BALANCE_VERSION) {
        localStorage.removeItem(LOGGED_OUT_STORAGE_KEY);
        // Fall through to return default balance with mock allocations
      } else {
        return {
          totalUsdCents: SIMULATED_MONTHLY_USD_CENTS,
          allocatedUsdCents: data.allocatedUsdCents || 0,
          availableUsdCents: SIMULATED_MONTHLY_USD_CENTS - (data.allocatedUsdCents || 0),
          allocations: data.allocations || [],
          lastUpdated: data.lastUpdated || Date.now()
        };
      }
    }
  } catch (error) {
    console.warn('Error reading logged-out USD balance:', error);
  }

  // Return default balance with pre-set "other pages" allocations ($2 total)
  // This gives users something to see in the "Other Pages" section on the landing page
  const defaultBalance: SimulatedUsdBalance = {
    totalUsdCents: SIMULATED_MONTHLY_USD_CENTS,
    allocatedUsdCents: DEFAULT_OTHER_ALLOCATED_CENTS,
    availableUsdCents: SIMULATED_MONTHLY_USD_CENTS - DEFAULT_OTHER_ALLOCATED_CENTS,
    allocations: [...DEFAULT_OTHER_ALLOCATIONS],
    lastUpdated: Date.now()
  };

  // Save the default balance so it persists
  saveUsdBalance(LOGGED_OUT_STORAGE_KEY, defaultBalance);

  return defaultBalance;
};

/**
 * Get simulated USD balance for a logged-in user without subscription
 */
export const getUserUsdBalance = (userId: string): SimulatedUsdBalance => {
  try {
    const stored = localStorage.getItem(getUserStorageKey(userId));
    if (stored) {
      const data = JSON.parse(stored);

      // Check if we need to reset due to version change (to add mock allocations)
      if (data.version !== DEMO_BALANCE_VERSION) {
        localStorage.removeItem(getUserStorageKey(userId));
        // Fall through to return default balance with mock allocations
      } else {
        return {
          totalUsdCents: SIMULATED_MONTHLY_USD_CENTS,
          allocatedUsdCents: data.allocatedUsdCents || 0,
          availableUsdCents: SIMULATED_MONTHLY_USD_CENTS - (data.allocatedUsdCents || 0),
          allocations: data.allocations || [],
          lastUpdated: data.lastUpdated || Date.now()
        };
      }
    }
  } catch (error) {
    console.warn('Error reading user USD balance:', error);
  }

  // Return default balance with pre-set "other pages" allocations ($2 total)
  const defaultBalance: SimulatedUsdBalance = {
    totalUsdCents: SIMULATED_MONTHLY_USD_CENTS,
    allocatedUsdCents: DEFAULT_OTHER_ALLOCATED_CENTS,
    availableUsdCents: SIMULATED_MONTHLY_USD_CENTS - DEFAULT_OTHER_ALLOCATED_CENTS,
    allocations: [...DEFAULT_OTHER_ALLOCATIONS],
    lastUpdated: Date.now()
  };

  // Save the default balance so it persists
  saveUsdBalance(getUserStorageKey(userId), defaultBalance);

  return defaultBalance;
};

/**
 * Allocate USD to a page for logged-out users
 */
export const allocateLoggedOutUsd = (
  pageId: string,
  pageTitle: string,
  usdCents: number
): { success: boolean; balance: SimulatedUsdBalance; error?: string } => {
  const currentBalance = getLoggedOutUsdBalance();
  
  // Find existing allocation for this page
  const existingAllocationIndex = currentBalance.allocations.findIndex(a => a.pageId === pageId);
  const existingUsdCents = existingAllocationIndex >= 0 ? currentBalance.allocations[existingAllocationIndex].usdCents : 0;
  
  // Calculate new total allocated USD cents
  const newAllocatedUsdCents = currentBalance.allocatedUsdCents - existingUsdCents + usdCents;
  
  // Check if we have enough USD
  if (newAllocatedUsdCents > SIMULATED_MONTHLY_USD_CENTS) {
    return {
      success: false,
      balance: currentBalance,
      error: `Insufficient funds available. You have ${formatUsdCents(currentBalance.availableUsdCents)} remaining.`
    };
  }

  // Update allocations
  const newAllocations = [...currentBalance.allocations];
  
  if (usdCents === 0) {
    // Remove allocation
    if (existingAllocationIndex >= 0) {
      newAllocations.splice(existingAllocationIndex, 1);
    }
  } else {
    // Add or update allocation
    const allocation: SimulatedUsdAllocation = {
      pageId,
      pageTitle,
      usdCents,
      timestamp: Date.now()
    };
    
    if (existingAllocationIndex >= 0) {
      newAllocations[existingAllocationIndex] = allocation;
    } else {
      newAllocations.push(allocation);
    }
  }

  // Create updated balance
  const updatedBalance: SimulatedUsdBalance = {
    totalUsdCents: SIMULATED_MONTHLY_USD_CENTS,
    allocatedUsdCents: newAllocatedUsdCents,
    availableUsdCents: SIMULATED_MONTHLY_USD_CENTS - newAllocatedUsdCents,
    allocations: newAllocations,
    lastUpdated: Date.now()
  };

  // Save to localStorage
  saveUsdBalance(LOGGED_OUT_STORAGE_KEY, updatedBalance);

  return {
    success: true,
    balance: updatedBalance
  };
};

/**
 * Allocate USD to a page for logged-in users without subscription
 */
export const allocateUserUsd = (
  userId: string,
  pageId: string,
  pageTitle: string,
  usdCents: number
): { success: boolean; balance: SimulatedUsdBalance; error?: string } => {
  const currentBalance = getUserUsdBalance(userId);
  
  // Find existing allocation for this page
  const existingAllocationIndex = currentBalance.allocations.findIndex(a => a.pageId === pageId);
  const existingUsdCents = existingAllocationIndex >= 0 ? currentBalance.allocations[existingAllocationIndex].usdCents : 0;
  
  // Calculate new total allocated USD cents
  const newAllocatedUsdCents = currentBalance.allocatedUsdCents - existingUsdCents + usdCents;
  
  // Check if we have enough USD
  if (newAllocatedUsdCents > SIMULATED_MONTHLY_USD_CENTS) {
    return {
      success: false,
      balance: currentBalance,
      error: `Insufficient funds available. You have ${formatUsdCents(currentBalance.availableUsdCents)} remaining.`
    };
  }

  // Update allocations
  const newAllocations = [...currentBalance.allocations];
  
  if (usdCents === 0) {
    // Remove allocation
    if (existingAllocationIndex >= 0) {
      newAllocations.splice(existingAllocationIndex, 1);
    }
  } else {
    // Add or update allocation
    const allocation: SimulatedUsdAllocation = {
      pageId,
      pageTitle,
      usdCents,
      timestamp: Date.now()
    };
    
    if (existingAllocationIndex >= 0) {
      newAllocations[existingAllocationIndex] = allocation;
    } else {
      newAllocations.push(allocation);
    }
  }

  // Create updated balance
  const updatedBalance: SimulatedUsdBalance = {
    totalUsdCents: SIMULATED_MONTHLY_USD_CENTS,
    allocatedUsdCents: newAllocatedUsdCents,
    availableUsdCents: SIMULATED_MONTHLY_USD_CENTS - newAllocatedUsdCents,
    allocations: newAllocations,
    lastUpdated: Date.now()
  };

  // Save to localStorage
  saveUsdBalance(getUserStorageKey(userId), updatedBalance);

  return {
    success: true,
    balance: updatedBalance
  };
};

/**
 * Get current page allocation for logged-out users
 */
export const getLoggedOutPageAllocation = (pageId: string): number => {
  const balance = getLoggedOutUsdBalance();
  const allocation = balance.allocations.find(a => a.pageId === pageId);
  return allocation ? allocation.usdCents : 0;
};

/**
 * Get current page allocation for logged-in users without subscription
 */
export const getUserPageAllocation = (userId: string, pageId: string): number => {
  const balance = getUserUsdBalance(userId);
  const allocation = balance.allocations.find(a => a.pageId === pageId);
  return allocation ? allocation.usdCents : 0;
};

/**
 * Clear all simulated USD data for logged-out users
 */
export const clearLoggedOutUsd = (): void => {
  try {
    localStorage.removeItem(LOGGED_OUT_STORAGE_KEY);
  } catch (error) {
    console.warn('Error clearing logged-out USD data:', error);
  }
};

/**
 * Clear all simulated USD data for a specific user
 */
export const clearUserUsd = (userId: string): void => {
  try {
    localStorage.removeItem(getUserStorageKey(userId));
  } catch (error) {
    console.warn('Error clearing user USD data:', error);
  }
};

/**
 * Transfer logged-out simulated allocations to a user's account
 * Called when a user logs in to persist their logged-out allocations
 * This is synchronous and just moves localStorage data
 */
export const transferLoggedOutAllocationsToUser = (userId: string): { success: boolean; transferredCount: number } => {
  try {
    // Check if we're on the server side
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return { success: true, transferredCount: 0 };
    }

    const loggedOutBalance = getLoggedOutUsdBalance();

    // If there are no logged-out allocations (besides the default demo ones), nothing to transfer
    if (loggedOutBalance.allocations.length === 0) {
      return { success: true, transferredCount: 0 };
    }

    // Get or create user's balance
    const userBalance = getUserUsdBalance(userId);

    // Merge logged-out allocations into user's balance
    let transferredCount = 0;
    for (const allocation of loggedOutBalance.allocations) {
      // Skip demo allocations
      if (allocation.pageId.startsWith('demo-')) {
        continue;
      }

      // Check if user already has an allocation for this page
      const existingIndex = userBalance.allocations.findIndex(a => a.pageId === allocation.pageId);

      if (existingIndex >= 0) {
        // Update existing allocation with the logged-out amount (take the higher)
        if (allocation.usdCents > userBalance.allocations[existingIndex].usdCents) {
          userBalance.allocations[existingIndex] = allocation;
          transferredCount++;
        }
      } else {
        // Add new allocation
        userBalance.allocations.push(allocation);
        transferredCount++;
      }
    }

    // Recalculate totals
    userBalance.allocatedUsdCents = userBalance.allocations.reduce((sum, a) => sum + a.usdCents, 0);
    userBalance.availableUsdCents = userBalance.totalUsdCents - userBalance.allocatedUsdCents;
    userBalance.lastUpdated = Date.now();

    // Save updated user balance
    saveUsdBalance(getUserStorageKey(userId), userBalance);

    // Clear logged-out allocations (reset to demo state)
    clearLoggedOutUsd();

    return { success: true, transferredCount };
  } catch (error) {
    console.warn('Error transferring logged-out allocations to user:', error);
    return { success: false, transferredCount: 0 };
  }
};

/**
 * Convert simulated allocations to real USD allocations when user activates subscription
 * This would be called when a user successfully activates their subscription
 */
export const convertSimulatedToRealUsd = async (
  userId: string,
  allocateUsdFunction: (pageId: string, usdCents: number) => Promise<boolean>
): Promise<{ success: boolean; convertedCount: number; errors: string[] }> => {
  const balance = getUserUsdBalance(userId);
  const errors: string[] = [];
  let convertedCount = 0;

  for (const allocation of balance.allocations) {
    try {
      const success = await allocateUsdFunction(allocation.pageId, allocation.usdCents);
      if (success) {
        convertedCount++;
      } else {
        errors.push(`Failed to convert allocation for page: ${allocation.pageTitle}`);
      }
    } catch (error) {
      errors.push(`Error converting allocation for page ${allocation.pageTitle}: ${error.message}`);
    }
  }

  // Clear simulated USD after conversion attempt
  if (convertedCount > 0) {
    clearUserUsd(userId);
  }

  return {
    success: errors.length === 0,
    convertedCount,
    errors
  };
};
