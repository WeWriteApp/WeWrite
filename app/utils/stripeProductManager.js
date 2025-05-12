import Stripe from 'stripe';
import { getStripeSecretKey } from './stripeConfig';

// Constants
const PRODUCT_NAME = 'WeWrite Subscription';
const PRODUCT_DESCRIPTION = 'Monthly subscription for WeWrite';

/**
 * Gets or creates the single subscription product in Stripe
 * This ensures we only have one product for all subscription tiers
 * 
 * @returns {Promise<string>} The Stripe product ID
 */
export async function getSubscriptionProduct() {
  const stripeSecretKey = getStripeSecretKey();
  const stripe = new Stripe(stripeSecretKey);
  
  // Check if we have a product ID in environment variables
  if (process.env.STRIPE_SUBSCRIPTION_PRODUCT_ID) {
    try {
      // Try to retrieve the product to make sure it exists
      const product = await stripe.products.retrieve(process.env.STRIPE_SUBSCRIPTION_PRODUCT_ID);
      
      // If the product exists but is not active, reactivate it
      if (!product.active) {
        console.log('Reactivating existing subscription product:', process.env.STRIPE_SUBSCRIPTION_PRODUCT_ID);
        await stripe.products.update(process.env.STRIPE_SUBSCRIPTION_PRODUCT_ID, {
          active: true,
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION
        });
      }
      
      return process.env.STRIPE_SUBSCRIPTION_PRODUCT_ID;
    } catch (error) {
      // If the product doesn't exist, we'll create a new one below
      console.error('Error retrieving product from environment variable:', error);
    }
  }
  
  // Look for an existing active product with our name
  console.log('Searching for existing subscription product');
  const existingProducts = await stripe.products.list({
    active: true,
    limit: 100
  });
  
  // Find a product with our specific name
  const subscriptionProduct = existingProducts.data.find(
    product => product.name === PRODUCT_NAME
  );
  
  if (subscriptionProduct) {
    console.log('Found existing subscription product:', subscriptionProduct.id);
    return subscriptionProduct.id;
  }
  
  // If no product exists, create a new one
  console.log('Creating new subscription product');
  const newProduct = await stripe.products.create({
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    metadata: {
      managed_by: 'wewrite_app',
      product_type: 'subscription'
    }
  });
  
  console.log('Created new subscription product:', newProduct.id);
  return newProduct.id;
}

/**
 * Creates a dynamic price for the subscription product
 * 
 * @param {number} amount - The subscription amount in dollars
 * @param {string} userId - The user ID for metadata
 * @param {string} tier - The subscription tier (tier1, tier2, tier3, etc.)
 * @returns {Promise<string>} The Stripe price ID
 */
export async function createSubscriptionPrice(amount, userId, tier) {
  const stripeSecretKey = getStripeSecretKey();
  const stripe = new Stripe(stripeSecretKey);
  
  // Get the product ID
  const productId = await getSubscriptionProduct();
  
  // Create a price for the subscription
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    recurring: {
      interval: 'month'
    },
    metadata: {
      userId: userId,
      tier: tier,
      amount: amount.toString(),
      created_by: 'wewrite_app'
    }
  });
  
  console.log('Created new subscription price:', price.id, 'for amount:', amount);
  return price.id;
}

/**
 * Archives old prices that are no longer needed
 * This is useful for keeping the Stripe dashboard clean
 * 
 * @param {number} olderThanDays - Archive prices older than this many days
 * @returns {Promise<number>} The number of prices archived
 */
export async function archiveOldPrices(olderThanDays = 30) {
  const stripeSecretKey = getStripeSecretKey();
  const stripe = new Stripe(stripeSecretKey);
  
  // Calculate the cutoff date
  const cutoffDate = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
  
  // Get the product ID
  const productId = await getSubscriptionProduct();
  
  // List all active prices for our product
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100
  });
  
  // Filter prices that are older than the cutoff date and have no active subscriptions
  const pricesToArchive = [];
  for (const price of prices.data) {
    if (price.created < cutoffDate) {
      // Check if there are any active subscriptions using this price
      const subscriptions = await stripe.subscriptions.list({
        price: price.id,
        status: 'active',
        limit: 1
      });
      
      if (subscriptions.data.length === 0) {
        pricesToArchive.push(price.id);
      }
    }
  }
  
  // Archive the prices
  for (const priceId of pricesToArchive) {
    await stripe.prices.update(priceId, { active: false });
    console.log('Archived price:', priceId);
  }
  
  return pricesToArchive.length;
}
