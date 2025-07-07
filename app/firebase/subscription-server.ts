// Server-side only subscription functions
// This file should ONLY be imported in API routes and server components

import { initAdmin } from "./admin";
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from "../utils/environmentConfig";

// Initialize Firebase Admin
const adminApp = initAdmin();
const adminDb = adminApp.firestore();

// Debug: Check if admin is properly initialized
console.log('Firebase Admin initialized:', !!adminApp);
console.log('Firebase Admin apps count:', adminApp.apps?.length || 'N/A');

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

interface SubscriptionTier {
  tier: number | null;
  status: string | null;
  amount: number | null;
}

interface SubscriptionOptions {
  verbose?: boolean;
}

// Update a user's subscription (server-side only)
export const updateSubscriptionServer = async (userId: string, subscriptionData: Partial<SubscriptionData>): Promise<boolean> => {
  try {
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc("current");
    await subscriptionRef.set({
      ...subscriptionData,
      updatedAt: new Date()}, { merge: true });
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

    // Check the primary location (user path) using environment-aware path
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc("current");
    const subscriptionSnap = await subscriptionRef.get();

    // If no subscription found, return null
    if (!subscriptionSnap.exists) {
      if (verbose) {
        console.log(`[getUserSubscriptionServer] No subscription found for user: ${userId}`);
      }
      return null;
    }

    // Get the subscription data
    const rawData = subscriptionSnap.data();
    const subscriptionData: SubscriptionData = {
      id: subscriptionSnap.id,
      ...rawData,
      status: rawData.status || 'canceled',
      amount: rawData.amount || 0,
      tier: rawData.tier || null,
      stripeSubscriptionId: rawData.stripeSubscriptionId || null,
      paymentMethodId: rawData.metadata?.paymentMethodId || null
    };

    // Apply validation logic to ensure consistent subscription states
    // Only cancel subscriptions that are clearly invalid (older than 10 minutes without stripeSubscriptionId)
    if (subscriptionData.status === 'active' && !subscriptionData.stripeSubscriptionId) {
      const createdAt = rawData.createdAt?.toDate?.() || rawData.createdAt;
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      // Only auto-cancel if the subscription is older than 10 minutes
      // This gives webhooks time to process and update the subscription
      if (createdAt && createdAt < tenMinutesAgo) {
        if (verbose) {
          console.log(`[getUserSubscriptionServer] Auto-cancelling stale subscription for user ${userId} (created: ${createdAt}, age: ${Math.round((now.getTime() - createdAt.getTime()) / 60000)} minutes)`);
        }

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
      } else {
        if (verbose) {
          console.log(`[getUserSubscriptionServer] Subscription is active but missing stripeSubscriptionId, but it's recent (created: ${createdAt}). Waiting for webhook to process.`);
        }
      }
    }

    // Log subscription status for debugging but don't automatically change it
    if (verbose) {
      console.log(`[getUserSubscriptionServer] Current subscription status: '${subscriptionData.status}'`);
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