// Server-side only subscription functions
// This file should ONLY be imported in API routes and server components

import { initAdmin } from "./admin";
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from "../utils/environmentConfig";

// Initialize Firebase Admin lazily
let adminApp;
let adminDb;

function initializeFirebase() {
  if (adminApp && adminDb) return { adminApp, adminDb }; // Already initialized

  try {
    adminApp = initAdmin();
    if (!adminApp) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { adminApp: null, adminDb: null };
    }
    adminDb = adminApp.firestore();
    console.log('Firebase Admin initialized successfully in subscription-server');
  } catch (error) {
    console.error('Error initializing Firebase Admin in subscription-server:', error);
    return { adminApp: null, adminDb: null };
  }

  return { adminApp, adminDb };
}

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
    const { adminDb } = initializeFirebase();
    if (!adminDb) {
      console.warn('Firebase Admin not available for subscription update');
      return false;
    }

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
    const { adminDb } = initializeFirebase();
    if (!adminDb) {
      console.warn('Firebase Admin not available for subscription fetch');
      return null;
    }

    // Log environment info for debugging
    if (verbose) {
      console.log(`[getUserSubscriptionServer] Environment info:`, {
        VERCEL_ENV: process.env.VERCEL_ENV,
        NODE_ENV: process.env.NODE_ENV
      });
      console.log(`[getUserSubscriptionServer] Fetching subscription for user: ${userId}`);
    }

    // Check the primary location (user path) using environment-aware path
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);

    if (verbose) {
      console.log(`[getUserSubscriptionServer] Using collection path:`, {
        parentPath,
        subCollectionName,
        fullPath: `${parentPath}/${subCollectionName}/current`
      });
    }

    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc("current");
    const subscriptionSnap = await subscriptionRef.get();

    // If no subscription found, return inactive state
    if (!subscriptionSnap.exists) {
      if (verbose) {
        console.log(`[getUserSubscriptionServer] No subscription found for user: ${userId} - returning inactive state`);
      }
      return {
        id: 'inactive',
        status: 'inactive',
        amount: 0,
        tier: null,
        stripeSubscriptionId: null
      };
    }

    // Get the subscription data
    const rawData = subscriptionSnap.data();

    // Validate that we have a proper status - null/undefined status indicates data corruption
    if (!rawData.status) {
      console.error(`[getUserSubscriptionServer] 🔴 CRITICAL: Invalid subscription data for user ${userId}: missing status field`, {
        userId,
        documentExists: true,
        rawDataKeys: Object.keys(rawData || {}),
        rawDataSample: {
          status: rawData.status,
          amount: rawData.amount,
          tier: rawData.tier,
          stripeSubscriptionId: rawData.stripeSubscriptionId,
          createdAt: rawData.createdAt,
          updatedAt: rawData.updatedAt
        },
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV
      });
      // Return null to indicate error state rather than defaulting to 'canceled'
      return null;
    }

    const subscriptionData: SubscriptionData = {
      id: subscriptionSnap.id,
      ...rawData,
      status: rawData.status, // Don't default - require valid status
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