/**
 * Shared Stripe instance singleton.
 * All server-side code should import getStripe() from here
 * instead of creating their own Stripe instances.
 */
import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';

let stripeInstance: Stripe | null = null;

/**
 * Get the shared Stripe instance.
 * Uses getStripeSecretKey() for environment-aware key selection (test vs prod).
 * Lazily initialized on first call.
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = getStripeSecretKey();
    if (!key) {
      throw new Error('Stripe secret key is not configured. Check STRIPE_SECRET_KEY env var.');
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}
