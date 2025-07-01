/**
 * Admin API: Webhook Validation and Cleanup
 * Validates webhook configurations and identifies potential conflicts
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'});

interface WebhookValidationResult {
  webhookEndpoints: Array<{
    id: string;
    url: string;
    status: string;
    events: string[];
    created: number;
    description?: string;
  }>;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    recommendation: string;
  }>;
  duplicateHandlers: Array<{
    event: string;
    handlers: string[];
  }>;
  recommendations: string[];
}

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get all webhook endpoints from Stripe
    const webhookEndpoints = await stripe.webhookEndpoints.list();
    
    const result: WebhookValidationResult = {
      webhookEndpoints: [],
      issues: [],
      duplicateHandlers: [],
      recommendations: []
    };

    // Process webhook endpoints
    for (const endpoint of webhookEndpoints.data) {
      result.webhookEndpoints.push({
        id: endpoint.id,
        url: endpoint.url,
        status: endpoint.status,
        events: endpoint.enabled_events,
        created: endpoint.created,
        description: endpoint.description || undefined
      });
    }

    // Check for duplicate event handlers
    const eventHandlers: { [event: string]: string[] } = {};
    
    for (const endpoint of webhookEndpoints.data) {
      for (const event of endpoint.enabled_events) {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(endpoint.url);
      }
    }

    // Identify duplicates
    for (const [event, handlers] of Object.entries(eventHandlers)) {
      if (handlers.length > 1) {
        result.duplicateHandlers.push({
          event,
          handlers
        });
        
        result.issues.push({
          type: 'error',
          severity: 'critical',
          title: `Duplicate webhook handlers for ${event}`,
          description: `Multiple endpoints are configured to handle ${event}: ${handlers.join(', ')}`,
          recommendation: 'Remove duplicate webhook endpoints or consolidate event handling to prevent data inconsistencies'
        });
      }
    }

    // Check for critical missing events
    const criticalEvents = [
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.deleted'
    ];

    for (const event of criticalEvents) {
      if (!eventHandlers[event] || eventHandlers[event].length === 0) {
        result.issues.push({
          type: 'error',
          severity: 'high',
          title: `Missing webhook handler for ${event}`,
          description: `No webhook endpoint is configured to handle ${event}`,
          recommendation: `Configure a webhook endpoint to handle ${event} to ensure proper payment processing`
        });
      }
    }

    // Check for disabled endpoints
    const disabledEndpoints = webhookEndpoints.data.filter(ep => ep.status === 'disabled');
    if (disabledEndpoints.length > 0) {
      result.issues.push({
        type: 'warning',
        severity: 'medium',
        title: `${disabledEndpoints.length} disabled webhook endpoint(s)`,
        description: `Some webhook endpoints are disabled: ${disabledEndpoints.map(ep => ep.url).join(', ')}`,
        recommendation: 'Review disabled endpoints and remove them if no longer needed'
      });
    }

    // Check for old endpoints (older than 6 months)
    const sixMonthsAgo = Date.now() / 1000 - (6 * 30 * 24 * 60 * 60);
    const oldEndpoints = webhookEndpoints.data.filter(ep => ep.created < sixMonthsAgo);
    if (oldEndpoints.length > 0) {
      result.issues.push({
        type: 'info',
        severity: 'low',
        title: `${oldEndpoints.length} old webhook endpoint(s)`,
        description: `Some webhook endpoints are older than 6 months`,
        recommendation: 'Review old endpoints to ensure they are still needed and properly maintained'
      });
    }

    // Check for development/test endpoints in production
    const testEndpoints = webhookEndpoints.data.filter(ep => 
      ep.url.includes('localhost') || 
      ep.url.includes('ngrok') || 
      ep.url.includes('test') ||
      ep.url.includes('dev')
    );
    
    if (testEndpoints.length > 0 && process.env.NODE_ENV === 'production') {
      result.issues.push({
        type: 'error',
        severity: 'high',
        title: `${testEndpoints.length} test/development webhook endpoint(s) in production`,
        description: `Development endpoints detected in production: ${testEndpoints.map(ep => ep.url).join(', ')}`,
        recommendation: 'Remove development/test webhook endpoints from production environment'
      });
    }

    // Generate recommendations
    if (result.duplicateHandlers.length > 0) {
      result.recommendations.push('Consolidate duplicate webhook handlers to prevent race conditions and data inconsistencies');
    }

    if (result.issues.filter(i => i.severity === 'critical').length > 0) {
      result.recommendations.push('Address critical webhook issues immediately to prevent payment processing failures');
    }

    if (webhookEndpoints.data.length > 5) {
      result.recommendations.push('Consider consolidating webhook endpoints to reduce complexity and improve maintainability');
    }

    result.recommendations.push('Implement webhook event logging and monitoring for better observability');
    result.recommendations.push('Set up webhook signature verification for all endpoints');
    result.recommendations.push('Implement idempotency handling to prevent duplicate processing');

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error validating webhooks:', error);
    return NextResponse.json({
      error: 'Failed to validate webhooks',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { action, webhookId } = await request.json();

    switch (action) {
      case 'disable_webhook':
        if (!webhookId) {
          return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
        }
        
        await stripe.webhookEndpoints.update(webhookId, {
          disabled: true
        });
        
        return NextResponse.json({
          success: true,
          message: `Webhook ${webhookId} disabled successfully`
        });

      case 'delete_webhook':
        if (!webhookId) {
          return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
        }
        
        await stripe.webhookEndpoints.del(webhookId);
        
        return NextResponse.json({
          success: true,
          message: `Webhook ${webhookId} deleted successfully`
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error managing webhook:', error);
    return NextResponse.json({
      error: 'Failed to manage webhook',
      details: error.message
    }, { status: 500 });
  }
}