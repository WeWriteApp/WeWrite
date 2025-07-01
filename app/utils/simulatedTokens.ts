/**
 * Simulated Token Allocation Utilities
 * 
 * Manages simulated token allocations for logged-out users and logged-in users
 * without active subscriptions. Uses localStorage for persistence.
 */

export interface SimulatedTokenAllocation {
  pageId: string;
  pageTitle: string;
  tokens: number;
  timestamp: number;
}

export interface SimulatedTokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
  allocations: SimulatedTokenAllocation[];
  lastUpdated: number;
}

// Constants
const SIMULATED_MONTHLY_TOKENS = 100; // Equivalent to $10/month
const STORAGE_KEY_PREFIX = 'wewrite_simulated_tokens';
const LOGGED_OUT_STORAGE_KEY = `${STORAGE_KEY_PREFIX}_logged_out`;

/**
 * Get storage key for a specific user (logged-in users without subscription)
 */
const getUserStorageKey = (userId: string): string => {
  return `${STORAGE_KEY_PREFIX}_user_${userId}`;
};

/**
 * Get simulated token balance for logged-out users
 */
export const getLoggedOutTokenBalance = (): SimulatedTokenBalance => {
  try {
    const stored = localStorage.getItem(LOGGED_OUT_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return {
        totalTokens: SIMULATED_MONTHLY_TOKENS,
        allocatedTokens: data.allocatedTokens || 0,
        availableTokens: SIMULATED_MONTHLY_TOKENS - (data.allocatedTokens || 0),
        allocations: data.allocations || [],
        lastUpdated: data.lastUpdated || Date.now()
      };
    }
  } catch (error) {
    console.warn('Error reading logged-out token balance:', error);
  }

  // Return default balance
  return {
    totalTokens: SIMULATED_MONTHLY_TOKENS,
    allocatedTokens: 0,
    availableTokens: SIMULATED_MONTHLY_TOKENS,
    allocations: [],
    lastUpdated: Date.now()
  };
};

/**
 * Get simulated token balance for a logged-in user without subscription
 */
export const getUserTokenBalance = (userId: string): SimulatedTokenBalance => {
  try {
    const stored = localStorage.getItem(getUserStorageKey(userId));
    if (stored) {
      const data = JSON.parse(stored);
      return {
        totalTokens: SIMULATED_MONTHLY_TOKENS,
        allocatedTokens: data.allocatedTokens || 0,
        availableTokens: SIMULATED_MONTHLY_TOKENS - (data.allocatedTokens || 0),
        allocations: data.allocations || [],
        lastUpdated: data.lastUpdated || Date.now()
      };
    }
  } catch (error) {
    console.warn('Error reading user token balance:', error);
  }

  // Return default balance
  return {
    totalTokens: SIMULATED_MONTHLY_TOKENS,
    allocatedTokens: 0,
    availableTokens: SIMULATED_MONTHLY_TOKENS,
    allocations: [],
    lastUpdated: Date.now()
  };
};

/**
 * Save token balance to localStorage
 */
const saveTokenBalance = (storageKey: string, balance: SimulatedTokenBalance): void => {
  try {
    const dataToStore = {
      allocatedTokens: balance.allocatedTokens,
      allocations: balance.allocations,
      lastUpdated: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(dataToStore));
  } catch (error) {
    console.warn('Error saving token balance:', error);
  }
};

/**
 * Allocate tokens to a page for logged-out users
 */
export const allocateLoggedOutTokens = (
  pageId: string,
  pageTitle: string,
  tokens: number
): { success: boolean; balance: SimulatedTokenBalance; error?: string } => {
  const currentBalance = getLoggedOutTokenBalance();
  
  // Find existing allocation for this page
  const existingAllocationIndex = currentBalance.allocations.findIndex(a => a.pageId === pageId);
  const existingTokens = existingAllocationIndex >= 0 ? currentBalance.allocations[existingAllocationIndex].tokens : 0;
  
  // Calculate new total allocated tokens
  const newAllocatedTokens = currentBalance.allocatedTokens - existingTokens + tokens;
  
  // Check if we have enough tokens
  if (newAllocatedTokens > SIMULATED_MONTHLY_TOKENS) {
    return {
      success: false,
      balance: currentBalance,
      error: 'Insufficient tokens available'
    };
  }

  // Update allocations
  const newAllocations = [...currentBalance.allocations];
  
  if (tokens === 0) {
    // Remove allocation if tokens is 0
    if (existingAllocationIndex >= 0) {
      newAllocations.splice(existingAllocationIndex, 1);
    }
  } else {
    // Update or add allocation
    const allocation: SimulatedTokenAllocation = {
      pageId,
      pageTitle,
      tokens,
      timestamp: Date.now()
    };
    
    if (existingAllocationIndex >= 0) {
      newAllocations[existingAllocationIndex] = allocation;
    } else {
      newAllocations.push(allocation);
    }
  }

  // Create new balance
  const newBalance: SimulatedTokenBalance = {
    totalTokens: SIMULATED_MONTHLY_TOKENS,
    allocatedTokens: newAllocatedTokens,
    availableTokens: SIMULATED_MONTHLY_TOKENS - newAllocatedTokens,
    allocations: newAllocations,
    lastUpdated: Date.now()
  };

  // Save to localStorage
  saveTokenBalance(LOGGED_OUT_STORAGE_KEY, newBalance);

  return {
    success: true,
    balance: newBalance
  };
};

/**
 * Allocate tokens to a page for a logged-in user without subscription
 */
export const allocateUserTokens = (
  userId: string,
  pageId: string,
  pageTitle: string,
  tokens: number
): { success: boolean; balance: SimulatedTokenBalance; error?: string } => {
  const currentBalance = getUserTokenBalance(userId);
  
  // Find existing allocation for this page
  const existingAllocationIndex = currentBalance.allocations.findIndex(a => a.pageId === pageId);
  const existingTokens = existingAllocationIndex >= 0 ? currentBalance.allocations[existingAllocationIndex].tokens : 0;
  
  // Calculate new total allocated tokens
  const newAllocatedTokens = currentBalance.allocatedTokens - existingTokens + tokens;
  
  // Check if we have enough tokens
  if (newAllocatedTokens > SIMULATED_MONTHLY_TOKENS) {
    return {
      success: false,
      balance: currentBalance,
      error: 'Insufficient tokens available'
    };
  }

  // Update allocations
  const newAllocations = [...currentBalance.allocations];
  
  if (tokens === 0) {
    // Remove allocation if tokens is 0
    if (existingAllocationIndex >= 0) {
      newAllocations.splice(existingAllocationIndex, 1);
    }
  } else {
    // Update or add allocation
    const allocation: SimulatedTokenAllocation = {
      pageId,
      pageTitle,
      tokens,
      timestamp: Date.now()
    };
    
    if (existingAllocationIndex >= 0) {
      newAllocations[existingAllocationIndex] = allocation;
    } else {
      newAllocations.push(allocation);
    }
  }

  // Create new balance
  const newBalance: SimulatedTokenBalance = {
    totalTokens: SIMULATED_MONTHLY_TOKENS,
    allocatedTokens: newAllocatedTokens,
    availableTokens: SIMULATED_MONTHLY_TOKENS - newAllocatedTokens,
    allocations: newAllocations,
    lastUpdated: Date.now()
  };

  // Save to localStorage
  saveTokenBalance(getUserStorageKey(userId), newBalance);

  return {
    success: true,
    balance: newBalance
  };
};

/**
 * Get current token allocation for a specific page (logged-out users)
 */
export const getLoggedOutPageAllocation = (pageId: string): number => {
  const balance = getLoggedOutTokenBalance();
  const allocation = balance.allocations.find(a => a.pageId === pageId);
  return allocation ? allocation.tokens : 0;
};

/**
 * Get current token allocation for a specific page (logged-in user without subscription)
 */
export const getUserPageAllocation = (userId: string, pageId: string): number => {
  const balance = getUserTokenBalance(userId);
  const allocation = balance.allocations.find(a => a.pageId === pageId);
  return allocation ? allocation.tokens : 0;
};

/**
 * Clear all simulated token data for logged-out users
 */
export const clearLoggedOutTokens = (): void => {
  try {
    localStorage.removeItem(LOGGED_OUT_STORAGE_KEY);
  } catch (error) {
    console.warn('Error clearing logged-out tokens:', error);
  }
};

/**
 * Clear all simulated token data for a specific user
 */
export const clearUserTokens = (userId: string): void => {
  try {
    localStorage.removeItem(getUserStorageKey(userId));
  } catch (error) {
    console.warn('Error clearing user tokens:', error);
  }
};

/**
 * Convert simulated allocations to real token allocations when user activates subscription
 * This would be called when a user successfully activates their subscription
 */
export const convertSimulatedToRealTokens = async (
  userId: string,
  allocateTokensFunction: (pageId: string, tokens: number) => Promise<boolean>
): Promise<{ success: boolean; convertedCount: number; errors: string[] }> => {
  const balance = getUserTokenBalance(userId);
  const errors: string[] = [];
  let convertedCount = 0;

  for (const allocation of balance.allocations) {
    try {
      const success = await allocateTokensFunction(allocation.pageId, allocation.tokens);
      if (success) {
        convertedCount++;
      } else {
        errors.push(`Failed to convert allocation for page: ${allocation.pageTitle}`);
      }
    } catch (error) {
      errors.push(`Error converting allocation for page ${allocation.pageTitle}: ${error.message}`);
    }
  }

  // Clear simulated tokens after conversion attempt
  if (convertedCount > 0) {
    clearUserTokens(userId);
  }

  return {
    success: errors.length === 0,
    convertedCount,
    errors
  };
};

/**
 * Transfer logged-out user allocations to a new user account
 * This should be called during the registration process
 */
export const transferLoggedOutAllocationsToUser = (userId: string): { success: boolean; transferredCount: number } => {
  try {
    const loggedOutBalance = getLoggedOutTokenBalance();

    if (loggedOutBalance.allocations.length === 0) {
      return { success: true, transferredCount: 0 };
    }

    // Save the logged-out allocations to the new user's storage
    const userStorageKey = getUserStorageKey(userId);
    const dataToStore = {
      allocatedTokens: loggedOutBalance.allocatedTokens,
      allocations: loggedOutBalance.allocations,
      lastUpdated: Date.now()
    };

    localStorage.setItem(userStorageKey, JSON.stringify(dataToStore));

    // Clear the logged-out allocations
    clearLoggedOutTokens();

    return {
      success: true,
      transferredCount: loggedOutBalance.allocations.length
    };
  } catch (error) {
    console.warn('Error transferring logged-out allocations:', error);
    return { success: false, transferredCount: 0 };
  }
};