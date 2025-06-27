#!/usr/bin/env node

/**
 * Webhook Management Script
 * Manages Stripe webhooks via API calls
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

// Load environment variables from .env.local
function loadEnvFile(filename) {
  try {
    const envPath = path.join(__dirname, '..', filename);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      console.log(`📄 Loaded environment variables from ${filename}`);
    }
  } catch (error) {
    console.log(`⚠️  Could not load ${filename}: ${error.message}`);
  }
}

// Load environment files in order of precedence
loadEnvFile('.env.local');
loadEnvFile('.env.development');
loadEnvFile('.env');

// Get Stripe secret key from environment
const stripeSecretKey = process.env.STRIPE_SECRET_KEY ||
                       process.env.STRIPE_TEST_SECRET_KEY ||
                       process.env.STRIPE_PROD_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ No Stripe secret key found in environment variables');
  console.error('   Please set one of: STRIPE_SECRET_KEY, STRIPE_TEST_SECRET_KEY, or STRIPE_PROD_SECRET_KEY');
  process.exit(1);
}

console.log(`🔑 Using Stripe key: ${stripeSecretKey.substring(0, 8)}...`);

/**
 * Make authenticated request to Stripe API
 */
function makeStripeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      port: 443,
      path: `/v1${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Stripe API Error: ${parsed.error?.message || responseData}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

/**
 * List all webhook endpoints
 */
async function listWebhooks() {
  try {
    console.log('📋 Fetching current webhook endpoints...');
    const response = await makeStripeRequest('GET', '/webhook_endpoints');
    
    console.log(`\n✅ Found ${response.data.length} webhook endpoints:\n`);
    
    response.data.forEach((webhook, index) => {
      console.log(`${index + 1}. ${webhook.url}`);
      console.log(`   ID: ${webhook.id}`);
      console.log(`   Status: ${webhook.status}`);
      console.log(`   Events: ${webhook.enabled_events.length} events`);
      console.log(`   Created: ${new Date(webhook.created * 1000).toISOString()}`);
      console.log('');
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error listing webhooks:', error.message);
    throw error;
  }
}

/**
 * Create webhook for existing endpoint
 */
async function createExistingWebhook() {
  try {
    console.log('🚀 Creating webhook for existing stripe-subscription endpoint...');

    // Define all events we need to handle
    const events = [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed'
    ];

    // Use existing endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getwewrite.app';
    const webhookUrl = `${baseUrl}/api/webhooks/stripe-subscription`;

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('url', webhookUrl);
    formData.append('description', 'WeWrite Subscription Webhook - Main Events');

    // Add all events
    events.forEach(event => {
      formData.append('enabled_events[]', event);
    });

    const response = await makeStripeRequest('POST', '/webhook_endpoints', formData.toString());

    console.log('✅ Subscription webhook created successfully!');
    console.log(`   ID: ${response.id}`);
    console.log(`   URL: ${response.url}`);
    console.log(`   Secret: ${response.secret}`);
    console.log(`   Events: ${response.enabled_events.length} events configured`);

    console.log('\n🔑 IMPORTANT: Add this to your environment variables:');
    console.log(`STRIPE_WEBHOOK_SECRET=${response.secret}`);

    return response;
  } catch (error) {
    console.error('❌ Error creating subscription webhook:', error.message);
    throw error;
  }
}

/**
 * Create unified webhook endpoint
 */
async function createUnifiedWebhook() {
  try {
    console.log('🚀 Creating unified webhook endpoint...');
    
    // Define all events we need to handle
    const events = [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'transfer.created',
      'transfer.paid',
      'transfer.failed',
      'account.updated'
    ];
    
    // Determine the base URL (use www subdomain)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getwewrite.app';
    const webhookUrl = `${baseUrl}/api/webhooks/stripe-unified`;
    
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('url', webhookUrl);
    formData.append('description', 'WeWrite Unified Webhook - All Events');
    
    // Add all events
    events.forEach(event => {
      formData.append('enabled_events[]', event);
    });
    
    const response = await makeStripeRequest('POST', '/webhook_endpoints', formData.toString());
    
    console.log('✅ Unified webhook created successfully!');
    console.log(`   ID: ${response.id}`);
    console.log(`   URL: ${response.url}`);
    console.log(`   Secret: ${response.secret}`);
    console.log(`   Events: ${response.enabled_events.length} events configured`);
    
    console.log('\n🔑 IMPORTANT: Add this to your environment variables:');
    console.log(`STRIPE_WEBHOOK_SECRET=${response.secret}`);
    
    return response;
  } catch (error) {
    console.error('❌ Error creating unified webhook:', error.message);
    throw error;
  }
}

/**
 * Test webhook endpoint health
 */
async function testWebhookHealth() {
  try {
    console.log('🏥 Testing webhook endpoint health...');
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getwewrite.app';
    const healthUrl = `${baseUrl}/api/webhooks/stripe-unified`;
    
    // Use curl to test the endpoint
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec(`curl -s "${healthUrl}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Health check failed:', error.message);
          reject(error);
          return;
        }
        
        try {
          const response = JSON.parse(stdout);
          console.log('✅ Webhook endpoint is healthy!');
          console.log(`   Status: ${response.status}`);
          console.log(`   Service: ${response.service}`);
          console.log(`   Environment: ${response.environment}`);
          console.log(`   Webhook Secret: ${response.webhookSecret}`);
          resolve(response);
        } catch (e) {
          console.error('❌ Invalid response from webhook endpoint:', stdout);
          reject(e);
        }
      });
    });
  } catch (error) {
    console.error('❌ Error testing webhook health:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'list':
        await listWebhooks();
        break;
        
      case 'create':
        await testWebhookHealth();
        await createUnifiedWebhook();
        break;

      case 'create-existing':
        await createExistingWebhook();
        break;
        
      case 'test':
        await testWebhookHealth();
        break;
        
      default:
        console.log('📚 Webhook Management Commands:');
        console.log('');
        console.log('  node scripts/manage-webhooks.cjs list           - List all webhook endpoints');
        console.log('  node scripts/manage-webhooks.cjs create         - Create unified webhook endpoint');
        console.log('  node scripts/manage-webhooks.cjs create-existing - Create webhook for existing endpoint');
        console.log('  node scripts/manage-webhooks.cjs test           - Test webhook endpoint health');
        console.log('');
        break;
    }
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
