/**
 * Resend Webhook Handler
 *
 * Receives webhook events from Resend to update email delivery status.
 * Events: email.sent, email.delivered, email.bounced, email.complained, email.opened, email.clicked, email.failed
 *
 * Setup:
 * 1. Go to Resend Dashboard > Webhooks
 * 2. Add endpoint: https://wewrite.ai/api/webhooks/resend
 * 3. Select events: email.delivered, email.bounced, email.complained, email.failed
 * 4. Copy the signing secret to RESEND_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

// Map Resend event types to our status values
const EVENT_TO_STATUS: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.failed': 'failed',
  'email.delivery_delayed': 'delayed',
};

// Initialize Resend for webhook verification
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    // Get Svix headers for verification
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('[Resend Webhook] Missing Svix headers');
        return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
      }

      try {
        const resend = getResend();
        // Use Resend's built-in webhook verification
        resend.webhooks.verify({
          payload: rawBody,
          headers: {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
          },
          secret: webhookSecret,
        });
      } catch (verifyError) {
        console.error('[Resend Webhook] Signature verification failed:', verifyError);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      console.warn('[Resend Webhook] RESEND_WEBHOOK_SECRET not set - skipping verification');
    }

    // Extract event data
    const { type, data, created_at } = payload;

    if (!type || !data) {
      console.error('[Resend Webhook] Invalid payload structure');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Get the email ID from Resend (this is what we store as resendId)
    const resendId = data.email_id || data.id;

    if (!resendId) {
      console.log('[Resend Webhook] No email ID in payload, skipping:', type);
      return NextResponse.json({ success: true, message: 'No email ID to update' });
    }

    // Map the event type to our status
    const newStatus = EVENT_TO_STATUS[type];
    if (!newStatus) {
      console.log('[Resend Webhook] Unhandled event type:', type);
      return NextResponse.json({ success: true, message: `Unhandled event: ${type}` });
    }

    // Update the email log in Firebase
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Resend Webhook] Firebase admin not available');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Find the email log by resendId (check both production and dev collections)
    const collections = [
      getCollectionName('emailLogs'),
      'DEV_emailLogs', // Also check dev collection in case of environment mismatch
    ];

    let updated = false;
    for (const collectionName of collections) {
      try {
        const snapshot = await db
          .collection(collectionName)
          .where('resendId', '==', resendId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];

          // Build update data
          const updateData: Record<string, any> = {
            status: newStatus,
            lastWebhookEvent: type,
            lastWebhookAt: created_at || new Date().toISOString(),
          };

          // Add event-specific data
          if (type === 'email.bounced') {
            updateData.bounceReason = data.bounce?.message || data.reason || 'Unknown';
            updateData.bounceType = data.bounce?.type || 'unknown';
          } else if (type === 'email.complained') {
            updateData.complaintType = data.complaint?.type || 'abuse';
          } else if (type === 'email.opened') {
            updateData.openedAt = created_at || new Date().toISOString();
            // Don't overwrite delivered status with opened
            if (doc.data().status === 'delivered') {
              delete updateData.status;
            }
          } else if (type === 'email.clicked') {
            updateData.clickedAt = created_at || new Date().toISOString();
            updateData.clickedLink = data.click?.link || data.link;
            // Don't overwrite status for clicks
            delete updateData.status;
          }

          await doc.ref.update(updateData);
          updated = true;
          console.log(`[Resend Webhook] Updated ${collectionName}/${doc.id}: ${type} -> ${newStatus}`);
          break;
        }
      } catch (queryError) {
        // Collection might not exist or have the index, continue to next
        console.warn(`[Resend Webhook] Error querying ${collectionName}:`, queryError);
      }
    }

    if (!updated) {
      console.log(`[Resend Webhook] No email log found for resendId: ${resendId}`);
    }

    return NextResponse.json({
      success: true,
      event: type,
      resendId,
      updated,
    });
  } catch (error) {
    console.error('[Resend Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Also handle GET for health checks
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'Resend webhook handler',
    events: Object.keys(EVENT_TO_STATUS),
  });
}
