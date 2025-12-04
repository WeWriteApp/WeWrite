/**
 * Email API Route
 * 
 * POST /api/email/send - Send an email via Resend
 * 
 * This is a server-side API route that handles email sending.
 * Requires authentication for most email types.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendNotificationEmail, sendWelcomeEmail } from '../../../services/emailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...emailData } = body;

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'Email type is required' },
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
        if (!emailData.username) {
          return NextResponse.json(
            { error: 'Username is required for welcome emails' },
            { status: 400 }
          );
        }
        success = await sendWelcomeEmail({
          to: emailData.to,
          username: emailData.username,
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
          username: emailData.username,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown email type: ${type}` },
          { status: 400 }
        );
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
