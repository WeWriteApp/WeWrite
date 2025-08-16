# Dual Deployment Setup for Dev Branch

This guide explains how to set up dual deployments for the `dev` branch to test with both development and production data.

## Approach: Two Separate Vercel Projects

Since Vercel doesn't natively support deploying the same branch to multiple environments with different configurations, we'll create two separate Vercel projects:

1. **wewrite-dev** - Uses development data (`dev_` collections)
2. **wewrite-preview** - Uses production data (no prefix)

## Setup Instructions

### 1. Create Two Vercel Projects

You'll need to create two separate Vercel projects in your Vercel dashboard:

#### Project 1: wewrite-dev
- **Name**: `wewrite-dev`
- **Git Repository**: Same repository (WeWriteApp/WeWrite)
- **Branch**: `dev`
- **Environment Variables**: Development configuration

#### Project 2: wewrite-preview  
- **Name**: `wewrite-preview`
- **Git Repository**: Same repository (WeWriteApp/WeWrite)
- **Branch**: `dev`
- **Environment Variables**: Production configuration

### 2. Environment Variables Configuration

#### For wewrite-dev project:
```bash
# Environment Detection
NODE_ENV=development
SUBSCRIPTION_ENV=development
VERCEL_ENV=development

# Firebase (same for both)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_DB_URL=your_db_url
NEXT_PUBLIC_FIREBASE_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_MSNGR_ID=your_messaging_id
NEXT_PUBLIC_FIREBASE_PID=your_project_id

# Stripe (TEST keys for dev)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Google Cloud
GOOGLE_CLOUD_KEY_JSON=your_service_account_json
LOGGING_CLOUD_KEY_JSON=your_logging_service_account_json
```

#### For wewrite-preview project:
```bash
# Environment Detection
NODE_ENV=production
SUBSCRIPTION_ENV=production
VERCEL_ENV=preview

# Firebase (same as dev)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
# ... (same Firebase config)

# Stripe (LIVE keys for preview)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...

# Google Cloud (same as dev)
GOOGLE_CLOUD_KEY_JSON=your_service_account_json
LOGGING_CLOUD_KEY_JSON=your_logging_service_account_json
```

### 3. Custom Domains (Optional)

Set up custom domains for easy access:
- **Dev Environment**: `dev.wewrite.app` or `dev-wewrite.vercel.app`
- **Preview Environment**: `preview.wewrite.app` or `preview-wewrite.vercel.app`

### 4. Webhook Configuration

You'll need separate webhook endpoints for each environment:

#### Stripe Webhooks:
- **Dev**: `https://dev-wewrite.vercel.app/api/webhooks/stripe-subscription`
- **Preview**: `https://preview-wewrite.vercel.app/api/webhooks/stripe-subscription`

## Result

After setup, pushing to the `dev` branch will trigger deployments to both:

1. **Development Environment** (`dev-wewrite.vercel.app`)
   - Uses `dev_` prefixed collections
   - Uses Stripe test keys
   - Safe for testing without affecting production data

2. **Preview Environment** (`preview-wewrite.vercel.app`)
   - Uses production collections (no prefix)
   - Uses Stripe live keys
   - Tests with real production data

## Manual Setup Commands

If you have Vercel CLI installed, you can set this up programmatically:

```bash
# Create dev project
vercel --name wewrite-dev --prod

# Create preview project  
vercel --name wewrite-preview --prod

# Set environment variables for each project
# (Use Vercel dashboard or CLI commands)
```

## Testing

After deployment, verify the environments:

1. **Check Dev Environment**:
   - Visit: `https://dev-wewrite.vercel.app/api/debug/environment`
   - Should show: `prefix: "dev_"`

2. **Check Preview Environment**:
   - Visit: `https://preview-wewrite.vercel.app/api/debug/environment`  
   - Should show: `prefix: ""`

## Benefits

- **Isolated Testing**: Dev environment won't affect production data
- **Production Testing**: Preview environment tests with real data
- **Easy Comparison**: Both environments available simultaneously
- **Safe Rollbacks**: Issues in one environment don't affect the other
