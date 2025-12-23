/**
 * Send First Page Activation Emails API
 *
 * POST /api/admin/send-activation-emails
 * Sends activation emails to users who haven't written any pages yet.
 *
 * GET /api/admin/send-activation-emails
 * Gets count of users eligible for activation emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getFirebaseAdmin } from '../../../firebase/admin';
import { firstPageActivationTemplate } from '../../../lib/emailTemplates';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { Resend } from 'resend';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

// Get Resend client
function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return new Resend(apiKey);
}

interface UserForActivation {
  uid: string;
  email: string;
  username: string | null;
  createdAt: Date | null;
  emailSettingsToken?: string;
  totalPages?: number;
}

/**
 * Get users who are eligible for activation emails:
 * - Have zero pages (or totalPages = 0)
 * - Have verified email (so we can reach them)
 * - Haven't already received this activation email
 */
async function getEligibleUsers(limit?: number): Promise<UserForActivation[]> {
  const db = getAdminFirestore();
  const usersCollection = getCollectionName(COLLECTIONS.USERS);

  // Query users who have totalPages = 0 or don't have the field set
  // We'll also filter for verified emails
  let query = db.collection(usersCollection)
    .where('totalPages', '==', 0);

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();

  const users: UserForActivation[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip users without email
    if (!data.email) continue;

    // Skip users who already received this email
    if (data.receivedFirstPageActivation) continue;

    // Skip unverified users (they might have bounced/invalid emails)
    // Actually, let's include them - they signed up, maybe they just need a nudge

    users.push({
      uid: doc.id,
      email: data.email,
      username: data.username || null,
      createdAt: data.createdAt?.toDate() || null,
      emailSettingsToken: data.emailSettingsToken,
      totalPages: data.totalPages || 0,
    });
  }

  return users;
}

// GET - Get count of eligible users
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    const users = await getEligibleUsers();

    return NextResponse.json({
      success: true,
      eligibleCount: users.length,
      sampleUsers: users.slice(0, 5).map(u => ({
        email: u.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email
        username: u.username,
        createdAt: u.createdAt?.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[Activation Emails] Error fetching eligible users:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Send activation emails
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { testMode, testEmail, batchSize = 50 } = body;

    const resend = getResend();
    const db = getAdminFirestore();
    const admin = getFirebaseAdmin();

    if (testMode) {
      // Send test email to specified address
      if (!testEmail) {
        return NextResponse.json(
          { success: false, error: 'Test email address required for test mode' },
          { status: 400 }
        );
      }

      const html = firstPageActivationTemplate.generateHtml({
        username: 'TestUser',
        emailSettingsToken: 'test-token-123',
      });

      const result = await resend.emails.send({
        from: 'WeWrite <notifications@getwewrite.app>',
        replyTo: 'support@getwewrite.app',
        to: testEmail,
        subject: firstPageActivationTemplate.subject,
        html,
      });

      return NextResponse.json({
        success: true,
        mode: 'test',
        sentTo: testEmail,
        resendId: result.data?.id,
      });
    }

    // Production mode - get eligible users and send in batches
    const users = await getEligibleUsers(batchSize);

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        mode: 'production',
        sent: 0,
        message: 'No eligible users found',
      });
    }

    // Send emails in batches (Resend batch limit is 100)
    const BATCH_SIZE = Math.min(100, batchSize);
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
      userIds: [] as string[],
    };

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      // Build batch emails
      const emails = batch.map(user => ({
        from: 'WeWrite <notifications@getwewrite.app>',
        replyTo: 'support@getwewrite.app',
        to: user.email,
        subject: firstPageActivationTemplate.subject,
        html: firstPageActivationTemplate.generateHtml({
          username: user.username || undefined,
          emailSettingsToken: user.emailSettingsToken,
        }),
      }));

      try {
        // Use batch send
        const batchResult = await resend.batch.send(emails);

        if (batchResult.data) {
          results.sent += batchResult.data.data.length;
          results.userIds.push(...batch.map(u => u.uid));
        }
        if (batchResult.error) {
          results.failed += batch.length;
          results.errors.push(batchResult.error.message);
        }
      } catch (batchError: any) {
        results.failed += batch.length;
        results.errors.push(batchError.message);
      }

      // Rate limiting between batches
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Mark users as having received the activation email
    if (results.userIds.length > 0 && admin) {
      const usersCollection = getCollectionName(COLLECTIONS.USERS);
      const firestoreBatch = db.batch();

      for (const userId of results.userIds) {
        const userRef = db.collection(usersCollection).doc(userId);
        firestoreBatch.update(userRef, {
          receivedFirstPageActivation: true,
          firstPageActivationSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await firestoreBatch.commit();
    }

    // Log to console for tracking
    console.log(`[Activation Emails] Sent by ${adminCheck.userEmail}: ${results.sent} emails, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      mode: 'production',
      sent: results.sent,
      failed: results.failed,
      total: users.length,
      errors: results.errors.length > 0 ? results.errors.slice(0, 5) : undefined,
    });
  } catch (error: any) {
    console.error('[Activation Emails] Error sending activation emails:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
