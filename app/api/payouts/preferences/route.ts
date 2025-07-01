/**
 * API endpoint for updating payout preferences
 * Handles automatic payout settings and other payout preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { payoutService } from '../../../services/payoutService';
import type { PayoutPreferences } from '../../../types/payout';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get payout recipient and preferences
    const recipient = await payoutService.getPayoutRecipient(userId);
    
    if (!recipient) {
      return NextResponse.json({
        error: 'Payout recipient not found. Please set up payouts first.'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: recipient.payoutPreferences,
      message: 'Payout preferences retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting payout preferences:', error);
    return NextResponse.json({
      error: 'Failed to get payout preferences'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const preferences: Partial<PayoutPreferences> = body;

    // Validate preferences
    if (preferences.minimumThreshold !== undefined) {
      if (typeof preferences.minimumThreshold !== 'number' || preferences.minimumThreshold < 25) {
        return NextResponse.json({
          error: 'Minimum threshold must be at least $25'
        }, { status: 400 });
      }
    }

    if (preferences.currency !== undefined) {
      if (typeof preferences.currency !== 'string' || preferences.currency.length !== 3) {
        return NextResponse.json({
          error: 'Currency must be a valid 3-letter currency code'
        }, { status: 400 });
      }
    }

    if (preferences.schedule !== undefined) {
      if (!['weekly', 'monthly', 'manual'].includes(preferences.schedule)) {
        return NextResponse.json({
          error: 'Schedule must be weekly, monthly, or manual'
        }, { status: 400 });
      }
    }

    if (preferences.autoPayoutEnabled !== undefined) {
      if (typeof preferences.autoPayoutEnabled !== 'boolean') {
        return NextResponse.json({
          error: 'autoPayoutEnabled must be a boolean'
        }, { status: 400 });
      }
    }

    if (preferences.notificationsEnabled !== undefined) {
      if (typeof preferences.notificationsEnabled !== 'boolean') {
        return NextResponse.json({
          error: 'notificationsEnabled must be a boolean'
        }, { status: 400 });
      }
    }

    // Update preferences
    const result = await payoutService.updatePayoutPreferences(userId, preferences);

    if (!result.success) {
      return NextResponse.json({
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.data?.payoutPreferences,
      message: 'Payout preferences updated successfully'
    });

  } catch (error) {
    console.error('Error updating payout preferences:', error);
    return NextResponse.json({
      error: 'Failed to update payout preferences'
    }, { status: 500 });
  }
}