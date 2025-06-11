// Server-side only subscription functions
// This file should ONLY be imported in API routes and server components

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  type DocumentData
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

// Update a user's subscription (server-side only)
export const updateSubscriptionServer = async (userId: string, subscriptionData: Partial<SubscriptionData>): Promise<boolean> => {
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

// Get a user's current subscription (server-side only)
export const getUserSubscriptionServer = async (userId: string, options: SubscriptionOptions = {}): Promise<SubscriptionData | null> => {
  // Control verbose logging with an option
  const verbose = options.verbose || false;

  try {
    // Only log in verbose mode
    if (verbose) {
      console.log(`[getUserSubscriptionServer] Fetching subscription for user: ${userId}`);
    }

    // Check the primary location (user path)
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    const subscriptionSnap = await getDoc(subscriptionRef);

    // If no subscription found, return null
    if (!subscriptionSnap.exists()) {
      if (verbose) {
        console.log(`[getUserSubscriptionServer] No subscription found for user: ${userId}`);
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

    // If status is active but no stripeSubscriptionId, set to canceled
    if (subscriptionData.status === 'active' && !subscriptionData.stripeSubscriptionId) {
      subscriptionData.status = 'canceled';
      subscriptionData.tier = null;
      subscriptionData.amount = 0;
      
      // Update the subscription in Firestore
      await updateSubscriptionServer(userId, {
        status: 'canceled',
        tier: null,
        amount: 0,
        canceledAt: new Date().toISOString()
      });
    }

    if (verbose) {
      console.log(`[getUserSubscriptionServer] Returning subscription data:`, subscriptionData);
    }

    return subscriptionData;
  } catch (error) {
    console.error("[getUserSubscriptionServer] Error getting user subscription:", error);
    return null;
  }
};
