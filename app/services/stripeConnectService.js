/**
 * Service for handling Stripe Connect operations
 */

/**
 * Create a Stripe Connect account for a creator
 * @param {string} userId - The user ID of the creator
 * @returns {Promise<Object>} - The response with account ID and onboarding URL
 */
export const createConnectAccount = async (userId) => {
  try {
    const response = await fetch('/api/stripe/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create Stripe Connect account');
    }

    return await response.json();
  } catch (error) {
    console.error('Error in createConnectAccount:', error);
    throw error;
  }
};

/**
 * Get the status of a creator's Stripe Connect account
 * @param {string} userId - The user ID of the creator
 * @returns {Promise<Object>} - The response with account status and links
 */
export const getConnectAccountStatus = async (userId) => {
  try {
    const response = await fetch(`/api/stripe/connect?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get Stripe Connect account status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getConnectAccountStatus:', error);
    throw error;
  }
};

/**
 * Get payout history for a creator
 * @param {string} creatorId - The user ID of the creator
 * @returns {Promise<Object>} - The response with payout history
 */
export const getPayoutHistory = async (creatorId) => {
  try {
    const response = await fetch(`/api/stripe/payouts?creatorId=${creatorId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get payout history');
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getPayoutHistory:', error);
    throw error;
  }
};

/**
 * Calculate estimated earnings for a creator
 * @param {string} creatorId - The user ID of the creator
 * @returns {Promise<Object>} - The response with estimated earnings
 */
export const getEstimatedEarnings = async (creatorId) => {
  try {
    const response = await fetch(`/api/stripe/earnings?creatorId=${creatorId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get estimated earnings');
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getEstimatedEarnings:', error);
    throw error;
  }
};
