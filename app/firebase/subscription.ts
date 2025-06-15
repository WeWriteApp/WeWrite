// Mixed client/server subscription functions
// For server-side only functions, use subscription-server.ts
// For client-side only functions, use optimizedSubscription.ts

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
  serverTimestamp,
  increment,
  type DocumentData,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe
} from "firebase/firestore";

import app from "./config";
import { db } from "./database";

// Type definitions for subscription operations
interface SubscriptionData {
  id?: string;
  status: string;
  amount?: number;
  currency?: string;
  interval?: string;
  customerId?: string;
  subscriptionId?: string;
  priceId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  createdAt?: any;
  updatedAt?: any;
  tier?: string | null;
  stripeSubscriptionId?: string | null;
  canceledAt?: string;
}

interface SubscriptionOptions {
  verbose?: boolean;
}

// Create a user subscription
export const createSubscription = async (userId: string, subscriptionData: Partial<SubscriptionData>): Promise<boolean> => {
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
export const updateSubscription = async (userId: string, subscriptionData: Partial<SubscriptionData>): Promise<boolean> => {
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
// WARNING: This function should ONLY be used in API routes (server-side)
// For client-side code, use getOptimizedUserSubscription() or listenToUserSubscription()
export const getUserSubscription = async (userId: string, options: SubscriptionOptions = {}): Promise<SubscriptionData | null> => {
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
    const rawData = subscriptionSnap.data() as DocumentData;
    const subscriptionData: SubscriptionData = {
      id: subscriptionSnap.id,
      ...rawData,
      status: rawData.status || 'canceled',
      amount: rawData.amount || 0,
      tier: rawData.tier || null,
      stripeSubscriptionId: rawData.stripeSubscriptionId || null
    };

    // Note: Removed automatic cancellation logic that was interfering with new subscriptions
    // Webhooks will properly update subscription status when Stripe processes the payment

    // Log subscription status for debugging but don't automatically change it
    if (verbose) {
      console.log(`[getUserSubscription] Current subscription status: '${subscriptionData.status}'`);
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
export const createPledge = async (userId: string, pageId: string, pledgeAmount: number): Promise<boolean> => {
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
      totalPledged: increment(roundedAmount),
      pledgeCount: increment(1),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: increment(roundedAmount),
    });

    return true;
  } catch (error) {
    console.error("Error creating pledge:", error);
    return false;
  }
};

// Update a pledge amount
export const updatePledge = async (userId: string, pageId: string, newAmount: number, oldAmount: number): Promise<boolean> => {
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
      totalPledged: increment(amountDifference),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: increment(amountDifference),
    });

    return true;
  } catch (error) {
    console.error("Error updating pledge:", error);
    return false;
  }
};

// Delete a pledge
export const deletePledge = async (userId: string, pageId: string, pledgeAmount: number): Promise<boolean> => {
  try {
    // Delete the pledge
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    await deleteDoc(pledgeRef);

    // Update the page's total pledged amount
    const pageRef = doc(db, "pages", pageId);
    await fsUpdateDoc(pageRef, {
      totalPledged: increment(-pledgeAmount),
      pledgeCount: increment(-1),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: increment(-pledgeAmount),
    });

    return true;
  } catch (error) {
    console.error("Error deleting pledge:", error);
    return false;
  }
};

// Get all pledges for a user
export const getUserPledges = async (userId: string, options: SubscriptionOptions = {}): Promise<any[]> => {
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
export const getPledge = async (userId: string, pageId: string): Promise<any | null> => {
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
export const cancelSubscription = async (subscriptionId: string, customerId: string | null = null): Promise<{ success: boolean; error?: string }> => {
  try {
    // Call the new cancel-subscription API route
    const response = await fetch('/api/subscription/cancel', {
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
export const listenToUserSubscription = (userId: string, callback: (data: SubscriptionData | null) => void, options: SubscriptionOptions = {}): Unsubscribe => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  // Only log initial setup in verbose mode
  if (verbose) {
    console.log(`[listenToUserSubscription] Setting up listener for user: ${userId}`);
  }

  // Set up listener for the user path only
  const userSubRef = doc(db, "users", userId, "subscription", "current");

  // Set up listener for the user path
  const unsubscribe = onSnapshot(userSubRef, async (doc) => {
    if (doc.exists()) {
      const rawData = doc.data() as DocumentData;
      let subscriptionData: SubscriptionData = {
        id: doc.id,
        ...rawData,
        status: rawData.status || 'canceled',
        amount: rawData.amount || 0,
        tier: rawData.tier || null,
        stripeSubscriptionId: rawData.stripeSubscriptionId || null
      };

      // Note: Removed automatic cancellation logic that was interfering with new subscriptions
      // Webhooks will properly update subscription status when Stripe processes the payment

      // Log subscription status for debugging but don't automatically change it
      if (verbose) {
        console.log(`[listenToUserSubscription] Current subscription status: '${subscriptionData.status}'`);
      }

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
export const listenToUserPledges = (userId: string, callback: (pledges: any[]) => void, options: SubscriptionOptions = {}): Unsubscribe => {
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
