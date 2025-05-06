# Subscription Cleanup API

This API endpoint is designed to perform a one-time cleanup of subscription data in the database. It fixes any inconsistencies in subscription data and ensures all required fields have valid values.

## Purpose

The subscription system has been simplified to remove all the automatic fixing and maintenance code. This endpoint provides a way to clean up any existing data issues before switching to the new simplified system.

## Usage

To run the cleanup process, make a POST request to `/api/cleanup-subscriptions` with an admin API key:

```bash
curl -X POST https://your-domain.com/api/cleanup-subscriptions \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json"
```

## What it does

1. Processes all subscriptions in both the API path (`/subscriptions/{userId}`) and user path (`/users/{userId}/subscription/current`)
2. Ensures all required fields have valid values:
   - `status` (defaults to 'canceled')
   - `amount` (defaults to 0)
   - `tier` (defaults to null)
   - `stripeSubscriptionId` (defaults to null)
3. Fixes any active subscriptions that don't have a valid `stripeSubscriptionId`
4. Ensures subscription data exists in the user path

## Response

The API returns a JSON response with the following structure:

```json
{
  "success": true,
  "message": "Subscription cleanup completed",
  "results": {
    "processed": 42,
    "fixed": 5,
    "errors": 0,
    "details": [
      "Fixed subscription for user abc123",
      "Copied subscription data to user path for xyz789"
    ]
  }
}
```

## Security

This endpoint requires an admin API key to be provided in the Authorization header. The key should be set in the environment variables as `ADMIN_API_KEY`.

## When to use

This endpoint should be used once after deploying the simplified subscription system to clean up any existing data issues. After that, the regular subscription functions should maintain data consistency without needing additional fixing.
