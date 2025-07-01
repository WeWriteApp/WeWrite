/**
 * Admin API: Fix Webhook Duplicates
 * CRITICAL: Removes duplicate webhook handlers to prevent data corruption
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { action, confirm } = await request.json();

    if (action === 'disable_legacy_webhook' && confirm === 'DISABLE_LEGACY_WEBHOOK') {
      // This is a critical operation that should disable the legacy webhook handler
      // The legacy handler is at /api/webhooks/stripe/route.js
      
      // For safety, we'll create a flag file instead of deleting the route
      const fs = require('fs').promises;
      const path = require('path');
      
      const flagPath = path.join(process.cwd(), 'app/api/webhooks/stripe/.disabled');
      
      try {
        await fs.writeFile(flagPath, JSON.stringify({
          disabledAt: new Date().toISOString(),
          reason: 'Disabled due to duplicate webhook handling',
          disabledBy: 'admin-webhook-cleanup'
        }));

        return NextResponse.json({
          success: true,
          message: 'Legacy webhook handler disabled successfully',
          action: 'created_disable_flag',
          recommendation: 'Monitor payment processing for 24 hours, then remove the legacy webhook file if no issues occur'
        });
      } catch (error: any) {
        return NextResponse.json({
          error: 'Failed to disable legacy webhook',
          details: error.message
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      error: 'Invalid action or missing confirmation',
      requiredConfirmation: 'DISABLE_LEGACY_WEBHOOK'
    }, { status: 400 });

  } catch (error: any) {
    console.error('Error fixing webhook duplicates:', error);
    return NextResponse.json({
      error: 'Failed to fix webhook duplicates',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Check if legacy webhook is disabled
    const fs = require('fs').promises;
    const path = require('path');
    
    const flagPath = path.join(process.cwd(), 'app/api/webhooks/stripe/.disabled');
    
    try {
      const flagContent = await fs.readFile(flagPath, 'utf8');
      const flagData = JSON.parse(flagContent);
      
      return NextResponse.json({
        success: true,
        legacyWebhookDisabled: true,
        disabledAt: flagData.disabledAt,
        reason: flagData.reason
      });
    } catch (error) {
      return NextResponse.json({
        success: true,
        legacyWebhookDisabled: false,
        message: 'Legacy webhook is still active'
      });
    }

  } catch (error: any) {
    console.error('Error checking webhook status:', error);
    return NextResponse.json({
      error: 'Failed to check webhook status',
      details: error.message
    }, { status: 500 });
  }
}