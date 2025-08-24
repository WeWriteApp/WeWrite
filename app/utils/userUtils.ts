/**
 * Utilities for consistent user data management across the application
 *
 * This is the AUTHORITATIVE source for user data fetching.
 * All other files should import getUsernameById from here instead of implementing their own.
 */
// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { userProfileApi } from './apiClient';
import type { User } from "../types/database";
import { getEffectiveTier } from './subscriptionTiers';

/**
 * Gets the username for a given user ID (CLIENT-SIDE ONLY)
 * Handles all the logic to ensure consistent username display throughout the app
 * This is the AUTHORITATIVE implementation - all other getUsernameById functions should be removed
 * @param userId - The user ID to get the username for
 * @returns The username or "Missing username" if not found
 */
export const getUsernameById = async (userId: string): Promise<string> => {
  if (!userId) {
    console.log('👤 [USER UTILS] No userId provided');
    return "Missing username";
  }

  try {
    // Client-side: Use API endpoint
    console.log('👤 [USER UTILS] Fetching user data via API for:', userId);
    const response = await userProfileApi.getProfile(userId);

    if (response.success && response.data) {
      const userData = response.data as User;

      // Check for valid username (not empty, not "Anonymous", not "Missing username")
      if (userData.username &&
          userData.username !== "Anonymous" &&
          userData.username !== "Missing username" &&
          userData.username.trim() !== "") {
        console.log('👤 [USER UTILS] Found valid username:', userData.username);
        return userData.username.trim();
      }

      console.log('👤 [USER UTILS] User data found but no valid username:', {
        hasUsername: !!userData.username,
        username: userData.username,
        userId
      });
    } else {
      console.log('👤 [USER UTILS] API call failed or returned no data:', {
        success: response.success,
        hasData: !!response.data,
        error: response.error,
        userId
      });
    }

    // If no valid username found, return default
    console.log('👤 [USER UTILS] No valid username found for user:', userId);
    return "Missing username";
  } catch (error) {
    console.error("👤 [USER UTILS] Error fetching username by ID:", error);
    return "Missing username";
  }
};

/**
 * Gets the current authenticated user's username
 * @returns The current user's username or "Missing username" if not logged in
 * @deprecated Use the auth provider context instead
 */
export const getCurrentUsername = async (): Promise<string> => {
  // DEPRECATED: This function should not be used - use auth provider context instead
  console.warn('👤 [USER UTILS] getCurrentUsername is deprecated - use auth provider context instead');
  return "Missing username";
};

/**
 * Ensures a page's data has a valid username
 * If the page doesn't have a username, fetches it from the user profile
 * @param pageData - The page data object
 * @returns The enriched page data with valid username
 */
export const ensurePageUsername = async (pageData: any): Promise<any> => {
  if (!pageData) return null;

  // If page already has a valid username, return as is
  if (pageData.username && pageData.username !== "Anonymous" && pageData.username !== "Missing username") {
    return pageData;
  }

  // Otherwise, try to fetch the username based on userId
  if (pageData.userId) {
    try {
      const username = await getUsernameById(pageData.userId);
      return {
        ...pageData,
        username: username || "Missing username" // Ensure username is never undefined
      };
    } catch (error) {
      console.error("Error ensuring page username:", error);
      // Set a default username in case of error
      return {
        ...pageData,
        username: "Missing username"
      };
    }
  }

  // If we get here, ensure the page has a username property
  return {
    ...pageData,
    username: pageData.username || "Missing username"
  };
};

interface SubscriptionTier {
  tier: string | null;
  status: string | null;
  amount: number | null;
}

/**
 * Gets the subscription tier and status for a given user ID
 * @param userId - The user ID to get the subscription tier for
 * @returns Object containing tier and status
 */
export const getUserSubscriptionTier = async (userId: string): Promise<SubscriptionTier> => {
  if (!userId) return { tier: null, status: null, amount: null };

  try {
    // Use API endpoint instead of direct Firebase calls to avoid permission issues
    const response = await fetch(`/api/account-subscription?userId=${userId}`);

    if (!response.ok) {
      console.log('No subscription data found for user:', userId);
      return { tier: null, status: null, amount: null };
    }

    const subscription = await response.json();

    if (!subscription) {
      return { tier: null, status: null, amount: null };
    }

    // Return the tier and status
    let tier = subscription.tier;
    const status = subscription.status;

    // Convert legacy tier names if needed
    if (tier === 'bronze') {
      tier = 'tier1';
    } else if (tier === 'silver') {
      tier = 'tier2';
    } else if (tier === 'gold') {
      tier = 'tier3';
    }

    // Use centralized tier determination logic
    const amount = subscription.amount || null;
    const effectiveTier = getEffectiveTier(amount, tier, status);

    return { tier: effectiveTier, status, amount };
  } catch (error) {
    console.error('Error fetching subscription tier:', error);
    return { tier: null, status: null, amount: null };
  }
};