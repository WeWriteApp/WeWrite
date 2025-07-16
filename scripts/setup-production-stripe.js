#!/usr/bin/env node

/**
 * Production Stripe Account Setup
 * 
 * This script helps set up Stripe for production use including
 * Connect application configuration, webhook setup, and verification.
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

/**
 * Display setup checklist
 */
function displaySetupChecklist() {
  console.log('🎯 WeWrite Production Stripe Setup Checklist');
  console.log('============================================\n');
  
  const checklist = [
    {
      category: '1. Stripe Account Setup',
      items: [
        'Create Stripe account at https://stripe.com',
        'Complete business verification (may take 1-7 days)',
        'Add business bank account for platform payouts',
        'Enable live payments in Stripe dashboard',
        'Note down live API keys (pk_live_... and sk_live_...)'
      ]
    },
    {
      category: '2. Stripe Connect Configuration',
      items: [
        'Enable Stripe Connect in dashboard',
        'Create Connect application',
        'Configure Express account settings',
        'Set up OAuth redirect URLs',
        'Configure account requirements and capabilities'
      ]
    },
    {
      category: '3. Webhook Configuration',
      items: [
        'Create webhook endpoint for production',
        'Configure webhook events (transfer.*, account.updated, payout.*)',
        'Note down webhook signing secret',
        'Test webhook delivery'
      ]
    },
    {
      category: '4. Environment Configuration',
      items: [
        'Set production environment variables',
        'Configure Firebase for production',
        'Set up monitoring and alerting',
        'Configure rate limiting'
      ]
    },
    {
      category: '5. Testing & Validation',
      items: [
        'Test Express account onboarding',
        'Test payout processing with test accounts',
        'Validate webhook processing',
        'Test error handling and retry logic'
      ]
    }
  ];
  
  checklist.forEach(section => {
    console.log(`📋 ${section.category}`);
    console.log('-'.repeat(section.category.length + 2));
    section.items.forEach(item => {
      console.log(`   ☐ ${item}`);
    });
    console.log('');
  });
}

/**
 * Generate environment configuration
 */
function generateEnvironmentConfig() {
  console.log('⚙️  Production Environment Configuration');
  console.log('=======================================\n');
  
  const config = `# Production Environment Variables for WeWrite Payout System

# Stripe Configuration (LIVE KEYS - KEEP SECURE!)
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_YOUR_PAYOUT_WEBHOOK_SECRET

# Application Configuration
NEXT_PUBLIC_APP_URL=https://www.getwewrite.app
NODE_ENV=production

# Firebase Configuration (Production)
FIREBASE_PROJECT_ID=wewrite-prod
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@wewrite-prod.iam.gserviceaccount.com

# Optional: External Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
DATADOG_API_KEY=your-datadog-api-key

# Security
NEXTAUTH_SECRET=your-nextauth-secret-for-production
NEXTAUTH_URL=https://www.getwewrite.app

# Database
DATABASE_URL=your-production-database-url (if using additional DB)
`;

  console.log(config);
  console.log('⚠️  IMPORTANT SECURITY NOTES:');
  console.log('   • Never commit live API keys to version control');
  console.log('   • Use environment variable management (Vercel, AWS Secrets, etc.)');
  console.log('   • Rotate keys regularly');
  console.log('   • Monitor API key usage in Stripe dashboard');
  console.log('');
}

/**
 * Stripe Connect application setup guide
 */
function displayConnectSetup() {
  console.log('🔗 Stripe Connect Application Setup');
  console.log('===================================\n');
  
  console.log('1. Enable Stripe Connect:');
  console.log('   • Go to https://dashboard.stripe.com/connect/overview');
  console.log('   • Click "Get started with Connect"');
  console.log('   • Choose "Express accounts" for your platform type');
  console.log('');
  
  console.log('2. Configure Connect Application:');
  console.log('   • Application name: "WeWrite"');
  console.log('   • Application description: "Content creator payout platform"');
  console.log('   • Website: https://www.getwewrite.app');
  console.log('   • Support email: support@wewrite.com');
  console.log('');
  
  console.log('3. OAuth Settings:');
  console.log('   • Redirect URI: https://www.getwewrite.app/api/stripe/connect/callback');
  console.log('   • Refresh URL: https://www.getwewrite.app/api/stripe/connect/refresh');
  console.log('   • Webhook URL: https://www.getwewrite.app/api/webhooks/stripe-payouts');
  console.log('');
  
  console.log('4. Account Requirements:');
  console.log('   • Enable: Individual and Company accounts');
  console.log('   • Required capabilities: transfers, card_payments');
  console.log('   • Country availability: US, CA, GB, AU, EU countries');
  console.log('');
  
  console.log('5. Branding:');
  console.log('   • Upload WeWrite logo');
  console.log('   • Set brand colors to match WeWrite theme');
  console.log('   • Configure terms of service URL');
  console.log('');
}

/**
 * Webhook setup guide
 */
function displayWebhookSetup() {
  console.log('🔔 Production Webhook Setup');
  console.log('===========================\n');
  
  console.log('1. Create Webhook Endpoint:');
  console.log('   • Go to https://dashboard.stripe.com/webhooks');
  console.log('   • Click "Add endpoint"');
  console.log('   • URL: https://www.getwewrite.app/api/webhooks/stripe-payouts');
  console.log('   • Description: "WeWrite Payout Webhooks"');
  console.log('');
  
  console.log('2. Configure Events:');
  console.log('   Select these events:');
  console.log('   ☐ transfer.created');
  console.log('   ☐ transfer.paid');
  console.log('   ☐ transfer.failed');
  console.log('   ☐ transfer.reversed');
  console.log('   ☐ account.updated');
  console.log('   ☐ payout.created');
  console.log('   ☐ payout.paid');
  console.log('   ☐ payout.failed');
  console.log('');
  
  console.log('3. Security:');
  console.log('   • Copy the webhook signing secret');
  console.log('   • Add to STRIPE_WEBHOOK_SECRET_PAYOUTS environment variable');
  console.log('   • Test webhook delivery using Stripe CLI or dashboard');
  console.log('');
  
  console.log('4. Monitoring:');
  console.log('   • Set up webhook delivery monitoring');
  console.log('   • Configure alerts for failed deliveries');
  console.log('   • Monitor webhook response times');
  console.log('');
}

/**
 * Testing guide
 */
function displayTestingGuide() {
  console.log('🧪 Production Testing Guide');
  console.log('===========================\n');
  
  console.log('1. Test Account Creation:');
  console.log('   • Create test Express accounts in live mode');
  console.log('   • Test with different countries and account types');
  console.log('   • Verify identity verification flow');
  console.log('');
  
  console.log('2. Test Payout Processing:');
  console.log('   • Use small amounts for initial testing ($1-5)');
  console.log('   • Test with your own bank account first');
  console.log('   • Verify webhook delivery and status updates');
  console.log('');
  
  console.log('3. Test Error Scenarios:');
  console.log('   • Test with invalid bank account details');
  console.log('   • Test with insufficient platform balance');
  console.log('   • Test webhook failure recovery');
  console.log('');
  
  console.log('4. Performance Testing:');
  console.log('   • Test with multiple concurrent payouts');
  console.log('   • Monitor API response times');
  console.log('   • Verify rate limiting works correctly');
  console.log('');
}

/**
 * Security checklist
 */
function displaySecurityChecklist() {
  console.log('🔒 Production Security Checklist');
  console.log('================================\n');
  
  const securityItems = [
    'API keys stored securely (not in code)',
    'Webhook signature verification enabled',
    'HTTPS enforced for all endpoints',
    'Rate limiting configured',
    'Input validation on all endpoints',
    'Error messages don\'t leak sensitive data',
    'Audit logging enabled',
    'Access controls for admin functions',
    'Regular security monitoring',
    'Incident response plan documented'
  ];
  
  securityItems.forEach(item => {
    console.log(`   ☐ ${item}`);
  });
  
  console.log('');
}

/**
 * Go-live checklist
 */
function displayGoLiveChecklist() {
  console.log('🚀 Go-Live Checklist');
  console.log('====================\n');
  
  const goLiveItems = [
    'Stripe account fully verified and activated',
    'Connect application approved and configured',
    'Production webhooks set up and tested',
    'Environment variables configured',
    'Database collections created',
    'Monitoring and alerting configured',
    'Error logging working',
    'Rate limiting tested',
    'Admin tools accessible',
    'Documentation updated',
    'Team trained on admin procedures',
    'Incident response plan ready',
    'Customer support prepared',
    'Legal terms updated for payouts'
  ];
  
  goLiveItems.forEach(item => {
    console.log(`   ☐ ${item}`);
  });
  
  console.log('');
}

/**
 * Main setup function
 */
async function runProductionSetup() {
  try {
    console.log('🎯 WeWrite Production Stripe Setup');
    console.log('==================================\n');
    
    console.log('This script will guide you through setting up Stripe for production use.\n');
    
    const sections = [
      { name: 'Setup Checklist', fn: displaySetupChecklist },
      { name: 'Environment Configuration', fn: generateEnvironmentConfig },
      { name: 'Connect Setup', fn: displayConnectSetup },
      { name: 'Webhook Setup', fn: displayWebhookSetup },
      { name: 'Testing Guide', fn: displayTestingGuide },
      { name: 'Security Checklist', fn: displaySecurityChecklist },
      { name: 'Go-Live Checklist', fn: displayGoLiveChecklist }
    ];
    
    for (const section of sections) {
      const answer = await question(`\nShow ${section.name}? (y/n): `);
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('');
        section.fn();
        await question('Press Enter to continue...');
      }
    }
    
    console.log('\n🎉 Production setup guide complete!');
    console.log('\nNext steps:');
    console.log('1. Complete Stripe account verification');
    console.log('2. Configure Connect application');
    console.log('3. Set up production webhooks');
    console.log('4. Deploy with production environment variables');
    console.log('5. Test with small amounts first');
    console.log('\nFor support: engineering@wewrite.com');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

// Run setup
if (require.main === module) {
  runProductionSetup();
}

module.exports = {
  displaySetupChecklist,
  generateEnvironmentConfig,
  displayConnectSetup,
  displayWebhookSetup,
  displayTestingGuide,
  displaySecurityChecklist,
  displayGoLiveChecklist
};
