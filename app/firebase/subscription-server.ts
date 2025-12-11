// Server-side only subscription functions
// This file should ONLY be imported in API routes and server components

import { initAdmin } from "./admin";
import { getSubCollectionPath, PAYMENT_COLLECTIONS, getCollectionNameAsync } from "../utils/environmentConfig";
import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';

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

    // CRITICAL FIX: Handle incomplete subscriptions that have a valid Stripe subscription ID
    // This happens when webhooks haven't updated the status yet, but the subscription exists in Stripe
    if (subscriptionData.status === 'incomplete' && subscriptionData.stripeSubscriptionId) {
      const createdAt = rawData.createdAt?.toDate?.() || rawData.createdAt;
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // If the subscription is older than 5 minutes and has a Stripe ID, treat it as active
      // This handles cases where webhooks are delayed or failed to update the status
      if (createdAt && createdAt < fiveMinutesAgo) {
        if (verbose) {
          console.log(`[getUserSubscriptionServer] 🔧 FIXING: Incomplete subscription with valid Stripe ID, treating as active for user ${userId} (created: ${createdAt}, age: ${Math.round((now.getTime() - createdAt.getTime()) / 60000)} minutes)`);
        }

        subscriptionData.status = 'active';

        // Update the subscription in Firestore to fix the status
        await updateSubscriptionServer(userId, {
          status: 'active',
          updatedAt: new Date().toISOString()
        });
      } else {
        if (verbose) {
          console.log(`[getUserSubscriptionServer] Incomplete subscription is recent (created: ${createdAt}). Waiting for webhook to process.`);
        }
      }
    }

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

    // CRITICAL: Verify subscription status against Stripe (source of truth)
    // This handles cases where Firebase status is stale due to missed webhooks
    if (subscriptionData.stripeSubscriptionId && subscriptionData.status === 'active') {
      try {
        const stripeKey = getStripeSecretKey();
        if (stripeKey) {
          const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId);

          // Check if Stripe says the subscription is NOT active
          const stripeStatus = stripeSubscription.status;
          const isStripeActive = stripeStatus === 'active' || stripeStatus === 'trialing';

          if (!isStripeActive) {
            if (verbose) {
              console.log(`[getUserSubscriptionServer] 🔄 STRIPE SYNC: Firebase says 'active' but Stripe says '${stripeStatus}' for user ${userId}`);
            }

            // Update Firebase to match Stripe (sync the data)
            subscriptionData.status = stripeStatus === 'canceled' ? 'canceled' : stripeStatus;

            // Also update Firebase for future requests
            await updateSubscriptionServer(userId, {
              status: subscriptionData.status,
              canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : undefined,
              updatedAt: new Date().toISOString()
            });

            console.log(`[getUserSubscriptionServer] ✅ Updated Firebase subscription status to '${subscriptionData.status}' for user ${userId}`);
          }
        }
      } catch (stripeError) {
        // If the subscription doesn't exist in Stripe, mark it as canceled
        if ((stripeError as any)?.code === 'resource_missing') {
          if (verbose) {
            console.log(`[getUserSubscriptionServer] 🔄 STRIPE SYNC: Subscription ${subscriptionData.stripeSubscriptionId} not found in Stripe, marking as canceled`);
          }
          subscriptionData.status = 'canceled';

          await updateSubscriptionServer(userId, {
            status: 'canceled',
            canceledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } else {
          console.warn(`[getUserSubscriptionServer] Could not verify Stripe subscription:`, stripeError);
        }
      }
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