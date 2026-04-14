/**
 * Stripe Customer Management
 *
 * Single source of truth for getting or creating Stripe customers.
 * Prevents duplicate customers through multi-layer deduplication:
 * 1. Check Firestore for existing stripeCustomerId
 * 2. Verify customer still exists in Stripe
 * 3. Fallback: search Stripe by email to catch orphaned customers
 * 4. Only create if no customer found by any method
 *
 * All API routes that need a Stripe customer should use getOrCreateStripeCustomer().
 */

import Stripe from 'stripe';
import { getStripe } from './stripe';
import { getCollectionName } from '../utils/environmentConfig';

interface GetOrCreateCustomerParams {
  userId: string;
  email: string;
  username?: string;
  /** Firestore admin db instance */
  db: FirebaseFirestore.Firestore;
}

interface GetOrCreateCustomerResult {
  customerId: string;
  /** Whether a new customer was created (vs found existing) */
  created: boolean;
  /** How the customer was resolved */
  source: 'firestore' | 'stripe-email-lookup' | 'created';
}

// In-flight deduplication: prevent concurrent requests for the same user
// from both creating customers
const inFlightCreations = new Map<string, Promise<GetOrCreateCustomerResult>>();

/**
 * Get or create a Stripe customer for a user.
 *
 * Deduplication layers:
 * 1. In-memory mutex per userId (prevents race conditions from concurrent requests)
 * 2. Firestore stripeCustomerId field
 * 3. Stripe customer.retrieve to verify it still exists
 * 4. Stripe customers.list by email (catches orphaned/unlinked customers)
 * 5. Create new only if all lookups fail
 */
export async function getOrCreateStripeCustomer(
  params: GetOrCreateCustomerParams
): Promise<GetOrCreateCustomerResult> {
  const { userId } = params;

  // Layer 1: In-flight deduplication — if another request for this user
  // is already creating a customer, wait for it instead of creating a duplicate
  const existing = inFlightCreations.get(userId);
  if (existing) {
    return existing;
  }

  const promise = _getOrCreateStripeCustomerImpl(params);
  inFlightCreations.set(userId, promise);

  try {
    return await promise;
  } finally {
    inFlightCreations.delete(userId);
  }
}

async function _getOrCreateStripeCustomerImpl(
  params: GetOrCreateCustomerParams
): Promise<GetOrCreateCustomerResult> {
  const { userId, email, username, db } = params;
  const stripe = getStripe();
  const usersCollection = getCollectionName('users');

  // Layer 2: Check Firestore for existing stripeCustomerId
  const userDoc = await db.collection(usersCollection).doc(userId).get();
  const userData = userDoc.data();
  let customerId = userData?.stripeCustomerId;

  // Layer 3: Verify customer still exists in Stripe
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!(customer as any).deleted) {
        return { customerId, created: false, source: 'firestore' };
      }
      // Customer was deleted in Stripe — fall through to re-create
      customerId = null;
    } catch {
      // Customer doesn't exist in Stripe — fall through
      customerId = null;
    }
  }

  // Layer 4: Search Stripe by email (catches orphaned customers from race conditions)
  if (email) {
    try {
      const customers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        const found = customers.data[0];
        // Use this customer and save to Firestore for future lookups
        await db.collection(usersCollection).doc(userId).set(
          { stripeCustomerId: found.id },
          { merge: true }
        );

        // Update Stripe metadata if missing
        if (!found.metadata?.firebaseUID) {
          await stripe.customers.update(found.id, {
            metadata: {
              ...found.metadata,
              firebaseUID: userId,
              username: username || found.metadata?.username || 'Unknown',
            },
          });
        }

        return { customerId: found.id, created: false, source: 'stripe-email-lookup' };
      }
    } catch (err) {
      console.warn('[getOrCreateStripeCustomer] Email lookup failed:', err);
      // Non-fatal — fall through to create
    }
  }

  // Layer 5: Create new customer
  const displayName = username || `user_${userId.substring(0, 8)}`;
  const customer = await stripe.customers.create({
    email,
    description: `WeWrite user ${displayName} (${userId})`,
    metadata: {
      firebaseUID: userId,
      username: displayName,
      environment: process.env.NODE_ENV || 'development',
    },
  });

  // Save to Firestore
  await db.collection(usersCollection).doc(userId).set(
    { stripeCustomerId: customer.id },
    { merge: true }
  );

  return { customerId: customer.id, created: true, source: 'created' };
}
