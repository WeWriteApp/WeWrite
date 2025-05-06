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

    // Check the primary location (user path)
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    const subscriptionSnap = await getDoc(subscriptionRef);

    // If no subscription found, return null
    if (!subscriptionSnap.exists()) {
      if (verbose) {
        console.log(`[getUserSubscription] No subscription found for user: ${userId}`);
      }
      return null;
    }

    // Get the subscription data
    const subscriptionData = { id: subscriptionSnap.id, ...subscriptionSnap.data() };

    // Ensure required fields have values
    if (subscriptionData.status === undefined) subscriptionData.status = 'canceled';
    if (subscriptionData.amount === undefined) subscriptionData.amount = 0;
    if (subscriptionData.tier === undefined) subscriptionData.tier = null;
    if (subscriptionData.stripeSubscriptionId === undefined) subscriptionData.stripeSubscriptionId = null;

    // If status is active but no stripeSubscriptionId, set to canceled
    if (subscriptionData.status === 'active' && !subscriptionData.stripeSubscriptionId) {
      subscriptionData.status = 'canceled';
      subscriptionData.tier = null;
      subscriptionData.amount = 0;
      
      // Update the subscription in Firestore
      await updateSubscription(userId, {
        status: 'canceled',
        tier: null,
        amount: 0,
        canceledAt: new Date().toISOString()
      });
    }

    if (verbose) {
      console.log(`[getUserSubscription] Returning subscription data:`, subscriptionData);
    }

    return subscriptionData;
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
    // Call the cancel-subscription API route
    const response = await fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId,
        customerId
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to cancel subscription');
    }

    return result;
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Listen to changes in user's subscription
export const listenToUserSubscription = (userId, callback, options = {}) => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  // Only log initial setup in verbose mode
  if (verbose) {
    console.log(`[listenToUserSubscription] Setting up listener for user: ${userId}`);
  }

  // Set up listener for the user path only
  const userSubRef = doc(db, "users", userId, "subscription", "current");

  // Set up listener for the user path
  const unsubscribe = onSnapshot(userSubRef, (doc) => {
    if (doc.exists()) {
      const subscriptionData = { id: doc.id, ...doc.data() };

      if (verbose) {
        console.log(`[listenToUserSubscription] Received subscription update:`, 
          { status: subscriptionData.status, amount: subscriptionData.amount });
      }

      callback(subscriptionData);
    } else {
      if (verbose) {
        console.log(`[listenToUserSubscription] No subscription document exists for user: ${userId}`);
      }
      callback(null);
    }
  }, (error) => {
    console.error(`[listenToUserSubscription] Error in subscription listener:`, error);
  });

  // Return the unsubscribe function
  return unsubscribe;
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
