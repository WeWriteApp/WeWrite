/**
 * Email API Route
 * 
 * POST /api/email/send - Send an email via Resend
 * 
 * This is a server-side API route that handles email sending.
 * Requires authentication for most email types.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendNotificationEmail, sendWelcomeEmail, sendTemplatedEmail } from '../../../services/emailService';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * If a userId is provided, fetch the latest username from Firestore
 * to ensure emails always use the most up-to-date username.
 */
async function getFreshUsername(userId?: string, fallbackUsername?: string): Promise<string | undefined> {
  if (!userId) return fallbackUsername;
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return fallbackUsername;
    const userDoc = await admin.firestore()
      .collection(getCollectionName('users'))
      .doc(userId)
      .get();
    if (userDoc.exists) {
      return userDoc.data()?.username || fallbackUsername;
    }
  } catch {
    // Fall back to provided username if lookup fails
  }
  return fallbackUsername;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, templateId, ...emailData } = body;

    // Validate required fields
    if (!type && !templateId) {
      return NextResponse.json(
        { error: 'Email type or templateId is required' },
        { status: 400 }
      );
    }

    if (!emailData.to) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    let success = false;

    // If a userId is provided, resolve the freshest username from Firestore
    const userId = emailData.userId || emailData.data?.userId;
    const freshUsername = await getFreshUsername(userId, emailData.username || emailData.data?.username);

    // Handle template-based sending
    if (templateId) {
      const templateData = emailData.data || {};
      // Override username in template data with fresh value if available
      if (freshUsername && templateData.username) {
        templateData.username = freshUsername;
      }
      success = await sendTemplatedEmail({
        templateId,
        to: emailData.to,
        data: templateData,
      });
    } else {
      // Handle legacy type-based sending
      switch (type) {
      case 'generic':
        if (!emailData.subject) {
          return NextResponse.json(
            { error: 'Subject is required for generic emails' },
            { status: 400 }
          );
        }
        success = await sendEmail({
          to: emailData.to,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html,
          replyTo: emailData.replyTo,
        });
        break;

      case 'welcome':
        if (!emailData.username && !freshUsername) {
          return NextResponse.json(
            { error: 'Username is required for welcome emails' },
            { status: 400 }
          );
        }
        success = await sendWelcomeEmail({
          to: emailData.to,
          username: freshUsername || emailData.username,
        });
        break;

      case 'notification':
        if (!emailData.subject || !emailData.heading || !emailData.body) {
          return NextResponse.json(
            { error: 'Subject, heading, and body are required for notification emails' },
            { status: 400 }
          );
        }
        success = await sendNotificationEmail({
          to: emailData.to,
          subject: emailData.subject,
          heading: emailData.heading,
          body: emailData.body,
          ctaText: emailData.ctaText,
          ctaUrl: emailData.ctaUrl,
          username: freshUsername || emailData.username,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown email type: ${type}` },
          { status: 400 }
        );
      }
    }

    if (success) {
      return NextResponse.json({ success: true, message: 'Email sent successfully' });
    } else {
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Email API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
