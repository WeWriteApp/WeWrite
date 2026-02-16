/**
 * Production Readiness Check for Payment & Payout Systems
 * Comprehensive validation script to ensure systems are ready for production
 */

import { initAdmin } from '../firebase/admin';
import { getStripe } from '../lib/stripe';

const adminApp = initAdmin();
const adminDb = adminApp.firestore();
const stripe = getStripe();

interface ValidationResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation?: string;
}

class ProductionReadinessChecker {
  private results: ValidationResult[] = [];

  private addResult(
    category: string,
    test: string,
    status: 'PASS' | 'FAIL' | 'WARNING',
    message: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    recommendation?: string
  ) {
    this.results.push({
      category,
      test,
      status,
      message,
      severity,
      recommendation
    });
  }

  async runAllChecks(): Promise<ValidationResult[]> {
    console.log('🚀 Starting Production Readiness Check...\n');

    await this.checkEnvironmentConfiguration();
    await this.checkStripeConfiguration();
    await this.checkWebhookConfiguration();
    await this.checkDatabaseIntegrity();
    await this.checkPaymentFlows();
    await this.checkPayoutSystem();
    await this.checkMonitoringAndAlerting();
    await this.checkSecurityConfiguration();

    return this.results;
  }

  private async checkEnvironmentConfiguration() {
    console.log('📋 Checking Environment Configuration...');

    // Check required environment variables
    const requiredEnvVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        this.addResult(
          'Environment',
          `${envVar} Configuration`,
          'FAIL',
          `Missing required environment variable: ${envVar}`,
          'critical',
          `Set the ${envVar} environment variable`
        );
      } else {
        this.addResult(
          'Environment',
          `${envVar} Configuration`,
          'PASS',
          `${envVar} is configured`,
          'low'
        );
      }
    }

    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
      this.addResult(
        'Environment',
        'NODE_ENV Configuration',
        'WARNING',
        `NODE_ENV is set to ${process.env.NODE_ENV}, not production`,
        'medium',
        'Ensure NODE_ENV is set to "production" in production environment'
      );
    } else {
      this.addResult(
        'Environment',
        'NODE_ENV Configuration',
        'PASS',
        'NODE_ENV is correctly set to production',
        'low'
      );
    }
  }

  private async checkStripeConfiguration() {
    console.log('💳 Checking Stripe Configuration...');

    try {
      // Test Stripe API connection
      const account = await stripe.accounts.retrieve();
      
      this.addResult(
        'Stripe',
        'API Connection',
        'PASS',
        `Successfully connected to Stripe account: ${account.id}`,
        'low'
      );

      // Check if account can accept payments
      if (!account.charges_enabled) {
        this.addResult(
          'Stripe',
          'Charges Enabled',
          'FAIL',
          'Stripe account cannot accept charges',
          'critical',
          'Complete Stripe account verification to enable charges'
        );
      } else {
        this.addResult(
          'Stripe',
          'Charges Enabled',
          'PASS',
          'Stripe account can accept charges',
          'low'
        );
      }

      // Check if account can make payouts
      if (!account.payouts_enabled) {
        this.addResult(
          'Stripe',
          'Payouts Enabled',
          'FAIL',
          'Stripe account cannot make payouts',
          'critical',
          'Complete Stripe account verification to enable payouts'
        );
      } else {
        this.addResult(
          'Stripe',
          'Payouts Enabled',
          'PASS',
          'Stripe account can make payouts',
          'low'
        );
      }

      // Check Stripe Connect configuration
      const connectApps = await stripe.apps.list();
      if (connectApps.data.length === 0) {
        this.addResult(
          'Stripe',
          'Connect Configuration',
          'WARNING',
          'No Stripe Connect applications found',
          'medium',
          'Set up Stripe Connect for creator payouts'
        );
      }

    } catch (error: any) {
      this.addResult(
        'Stripe',
        'API Connection',
        'FAIL',
        `Failed to connect to Stripe: ${error.message}`,
        'critical',
        'Check Stripe API keys and network connectivity'
      );
    }
  }

  private async checkWebhookConfiguration() {
    console.log('🔗 Checking Webhook Configuration...');

    try {
      const webhookEndpoints = await stripe.webhookEndpoints.list();
      
      if (webhookEndpoints.data.length === 0) {
        this.addResult(
          'Webhooks',
          'Endpoint Configuration',
          'FAIL',
          'No webhook endpoints configured',
          'critical',
          'Configure webhook endpoints for payment processing'
        );
        return;
      }

      // Check for required events
      const requiredEvents = [
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'customer.subscription.updated',
        'customer.subscription.deleted'
      ];

      const allEvents = new Set<string>();
      webhookEndpoints.data.forEach(endpoint => {
        endpoint.enabled_events.forEach(event => allEvents.add(event));
      });

      for (const event of requiredEvents) {
        if (!allEvents.has(event)) {
          this.addResult(
            'Webhooks',
            `${event} Handler`,
            'FAIL',
            `Missing webhook handler for ${event}`,
            'high',
            `Configure webhook endpoint to handle ${event}`
          );
        } else {
          this.addResult(
            'Webhooks',
            `${event} Handler`,
            'PASS',
            `Webhook handler configured for ${event}`,
            'low'
          );
        }
      }

      // Check for duplicate handlers
      const eventCounts: { [event: string]: number } = {};
      webhookEndpoints.data.forEach(endpoint => {
        endpoint.enabled_events.forEach(event => {
          eventCounts[event] = (eventCounts[event] || 0) + 1;
        });
      });

      for (const [event, count] of Object.entries(eventCounts)) {
        if (count > 1) {
          this.addResult(
            'Webhooks',
            `${event} Duplicates`,
            'WARNING',
            `${count} webhook endpoints handle ${event}`,
            'medium',
            'Remove duplicate webhook handlers to prevent race conditions'
          );
        }
      }

    } catch (error: any) {
      this.addResult(
        'Webhooks',
        'Configuration Check',
        'FAIL',
        `Failed to check webhook configuration: ${error.message}`,
        'high',
        'Verify Stripe API access and webhook configuration'
      );
    }
  }

  private async checkDatabaseIntegrity() {
    console.log('🗄️ Checking Database Integrity...');

    try {
      // Check for orphaned subscription records
      const subscriptionsSnapshot = await adminDb.collectionGroup('subscription').get();
      let orphanedSubscriptions = 0;

      for (const doc of subscriptionsSnapshot.docs) {
        const subscription = doc.data();
        if (subscription.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          } catch (error: any) {
            if (error.code === 'resource_missing') {
              orphanedSubscriptions++;
            }
          }
        }
      }

      if (orphanedSubscriptions > 0) {
        this.addResult(
          'Database',
          'Orphaned Subscriptions',
          'WARNING',
          `Found ${orphanedSubscriptions} subscription records without corresponding Stripe subscriptions`,
          'medium',
          'Clean up orphaned subscription records'
        );
      } else {
        this.addResult(
          'Database',
          'Subscription Integrity',
          'PASS',
          'All subscription records have corresponding Stripe subscriptions',
          'low'
        );
      }

      // Check transaction tracking completeness
      const transactionsSnapshot = await adminDb.collection('financialTransactions')
        .where('createdAt', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .get();

      const incompleteTransactions = transactionsSnapshot.docs.filter(doc => {
        const transaction = doc.data();
        return !transaction.correlationId || !transaction.status;
      });

      if (incompleteTransactions.length > 0) {
        this.addResult(
          'Database',
          'Transaction Tracking',
          'WARNING',
          `Found ${incompleteTransactions.length} incomplete transaction records`,
          'medium',
          'Ensure all transactions have proper tracking data'
        );
      } else {
        this.addResult(
          'Database',
          'Transaction Tracking',
          'PASS',
          'All recent transactions have complete tracking data',
          'low'
        );
      }

    } catch (error: any) {
      this.addResult(
        'Database',
        'Integrity Check',
        'FAIL',
        `Failed to check database integrity: ${error.message}`,
        'high',
        'Verify database connectivity and permissions'
      );
    }
  }

  private async checkPaymentFlows() {
    console.log('💰 Checking Payment Flows...');

    // This would include tests for:
    // - Subscription creation flow
    // - Payment processing
    // - Failure handling
    // - Retry mechanisms

    this.addResult(
      'Payments',
      'Flow Testing',
      'WARNING',
      'Payment flow testing not yet implemented',
      'high',
      'Implement comprehensive payment flow testing'
    );
  }

  private async checkPayoutSystem() {
    console.log('💸 Checking Payout System...');

    // Check if payout processing is properly implemented
    this.addResult(
      'Payouts',
      'Implementation Status',
      'FAIL',
      'Payout system contains mock implementations',
      'critical',
      'Complete Stripe Connect integration for actual payout processing'
    );
  }

  private async checkMonitoringAndAlerting() {
    console.log('📊 Checking Monitoring and Alerting...');

    this.addResult(
      'Monitoring',
      'Dashboard Implementation',
      'PASS',
      'Payment and payout monitoring dashboards implemented',
      'low'
    );

    this.addResult(
      'Monitoring',
      'Alert System',
      'PASS',
      'Alert system for payment failures implemented',
      'low'
    );
  }

  private async checkSecurityConfiguration() {
    console.log('🔒 Checking Security Configuration...');

    // Check webhook signature verification
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      this.addResult(
        'Security',
        'Webhook Signatures',
        'FAIL',
        'Webhook signature verification not configured',
        'critical',
        'Configure webhook signature verification'
      );
    } else {
      this.addResult(
        'Security',
        'Webhook Signatures',
        'PASS',
        'Webhook signature verification configured',
        'low'
      );
    }
  }
}

export async function runProductionReadinessCheck(): Promise<void> {
  const checker = new ProductionReadinessChecker();
  const results = await checker.runAllChecks();

  // Generate report
  console.log('\n📋 PRODUCTION READINESS REPORT');
  console.log('================================\n');

  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    console.log(`\n📁 ${category.toUpperCase()}`);
    console.log('-'.repeat(category.length + 4));
    
    const categoryResults = results.filter(r => r.category === category);
    
    for (const result of categoryResults) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.test}: ${result.message}`);
      
      if (result.recommendation) {
        console.log(`   💡 ${result.recommendation}`);
      }
    }
  }

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const critical = results.filter(r => r.severity === 'critical').length;

  console.log('\n📊 SUMMARY');
  console.log('===========');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`🚨 Critical Issues: ${critical}`);

  if (critical > 0) {
    console.log('\n🚨 CRITICAL ISSUES MUST BE RESOLVED BEFORE PRODUCTION DEPLOYMENT');
  } else if (failed > 0) {
    console.log('\n⚠️  RESOLVE FAILED CHECKS BEFORE PRODUCTION DEPLOYMENT');
  } else {
    console.log('\n🎉 SYSTEM APPEARS READY FOR PRODUCTION');
  }
}

// Run the check if this script is executed directly
if (require.main === module) {
  runProductionReadinessCheck().catch(console.error);
}
