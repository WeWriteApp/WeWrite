# Stripe Product Management

This document outlines our approach to managing Stripe products and prices for WeWrite subscriptions.

## Overview

We use a single Stripe product for all subscription tiers, with dynamic pricing based on the tier selected by the user. This simplifies our Stripe catalog management and makes it easier to track subscription revenue.

## Implementation

### Single Product Approach

- We maintain a single product in Stripe called "WeWrite Subscription"
- All subscription tiers (tier1, tier2, tier3, custom) use this same product
- Each subscription creates a unique price with the specific amount

### Benefits

1. **Simplified Catalog**: Only one product to manage in the Stripe dashboard
2. **Flexible Pricing**: Support for any custom amount without creating new products
3. **Better Analytics**: All subscription revenue is tracked under a single product
4. **Reduced Overhead**: No need to manage multiple products for different tiers

## Utility Functions

We've implemented utility functions in `app/utils/stripeProductManager.js` to manage our Stripe products and prices:

### `getSubscriptionProduct()`

- Gets or creates the single subscription product
- Ensures we only have one active product for all subscriptions
- Returns the Stripe product ID

### `createSubscriptionPrice(amount, userId, tier)`

- Creates a dynamic price for the subscription product
- Sets the amount, currency, and recurring interval
- Adds metadata for tracking (userId, tier, amount)
- Returns the Stripe price ID

### `archiveOldPrices(olderThanDays)`

- Archives prices that are older than the specified number of days
- Only archives prices that have no active subscriptions
- Helps keep the Stripe dashboard clean

## Usage in API Routes

All subscription-related API routes use these utility functions to ensure consistent product management:

- `app/api/activate-subscription/route.js`
- `app/api/reactivate-subscription/route.js`

## Maintenance

We've created an admin API route to periodically clean up old prices:

- `app/api/admin/cleanup-stripe-prices/route.js`

This can be called via a cron job or manually by an admin to archive old prices that are no longer in use.

## Environment Variables

For consistency, we recommend setting the following environment variable:

- `STRIPE_SUBSCRIPTION_PRODUCT_ID`: The ID of the single subscription product

If this variable is set, the utility functions will use this product ID instead of searching for or creating a new product.
