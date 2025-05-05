import {
  getFirestore,
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc as fsUpdateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "firebase/firestore";

import app from "./config";
import { db } from "./database";

// Create a user subscription
export const createSubscription = async (userId, subscriptionData) => {
  try {
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    await setDoc(subscriptionRef, {
      ...subscriptionData,
      status: "inactive", // inactive until payment is processed
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error creating subscription:", error);
    return false;
  }
};

// Update a user's subscription
export const updateSubscription = async (userId, subscriptionData) => {
  try {
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    await setDoc(subscriptionRef, {
      ...subscriptionData,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating subscription:", error);
    return false;
  }
};

// Get a user's current subscription
export const getUserSubscription = async (userId, options = {}) => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  try {
    // Only log in verbose mode
    if (verbose) {
      console.log(`[getUserSubscription] Fetching subscription for user: ${userId}`);
    }

    // First check the primary location (user path)
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    const subscriptionSnap = await getDoc(subscriptionRef);

    // Also check the secondary location (API path)
    const apiSubscriptionRef = doc(db, "subscriptions", userId);
    const apiSubscriptionSnap = await getDoc(apiSubscriptionRef);

    // Check if we have data in either location
    const hasUserPathData = subscriptionSnap.exists();
    const hasApiPathData = apiSubscriptionSnap.exists();

    if (verbose) {
      console.log(`[getUserSubscription] Data check: userPath=${hasUserPathData}, apiPath=${hasApiPathData}`);
    }

    // If we have data in both locations, check if they're consistent
    if (hasUserPathData && hasApiPathData) {
      const userPathData = subscriptionSnap.data();
      const apiPathData = apiSubscriptionSnap.data();

      // Check if the status is different
      if (userPathData.status !== apiPathData.status) {
        console.log(`[getUserSubscription] Status mismatch between user path (${userPathData.status}) and API path (${apiPathData.status})`);

        // If either is canceled, use that status
        if (userPathData.status === 'canceled' || apiPathData.status === 'canceled') {
          console.log(`[getUserSubscription] One location has canceled status, fixing subscription data`);

          // Fix the subscription data to ensure consistency
          await fixSubscription(userId, {
            status: 'canceled',
            tier: null,
            amount: 0,
            stripeSubscriptionId: null
          });

          // Get the updated data
          const updatedSnap = await getDoc(subscriptionRef);
          const updatedData = { id: updatedSnap.id, ...updatedSnap.data() };

          if (verbose) {
            console.log(`[getUserSubscription] Returning fixed subscription data:`, updatedData);
          }
          return updatedData;
        }
      }
    }

    // If we have data in the user path, return it (possibly fixing it first)
    if (hasUserPathData) {
      const subscriptionData = { id: subscriptionSnap.id, ...subscriptionSnap.data() };

      if (verbose) {
        console.log(`[getUserSubscription] Found subscription in user path:`,
          { status: subscriptionData.status, amount: subscriptionData.amount });
      }

      // Check if the subscription has all the expected fields
      const requiredFields = ['status', 'amount', 'tier', 'stripeSubscriptionId'];
      const missingFields = requiredFields.filter(field => !subscriptionData[field]);

      if (missingFields.length > 0) {
        console.warn(`[getUserSubscription] Subscription is missing fields: ${missingFields.join(', ')}`);

        // Fix the subscription data
        if (verbose) {
          console.log(`[getUserSubscription] Fixing subscription with missing fields`);
        }

        // Create a fixed version with default values for missing fields
        const fixedData = { ...subscriptionData };

        if (missingFields.includes('status')) {
          fixedData.status = 'canceled';
        }

        if (missingFields.includes('amount')) {
          fixedData.amount = 0;
        }

        if (missingFields.includes('tier')) {
          fixedData.tier = null;
        }

        if (missingFields.includes('stripeSubscriptionId')) {
          fixedData.stripeSubscriptionId = null;
        }

        // Fix the subscription data
        await fixSubscription(userId, fixedData);

        // Get the updated data
        const updatedSnap = await getDoc(subscriptionRef);
        const updatedData = { id: updatedSnap.id, ...updatedSnap.data() };

        if (verbose) {
          console.log(`[getUserSubscription] Returning fixed subscription data:`, updatedData);
        }
        return updatedData;
      }

      return subscriptionData;
    }
    // If we have data in the API path but not in the user path, copy it over
    else if (hasApiPathData) {
      const apiSubscriptionData = { id: apiSubscriptionSnap.id, ...apiSubscriptionSnap.data() };

      if (verbose) {
        console.log(`[getUserSubscription] Found subscription in API path:`,
          { status: apiSubscriptionData.status, amount: apiSubscriptionData.amount });
      }

      // Check if the API subscription has all the expected fields
      const requiredFields = ['status', 'amount', 'tier', 'stripeSubscriptionId'];
      const missingFields = requiredFields.filter(field => !apiSubscriptionData[field]);

      if (missingFields.length > 0) {
        console.warn(`[getUserSubscription] API subscription is missing fields: ${missingFields.join(', ')}`);

        // Create a fixed version with default values for missing fields
        const fixedData = { ...apiSubscriptionData };

        if (missingFields.includes('status')) {
          fixedData.status = 'canceled';
        }

        if (missingFields.includes('amount')) {
          fixedData.amount = 0;
        }

        if (missingFields.includes('tier')) {
          fixedData.tier = null;
        }

        if (missingFields.includes('stripeSubscriptionId')) {
          fixedData.stripeSubscriptionId = null;
        }

        // Copy the fixed data to the user path
        if (verbose) {
          console.log(`[getUserSubscription] Copying fixed API subscription data to user path`);
        }
        await fixSubscription(userId, fixedData);

        // Get the updated data
        const updatedSnap = await getDoc(subscriptionRef);
        const updatedData = { id: updatedSnap.id, ...updatedSnap.data() };

        if (verbose) {
          console.log(`[getUserSubscription] Returning fixed subscription data:`, updatedData);
        }
        return updatedData;
      } else {
        // Copy the data to the user path for future use
        if (verbose) {
          console.log(`[getUserSubscription] Copying subscription data from API path to user path`);
        }
        await fixSubscription(userId, apiSubscriptionData);

        return apiSubscriptionData;
      }
    }

    if (verbose) {
      console.log(`[getUserSubscription] No subscription found in any location for user: ${userId}`);
    }
    return null;
  } catch (error) {
    console.error("[getUserSubscription] Error getting user subscription:", error);
    return null;
  }
};

// Create a pledge from a user to a page
export const createPledge = async (userId, pageId, pledgeAmount) => {
  try {
    // Round to two decimal places for consistent currency handling
    const roundedAmount = Math.round(Number(pledgeAmount) * 100) / 100;

    // Create the pledge document
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    await setDoc(pledgeRef, {
      pageId,
      amount: roundedAmount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update the page's total pledged amount
    const pageRef = doc(db, "pages", pageId);
    await fsUpdateDoc(pageRef, {
      totalPledged: fsUpdateDoc.increment(roundedAmount),
      pledgeCount: fsUpdateDoc.increment(1),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: fsUpdateDoc.increment(roundedAmount),
    });

    return true;
  } catch (error) {
    console.error("Error creating pledge:", error);
    return false;
  }
};

// Update a pledge amount
export const updatePledge = async (userId, pageId, newAmount, oldAmount) => {
  try {
    // Round to two decimal places for consistent currency handling
    const roundedNewAmount = Math.round(Number(newAmount) * 100) / 100;
    const roundedOldAmount = Math.round(Number(oldAmount) * 100) / 100;

    // Calculate the difference
    const amountDifference = roundedNewAmount - roundedOldAmount;

    // Update the pledge
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    await fsUpdateDoc(pledgeRef, {
      amount: roundedNewAmount,
      updatedAt: serverTimestamp(),
    });

    // Update the page's total pledged amount
    const pageRef = doc(db, "pages", pageId);
    await fsUpdateDoc(pageRef, {
      totalPledged: fsUpdateDoc.increment(amountDifference),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: fsUpdateDoc.increment(amountDifference),
    });

    return true;
  } catch (error) {
    console.error("Error updating pledge:", error);
    return false;
  }
};

// Delete a pledge
export const deletePledge = async (userId, pageId, pledgeAmount) => {
  try {
    // Delete the pledge
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    await deleteDoc(pledgeRef);

    // Update the page's total pledged amount
    const pageRef = doc(db, "pages", pageId);
    await fsUpdateDoc(pageRef, {
      totalPledged: fsUpdateDoc.increment(-pledgeAmount),
      pledgeCount: fsUpdateDoc.increment(-1),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: fsUpdateDoc.increment(-pledgeAmount),
    });

    return true;
  } catch (error) {
    console.error("Error deleting pledge:", error);
    return false;
  }
};

// Get all pledges for a user
export const getUserPledges = async (userId, options = {}) => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  try {
    const pledgesCollectionRef = collection(db, "users", userId, "pledges");
    const querySnapshot = await getDocs(pledgesCollectionRef);

    const pledges = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (verbose) {
      console.log(`[getUserPledges] Retrieved ${pledges.length} pledges for user: ${userId}`);
    }

    return pledges;
  } catch (error) {
    console.error("Error getting user pledges:", error);
    return [];
  }
};

// Get a specific pledge
export const getPledge = async (userId, pageId) => {
  try {
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    const pledgeSnap = await getDoc(pledgeRef);

    if (pledgeSnap.exists()) {
      return { id: pledgeSnap.id, ...pledgeSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting pledge:", error);
    return null;
  }
};

// Cancel a subscription (for both demo and real subscriptions)
export const cancelSubscription = async (subscriptionId, customerId = null) => {
  try {
    // Handle case where subscriptionId might be undefined or null
    if (!subscriptionId) {
      console.log('No subscription ID provided, attempting to cancel with customer ID or force cleanup');

      // Call the cancel-subscription API route with minimal data
      // The API will handle finding and canceling the subscription
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Don't include undefined values
          ...(subscriptionId && { subscriptionId }),
          ...(customerId && { customerId }),
          forceCleanup: true // Signal that we want to clean up subscription data even if no active subscription
        }),
      });

      const result = await response.json();

      if (!result.success) {
        // Check if this is the "no subscription found" case, which we now treat as success
        if (result.noSubscription) {
          console.log('No active subscription to cancel, treating as success');
          return {
            success: true,
            message: 'No active subscription found',
            noSubscription: true
          };
        }
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      return result;
    }

    console.log('Calling cancel-subscription API with:', {
      subscriptionId,
      customerId
    });

    // Call the cancel-subscription API route
    const response = await fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId,
        customerId,
        // Always include forceCleanup to ensure data is cleaned up even if Stripe API fails
        forceCleanup: true
      }),
    });

    const result = await response.json();

    if (!result.success) {
      // Check if this is the "no subscription found" case, which we now treat as success
      if (result.noSubscription) {
        console.log('No active subscription to cancel, treating as success');
        return {
          success: true,
          message: 'No active subscription found',
          noSubscription: true
        };
      }
      throw new Error(result.error || 'Failed to cancel subscription');
    }

    return result;
  } catch (error) {
    console.error("Error canceling subscription:", error);
    // Instead of throwing the error, return a result that indicates we should clean up the data
    return {
      success: false,
      error: error.message,
      shouldCleanup: true
    };
  }
};

// Listen to changes in user's subscription
export const listenToUserSubscription = (userId, callback, options = {}) => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  // Only log initial setup in verbose mode
  if (verbose) {
    console.log(`[listenToUserSubscription] Setting up listeners for user: ${userId}`);
  }

  // Set up listener for the user path
  const userSubRef = doc(db, "users", userId, "subscription", "current");
  const apiSubRef = doc(db, "subscriptions", userId);

  // Flag to track if we've already called the callback with data
  let hasCalledCallback = false;

  // Track last data to avoid duplicate logs
  let lastUserData = null;
  let lastApiData = null;

  // Set up listener for the user path
  const userUnsubscribe = onSnapshot(userSubRef, async (doc) => {
    if (doc.exists()) {
      const subscriptionData = { id: doc.id, ...doc.data() };

      // Only log in verbose mode or if data has changed significantly
      const dataChanged = !lastUserData ||
                          lastUserData.status !== subscriptionData.status ||
                          lastUserData.amount !== subscriptionData.amount;

      if (verbose && dataChanged) {
        console.log(`[listenToUserSubscription] Received subscription update from user path:`,
          { status: subscriptionData.status, amount: subscriptionData.amount });
      }

      lastUserData = subscriptionData;

      // Check if the subscription has all the expected fields
      const requiredFields = ['status', 'amount', 'tier', 'stripeSubscriptionId'];
      const missingFields = requiredFields.filter(field => !subscriptionData[field]);

      if (missingFields.length > 0) {
        // Only log once when we find missing fields
        console.warn(`[listenToUserSubscription] Subscription from user path is missing fields: ${missingFields.join(', ')}`);

        // If stripeSubscriptionId is missing but status is active, fix the subscription
        if (missingFields.includes('stripeSubscriptionId') && subscriptionData.status === 'active') {
          console.log(`[listenToUserSubscription] Found active status but missing stripeSubscriptionId, fixing subscription`);
          await fixSubscription(userId, {
            ...subscriptionData,
            status: 'canceled',
            tier: null,
            amount: 0,
            stripeSubscriptionId: null,
            canceledAt: new Date().toISOString()
          });

          // Don't call the callback here, as the fixSubscription will trigger another update
          return;
        }
      }

      // If status is active but stripeSubscriptionId is null, fix the subscription
      if (subscriptionData.status === 'active' && !subscriptionData.stripeSubscriptionId) {
        // Only log in verbose mode
        if (verbose) {
          console.log(`[listenToUserSubscription] Found active status but null stripeSubscriptionId, fixing subscription`);
        }
        await fixSubscription(userId, {
          ...subscriptionData,
          status: 'canceled',
          tier: null,
          amount: 0,
          stripeSubscriptionId: null,
          canceledAt: new Date().toISOString()
        });

        // Don't call the callback here, as the fixSubscription will trigger another update
        return;
      }

      hasCalledCallback = true;
      callback(subscriptionData);
    } else {
      // Only log in verbose mode
      if (verbose) {
        console.log(`[listenToUserSubscription] No subscription document exists in user path for user: ${userId}`);
      }

      // Only call callback with null if we haven't already called it with data from the API path
      if (!hasCalledCallback) {
        callback(null);
      }
    }
  }, (error) => {
    console.error(`[listenToUserSubscription] Error in user path subscription listener:`, error);
  });

  // Set up listener for the API path
  const apiUnsubscribe = onSnapshot(apiSubRef, async (doc) => {
    if (doc.exists()) {
      const subscriptionData = { id: doc.id, ...doc.data() };

      // Only log in verbose mode or if data has changed significantly
      const dataChanged = !lastApiData ||
                          lastApiData.status !== subscriptionData.status ||
                          lastApiData.amount !== subscriptionData.amount;

      if (verbose && dataChanged) {
        console.log(`[listenToUserSubscription] Received subscription update from API path:`,
          { status: subscriptionData.status, amount: subscriptionData.amount });
      }

      lastApiData = subscriptionData;

      // Check if the subscription has all the expected fields
      const requiredFields = ['status', 'amount', 'tier', 'stripeSubscriptionId'];
      const missingFields = requiredFields.filter(field => !subscriptionData[field]);

      if (missingFields.length > 0) {
        // Only log once when we find missing fields
        console.warn(`[listenToUserSubscription] Subscription from API path is missing fields: ${missingFields.join(', ')}`);

        // If stripeSubscriptionId is missing but status is active, fix the subscription
        if (missingFields.includes('stripeSubscriptionId') && subscriptionData.status === 'active') {
          console.log(`[listenToUserSubscription] Found active status but missing stripeSubscriptionId in API path, fixing subscription`);
          await fixSubscription(userId, {
            ...subscriptionData,
            status: 'canceled',
            tier: null,
            amount: 0,
            stripeSubscriptionId: null,
            canceledAt: new Date().toISOString()
          });

          // Don't call the callback here, as the fixSubscription will trigger another update
          return;
        }
      }

      // If status is active but stripeSubscriptionId is null, fix the subscription
      if (subscriptionData.status === 'active' && !subscriptionData.stripeSubscriptionId) {
        // Only log in verbose mode
        if (verbose) {
          console.log(`[listenToUserSubscription] Found active status but null stripeSubscriptionId in API path, fixing subscription`);
        }
        await fixSubscription(userId, {
          ...subscriptionData,
          status: 'canceled',
          tier: null,
          amount: 0,
          stripeSubscriptionId: null,
          canceledAt: new Date().toISOString()
        });

        // Don't call the callback here, as the fixSubscription will trigger another update
        return;
      }

      // Copy the data to the user path if it doesn't exist there
      // But only do this if we're in verbose mode to reduce unnecessary operations
      if (verbose) {
        const userSubSnap = await getDoc(userSubRef);
        if (!userSubSnap.exists()) {
          console.log(`[listenToUserSubscription] Copying subscription data from API path to user path`);
          await fixSubscription(userId, subscriptionData);
        }
      }

      hasCalledCallback = true;
      callback(subscriptionData);
    } else {
      // Only log in verbose mode
      if (verbose) {
        console.log(`[listenToUserSubscription] No subscription document exists in API path for user: ${userId}`);
      }

      // Only call callback with null if we haven't already called it with data from the user path
      if (!hasCalledCallback) {
        callback(null);
      }
    }
  }, (error) => {
    console.error(`[listenToUserSubscription] Error in API path subscription listener:`, error);
  });

  // Return a function that unsubscribes from both listeners
  return () => {
    userUnsubscribe();
    apiUnsubscribe();
  };
};

// Listen to changes in user's pledges
export const listenToUserPledges = (userId, callback, options = {}) => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  const pledgesRef = collection(db, "users", userId, "pledges");

  return onSnapshot(pledgesRef, (snapshot) => {
    const pledges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (verbose) {
      console.log(`[listenToUserPledges] Received ${pledges.length} pledges for user: ${userId}`);
    }

    callback(pledges);
  });
};

// Utility function to fix a subscription that might be missing fields
export const fixSubscription = async (userId, subscriptionData, options = {}) => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  try {
    if (verbose) {
      console.log(`[fixSubscription] Attempting to fix subscription for user: ${userId}`);
      console.log(`[fixSubscription] Calling cleanupSubscriptionData for a complete reset`);
    }

    const cleanupResult = await cleanupSubscriptionData(userId, { verbose });

    if (!cleanupResult) {
      if (verbose) {
        console.error(`[fixSubscription] Failed to clean up subscription data`);
      }
      return false;
    }

    if (verbose) {
      console.log(`[fixSubscription] Subscription data cleaned up successfully`);
    }

    // If the caller provided specific subscription data to set, apply it now
    if (subscriptionData && Object.keys(subscriptionData).length > 0) {
      if (verbose) {
        console.log(`[fixSubscription] Applying provided subscription data:`,
          { status: subscriptionData.status, amount: subscriptionData.amount });
      }

      // Create a clean data object with the provided data
      const finalData = {
        // Start with default canceled state
        status: 'canceled',
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePriceId: null,
        amount: 0,
        tier: null,
        renewalDate: null,
        billingCycleEnd: null,
        pledgedAmount: 0,
        updatedAt: new Date().toISOString(),
        canceledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        // Override with any provided data
        ...subscriptionData
      };

      // Update the subscription in the user path
      const subscriptionRef = doc(db, "users", userId, "subscription", "current");
      await setDoc(subscriptionRef, finalData);

      // Also update the API path
      const apiSubscriptionRef = doc(db, "subscriptions", userId);
      await setDoc(apiSubscriptionRef, finalData);

      // Also update the user document
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        tier: finalData.tier,
        subscriptionStatus: finalData.status,
        updatedAt: serverTimestamp()
      });

      if (verbose) {
        console.log(`[fixSubscription] Applied custom subscription data`);
      }
    }

    if (verbose) {
      console.log(`[fixSubscription] Subscription fixed successfully`);
    }
    return true;
  } catch (error) {
    console.error("[fixSubscription] Error fixing subscription:", error);
    return false;
  }
};

// Utility function to completely clean up subscription data
export const cleanupSubscriptionData = async (userId, options = {}) => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  try {
    if (verbose) {
      if (verbose) {
      console.log(`[cleanupSubscriptionData] Cleaning up subscription data for user: ${userId}`);
    }
    }

    // Create a clean canceled subscription state with ALL possible fields
    const cleanData = {
      status: 'canceled',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      stripePriceId: null,
      amount: 0,
      tier: null,
      renewalDate: null,
      billingCycleEnd: null,
      pledgedAmount: 0,
      updatedAt: new Date().toISOString(),
      canceledAt: new Date().toISOString(),
      createdAt: new Date().toISOString() // Include this to ensure it exists
    };

    // Update the subscription in the user path - use setDoc WITHOUT merge to completely replace
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    await setDoc(subscriptionRef, cleanData);

    if (verbose) {
      console.log(`[cleanupSubscriptionData] Replaced user path subscription document with clean data`);
    }

    // Also update the API path - use setDoc WITHOUT merge to completely replace
    const apiSubscriptionRef = doc(db, "subscriptions", userId);
    await setDoc(apiSubscriptionRef, cleanData);

    if (verbose) {
      console.log(`[cleanupSubscriptionData] Replaced API path subscription document with clean data`);
    }

    // Also update the user document to ensure tier information is consistent
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      tier: null,
      subscriptionStatus: 'canceled',
      updatedAt: serverTimestamp()
    });

    if (verbose) {
      console.log(`[cleanupSubscriptionData] Updated user document`);
    }

    // Try to clean up any Stripe subscriptions that might be lingering
    try {
      // Call the cancel-subscription API with forceCleanup flag
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceCleanup: true
        }),
      });

      const result = await response.json();

      if (verbose) {
        console.log(`[cleanupSubscriptionData] API cleanup result:`, result);
      }
    } catch (apiError) {
      console.error("[cleanupSubscriptionData] Error calling API cleanup:", apiError);
      // Continue even if this fails - we've already cleaned up the local data
    }

    if (verbose) {
      console.log(`[cleanupSubscriptionData] Subscription data cleaned up successfully for user: ${userId}`);
    }
    return true;
  } catch (error) {
    console.error("[cleanupSubscriptionData] Error cleaning up subscription data:", error);
    return false;
  }
};