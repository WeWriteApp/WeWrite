/**
 * Stripe Product and Price Management Utility
 *
 * This module provides centralized management of Stripe products and prices
 * for the WeWrite subscription system. Updated to use USD-based credits
 * instead of token-based subscriptions.
 *
 * Architecture:
 * - Single "WeWrite Account Funding" product
 * - Multiple price objects for different funding tiers
 * - Reuse existing prices when possible
 * - Create new prices only for custom amounts
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from './stripeConfig';
import { SUBSCRIPTION_TIERS, SubscriptionTier } from './subscriptionTiers';
import { USD_SUBSCRIPTION_TIERS, dollarsToCents } from './usdConstants';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2025-06-30.basil'});

// WeWrite main product configuration (updated for USD system)
export const WEWRITE_PRODUCT_CONFIG = {
  name: 'WeWrite Account Funding',
  description: 'Monthly funding to support WeWrite creators with direct USD payments',
  metadata: {
    platform: 'wewrite',
    type: 'subscription',
    currency: 'usd',
    system: 'usd_based'
  }
} as const;

// Legacy product configuration for backward compatibility
export const LEGACY_WEWRITE_PRODUCT_CONFIG = {
  name: 'WeWrite Subscription',
  description: 'Monthly subscription to support WeWrite creators with tokens',
  metadata: {
    platform: 'wewrite',
    type: 'subscription',
    system: 'token_based'
  }
} as const;

// Cache for product and price IDs
let cachedProductId: string | null = null;
const cachedPriceIds = new Map<string, string>();

/**
 * Get or create the main WeWrite USD-based product
 */
export async function getOrCreateWeWriteProduct(): Promise<string> {
  if (cachedProductId) {
    return cachedProductId;
  }

  try {
    // Search for existing WeWrite USD-based product
    const products = await stripe.products.list({
      limit: 100,
      active: true
    });

    const existingProduct = products.data.find(
      product => product.name === WEWRITE_PRODUCT_CONFIG.name ||
                 product.metadata?.system === 'usd_based'
    );

    if (existingProduct) {
      console.log(`Found existing WeWrite product: ${existingProduct.id}`);

      // Update product description if it's still using token-based language
      if (existingProduct.description?.includes('tokens') &&
          !existingProduct.description?.includes('USD')) {
        console.log('Updating product description to USD-based language...');
        await stripe.products.update(existingProduct.id, {
          name: WEWRITE_PRODUCT_CONFIG.name,
          description: WEWRITE_PRODUCT_CONFIG.description,
          metadata: WEWRITE_PRODUCT_CONFIG.metadata
        });
      }

      cachedProductId = existingProduct.id;
      return existingProduct.id;
    }

    // Create new USD-based product if none exists
    console.log('Creating new WeWrite USD-based product...');
    const newProduct = await stripe.products.create(WEWRITE_PRODUCT_CONFIG);
    cachedProductId = newProduct.id;
    console.log(`Created new WeWrite USD product: ${newProduct.id}`);
    return newProduct.id;

  } catch (error) {
    console.error('Error getting or creating WeWrite product:', error);
    throw error;
  }
}

/**
 * Get or create a price for a specific tier
 */
export async function getOrCreatePriceForTier(
  tier: SubscriptionTier,
  customAmount?: number
): Promise<string> {
  const amount = customAmount || tier.amount;
  const tokens = customAmount ? Math.floor(customAmount * 10) : tier.tokens;
  
  // For custom amounts, always create a new price
  if (tier.id === 'custom' || customAmount) {
    return await createNewPrice(amount, tier.id, tokens, tier.name);
  }

  // Check cache first
  const cacheKey = `${tier.id}-${amount}`;
  if (cachedPriceIds.has(cacheKey)) {
    return cachedPriceIds.get(cacheKey)!;
  }

  // Check if tier has a stored price ID
  if (tier.stripePriceId) {
    try {
      // Verify the price still exists and is active
      const price = await stripe.prices.retrieve(tier.stripePriceId);
      if (price.active) {
        cachedPriceIds.set(cacheKey, tier.stripePriceId);
        return tier.stripePriceId;
      }
    } catch (error) {
      console.warn(`Stored price ID ${tier.stripePriceId} for tier ${tier.id} is invalid, creating new one`);
    }
  }

  // Search for existing price with matching amount and metadata
  const prices = await stripe.prices.list({
    product: await getOrCreateWeWriteProduct(),
    active: true,
    limit: 100});

  const existingPrice = prices.data.find(price => 
    price.unit_amount === Math.round(amount * 100) &&
    price.metadata.tier === tier.id
  );

  if (existingPrice) {
    cachedPriceIds.set(cacheKey, existingPrice.id);
    console.log(`Found existing price for tier ${tier.id}: ${existingPrice.id}`);
    return existingPrice.id;
  }

  // Create new price
  const newPriceId = await createNewPrice(amount, tier.id, tokens, tier.name);
  cachedPriceIds.set(cacheKey, newPriceId);
  return newPriceId;
}

/**
 * Create a new price for the WeWrite USD-based product
 */
async function createNewPrice(
  amount: number,
  tierId: string,
  tokens: number,
  tierName: string
): Promise<string> {
  try {
    const productId = await getOrCreateWeWriteProduct();

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        tier: tierId,
        usdAmount: amount.toString(),
        usdCents: dollarsToCents(amount).toString(),
        tierName: tierName,
        system: 'usd_based',
        // Legacy token metadata for backward compatibility
        tokens: tokens.toString(),
        amount: amount.toString(),
        tierName}});

    console.log(`Created new price for tier ${tierId}: ${price.id} ($${amount}/mo, ${tokens} tokens)`);
    return price.id;

  } catch (error) {
    console.error(`Error creating price for tier ${tierId}:`, error);
    throw error;
  }
}

/**
 * Get price for custom amount (always creates new price)
 */
export async function createCustomPrice(amount: number): Promise<string> {
  const tokens = Math.floor(amount * 10); // $1 = 10 tokens
  return await createNewPrice(amount, 'custom', tokens, `Custom ($${amount}/mo)`);
}

/**
 * List all WeWrite subscription prices
 */
export async function listWeWritePrices(): Promise<Stripe.Price[]> {
  try {
    const productId = await getOrCreateWeWriteProduct();
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100});
    return prices.data;
  } catch (error) {
    console.error('Error listing WeWrite prices:', error);
    throw error;
  }
}

/**
 * Archive old/unused prices to keep the product clean
 */
export async function archiveUnusedPrices(keepActiveCount: number = 10): Promise<void> {
  try {
    const prices = await listWeWritePrices();
    
    // Sort by creation date, newest first
    const sortedPrices = prices.sort((a, b) => b.created - a.created);
    
    // Archive prices beyond the keep count
    const pricesToArchive = sortedPrices.slice(keepActiveCount);
    
    for (const price of pricesToArchive) {
      await stripe.prices.update(price.id, { active: false });
      console.log(`Archived old price: ${price.id}`);
    }
    
    if (pricesToArchive.length > 0) {
      console.log(`Archived ${pricesToArchive.length} old prices`);
    }
  } catch (error) {
    console.error('Error archiving unused prices:', error);
    throw error;
  }
}

/**
 * Clear cached IDs (useful for testing or when products change)
 */
export function clearCache(): void {
  cachedProductId = null;
  cachedPriceIds.clear();
}