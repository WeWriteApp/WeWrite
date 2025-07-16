#!/usr/bin/env node

/**
 * WeWrite Payout Webhook Setup Script
 * 
 * This script configures Stripe webhook endpoints for payout functionality.
 * It creates the necessary webhook endpoints and provides the secrets needed
 * for environment configuration.
 */

const https = require('https');
const { URL } = require('url');

// Configuration
const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.getwewrite.app';

// Required webhook events for payouts
const PAYOUT_WEBHOOK_EVENTS = [
  'transfer.created',
  'transfer.paid', 
  'transfer.failed',
  'account.updated',
  'payout.created',
  'payout.paid',
  'payout.failed'
];

// Required webhook events for subscriptions (existing)
const SUBSCRIPTION_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated', 
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed'
];

/**
 * Make authenticated request to Stripe API
 */
function makeStripeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    if (!STRIPE_SECRET_KEY) {
      reject(new Error('STRIPE_SECRET_KEY environment variable is required'));
      return;
    }

    const url = new URL(path, STRIPE_API_BASE);
    const auth = Buffer.from(`${STRIPE_SECRET_KEY}:`).toString('base64');
    
    const options = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`Stripe API Error: ${response.error?.message || 'Unknown error'}`));
          } else {
            resolve(response);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

/**
 * List existing webhook endpoints
 */
async function listWebhooks() {
  try {
    console.log('📋 Listing existing webhook endpoints...\n');
    
    const response = await makeStripeRequest('GET', '/webhook_endpoints');
    
    if (response.data.length === 0) {
      console.log('   No webhook endpoints found.');
      return [];
    }
    
    response.data.forEach((webhook, index) => {
      console.log(`   ${index + 1}. ${webhook.url}`);
      console.log(`      ID: ${webhook.id}`);
      console.log(`      Status: ${webhook.status}`);
      console.log(`      Events: ${webhook.enabled_events.length} configured`);
      console.log(`      Created: ${new Date(webhook.created * 1000).toISOString()}`);
      console.log('');
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error listing webhooks:', error.message);
    throw error;
  }
}

/**
 * Create payout webhook endpoint
 */
async function createPayoutWebhook() {
  try {
    console.log('🚀 Creating payout webhook endpoint...');
    
    const webhookUrl = `${BASE_URL}/api/webhooks/stripe-payouts`;
    
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('url', webhookUrl);
    formData.append('description', 'WeWrite Payout Webhook - Transfer and Account Events');
    
    // Add payout-specific events
    PAYOUT_WEBHOOK_EVENTS.forEach(event => {
      formData.append('enabled_events[]', event);
    });
    
    const response = await makeStripeRequest('POST', '/webhook_endpoints', formData.toString());
    
    console.log('✅ Payout webhook created successfully!');
    console.log(`   ID: ${response.id}`);
    console.log(`   URL: ${response.url}`);
    console.log(`   Secret: ${response.secret}`);
    console.log(`   Events: ${response.enabled_events.length} events configured`);
    
    return response;
  } catch (error) {
    console.error('❌ Error creating payout webhook:', error.message);
    throw error;
  }
}

/**
 * Create subscription webhook endpoint (if not exists)
 */
async function createSubscriptionWebhook() {
  try {
    console.log('🚀 Creating subscription webhook endpoint...');
    
    const webhookUrl = `${BASE_URL}/api/webhooks/stripe-subscription`;
    
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('url', webhookUrl);
    formData.append('description', 'WeWrite Subscription Webhook - Payment and Subscription Events');
    
    // Add subscription-specific events
    SUBSCRIPTION_WEBHOOK_EVENTS.forEach(event => {
      formData.append('enabled_events[]', event);
    });
    
    const response = await makeStripeRequest('POST', '/webhook_endpoints', formData.toString());
    
    console.log('✅ Subscription webhook created successfully!');
    console.log(`   ID: ${response.id}`);
    console.log(`   URL: ${response.url}`);
    console.log(`   Secret: ${response.secret}`);
    console.log(`   Events: ${response.enabled_events.length} events configured`);
    
    return response;
  } catch (error) {
    console.error('❌ Error creating subscription webhook:', error.message);
    throw error;
  }
}

/**
 * Test webhook endpoint health
 */
async function testWebhookHealth(endpoint) {
  try {
    console.log(`🏥 Testing webhook endpoint: ${endpoint}`);
    
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec(`curl -s "${endpoint}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Health check failed for ${endpoint}:`, error.message);
          reject(error);
          return;
        }
        
        try {
          const response = JSON.parse(stdout);
          console.log(`✅ ${endpoint} is healthy!`);
          console.log(`   Status: ${response.status}`);
          console.log(`   Service: ${response.service}`);
          resolve(response);
        } catch (e) {
          console.error(`❌ Invalid response from ${endpoint}:`, stdout);
          reject(e);
        }
      });
    });
  } catch (error) {
    console.error(`❌ Error testing ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Main setup function
 */
async function setupWebhooks() {
  try {
    console.log('🎯 WeWrite Payout Webhook Setup');
    console.log('================================\n');
    
    // Check prerequisites
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log(`🔑 Stripe Key: ${STRIPE_SECRET_KEY.substring(0, 12)}...`);
    console.log('');
    
    // Test webhook endpoints
    console.log('🏥 Testing webhook endpoint health...\n');
    await testWebhookHealth(`${BASE_URL}/api/webhooks/stripe-payouts`);
    await testWebhookHealth(`${BASE_URL}/api/webhooks/stripe-subscription`);
    console.log('');
    
    // List existing webhooks
    const existingWebhooks = await listWebhooks();
    
    // Check if webhooks already exist
    const payoutWebhookExists = existingWebhooks.some(w => 
      w.url.includes('/api/webhooks/stripe-payouts')
    );
    const subscriptionWebhookExists = existingWebhooks.some(w => 
      w.url.includes('/api/webhooks/stripe-subscription')
    );
    
    const results = {};
    
    // Create payout webhook if needed
    if (!payoutWebhookExists) {
      console.log('Creating payout webhook...\n');
      results.payoutWebhook = await createPayoutWebhook();
      console.log('');
    } else {
      console.log('✅ Payout webhook already exists\n');
    }
    
    // Create subscription webhook if needed
    if (!subscriptionWebhookExists) {
      console.log('Creating subscription webhook...\n');
      results.subscriptionWebhook = await createSubscriptionWebhook();
      console.log('');
    } else {
      console.log('✅ Subscription webhook already exists\n');
    }
    
    // Display environment variable instructions
    console.log('🔑 ENVIRONMENT VARIABLES NEEDED:');
    console.log('================================\n');
    
    if (results.payoutWebhook) {
      console.log('Add this to your .env.local file:');
      console.log(`STRIPE_WEBHOOK_SECRET_PAYOUTS=${results.payoutWebhook.secret}`);
      console.log('');
    }
    
    if (results.subscriptionWebhook) {
      console.log('Add this to your .env.local file:');
      console.log(`STRIPE_WEBHOOK_SECRET=${results.subscriptionWebhook.secret}`);
      console.log('');
    }
    
    if (!results.payoutWebhook && !results.subscriptionWebhook) {
      console.log('All webhooks already configured! ✅');
    }
    
    console.log('🎉 Webhook setup complete!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupWebhooks();
}

module.exports = { setupWebhooks, listWebhooks, createPayoutWebhook, createSubscriptionWebhook };
