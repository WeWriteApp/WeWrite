/**
 * Admin Send Notification API
 *
 * Sends a specific notification to a specific user.
 * Used by the admin notifications page to manually trigger emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { PRODUCTION_URL } from '../../../utils/urlConfig';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { randomUUID } from 'crypto';
import { sendTemplatedEmail } from '../../../services/emailService';
import { withAdminContext } from '../../../utils/adminRequestContext';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Wrap the entire handler with admin context for proper environment detection
  return withAdminContext(request, async () => {
  try {
    // Verify admin access using session cookie
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { templateId, userId, scheduledAt } = body;

    if (!templateId || !userId) {
      return NextResponse.json({ error: 'templateId and userId required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();
    const envType = getEnvironmentType();

    // IMPORTANT: Check if we're forcing production data via header
    // When admin is using localhost but targeting prod data, we MUST use production URLs
    // Otherwise prod users would get emails with localhost links!
    const forceProductionData = request.headers.get('x-force-production-data') === 'true';
    const baseUrl = (envType === 'production' || forceProductionData)
      ? PRODUCTION_URL
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Get user data
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    if (!userData.email) {
      return NextResponse.json({ error: 'User has no email' }, { status: 400 });
    }

    // Build template data based on templateId
    let templateData: Record<string, any> = {
      username: userData.username || `user_${userId.slice(0, 8)}`,
    };

    // Handle template-specific data
    switch (templateId) {
      case 'verification-reminder':
      case 'email-verification-reminder': {
        // Generate verification token
        const verificationToken = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.collection(getCollectionName('email_verification_tokens')).doc(verificationToken).set({
          userId,
          email: userData.email,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt,
          used: false,
          type: 'admin-triggered'
        });

        templateData.verificationLink = `${baseUrl}/auth/verify-email?token=${verificationToken}`;
        break;
      }

      case 'choose-username':
      case 'username-reminder': {
        templateData.profileLink = `${baseUrl}/settings/profile`;
        break;
      }

      case 'verify-to-choose-username': {
        // Generate verification token for combined verify + username email
        const verificationToken = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.collection(getCollectionName('email_verification_tokens')).doc(verificationToken).set({
          userId,
          email: userData.email,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt,
          used: false,
          type: 'verify-to-choose-username'
        });

        templateData.currentUsername = userData.username || `user_${userId.slice(0, 8)}`;
        templateData.verificationLink = `${baseUrl}/auth/verify-email?token=${verificationToken}`;
        break;
      }

      case 'payout-setup-reminder': {
        // Get balance info
        const balanceDoc = await db.collection(getCollectionName('writerUsdBalances')).doc(userId).get();
        const balanceData = balanceDoc.exists ? balanceDoc.data() : null;
        templateData.pendingAmount = balanceData?.pendingUsdCents
          ? `$${(balanceData.pendingUsdCents / 100).toFixed(2)}`
          : '$0.00';
        templateData.setupLink = `${baseUrl}/settings/payouts`;
        break;
      }

      case 'first-page-activation': {
        templateData.createPageLink = `${baseUrl}/new`;
        break;
      }

      case 'reactivation': {
        templateData.exploreLink = `${baseUrl}/explore`;
        break;
      }

      case 'weekly-digest': {
        // Would need to compute actual digest data - for now just basic data
        templateData.weeklyStats = {
          views: 0,
          reactions: 0,
          newFollowers: 0,
        };
        templateData.dashboardLink = `${baseUrl}/dashboard`;
        break;
      }

      default:
        // Generic template - just username
        break;
    }

    // Normalize templateId for the email service
    const normalizedTemplateId = templateId === 'email-verification-reminder'
      ? 'verification-reminder'
      : templateId;

    // Send the email
    const result = await sendTemplatedEmail({
      templateId: normalizedTemplateId,
      to: userData.email,
      data: templateData,
      userId,
      scheduledAt,
      triggerSource: 'admin',
    });

    if (result.success) {
      // Mark this notification as sent on the user document to prevent duplicates
      // This updates the same flags that cron jobs check to skip already-sent notifications
      const userUpdateData: Record<string, any> = {};

      switch (templateId) {
        case 'verification-reminder':
        case 'email-verification-reminder':
          userUpdateData.verificationReminderSentAt = admin.firestore.FieldValue.serverTimestamp();
          break;
        case 'choose-username':
        case 'username-reminder':
          userUpdateData.usernameReminderSent = true;
          userUpdateData.usernameReminderSentAt = admin.firestore.FieldValue.serverTimestamp();
          break;
        case 'payout-setup-reminder':
          userUpdateData.payoutReminderSentAt = admin.firestore.FieldValue.serverTimestamp();
          break;
        case 'first-page-activation':
          userUpdateData.firstPageActivationSent = true;
          userUpdateData.firstPageActivationSentAt = admin.firestore.FieldValue.serverTimestamp();
          break;
        case 'reactivation':
          userUpdateData.reactivationEmailSentAt = admin.firestore.FieldValue.serverTimestamp();
          break;
        case 'verify-to-choose-username':
          userUpdateData.verifyToChooseUsernameSentAt = admin.firestore.FieldValue.serverTimestamp();
          break;
        // weekly-digest doesn't need a flag as it's expected to be sent weekly
      }

      // Only update if we have flags to set
      if (Object.keys(userUpdateData).length > 0) {
        await db.collection(getCollectionName('users')).doc(userId).update(userUpdateData);
      }

      return NextResponse.json({
        success: true,
        templateId,
        userId,
        email: userData.email,
        username: userData.username,
        scheduledAt: scheduledAt || 'immediate',
        markedAsSent: Object.keys(userUpdateData).length > 0,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send email',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[ADMIN SEND NOTIFICATION] Error:', error);
    return NextResponse.json({
      error: 'Failed to send notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
  }); // End withAdminContext
}
