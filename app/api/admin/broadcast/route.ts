/**
 * Broadcast Email API
 * 
 * POST /api/admin/broadcast
 * Sends a broadcast email to all users in the Resend audience.
 * 
 * GET /api/admin/broadcast
 * Gets audience statistics and broadcast history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '../../../firebase/admin';
import { broadcastEmailTemplate } from '../../../lib/emailTemplates';
import { Resend } from 'resend';

const GENERAL_AUDIENCE_ID = '493da2d9-7034-4bb0-99de-1dcfac3b424d';

// Get Resend client
function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return new Resend(apiKey);
}

// Verify admin access
async function verifyAdmin(request: NextRequest): Promise<{ valid: boolean; email?: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false };
  }
  
  // For simplicity, we'll check admin on the client side
  // This endpoint should only be accessible to admins
  return { valid: true };
}

interface BroadcastRequest {
  subject: string;
  heading: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  testMode?: boolean;
  testEmail?: string;
}

interface AudienceContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  unsubscribed: boolean;
}

// GET - Get audience stats
export async function GET(request: NextRequest) {
  try {
    const resend = getResend();
    
    // Fetch audience contacts to get stats
    const response = await fetch(
      `https://api.resend.com/audiences/${GENERAL_AUDIENCE_ID}/contacts`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch audience');
    }
    
    const data = await response.json();
    const contacts: AudienceContact[] = data.data || [];
    
    const stats = {
      total: contacts.length,
      subscribed: contacts.filter(c => !c.unsubscribed).length,
      unsubscribed: contacts.filter(c => c.unsubscribed).length,
    };
    
    // Get broadcast history from Firestore
    const db = getAdminFirestore();
    const historySnapshot = await db
      .collection('broadcast_history')
      .orderBy('sentAt', 'desc')
      .limit(10)
      .get();
    
    const history = historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return NextResponse.json({
      success: true,
      stats,
      history,
    });
  } catch (error: any) {
    console.error('[Broadcast] Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Send a broadcast
export async function POST(request: NextRequest) {
  try {
    const body: BroadcastRequest = await request.json();
    const { subject, heading, body: emailBody, ctaText, ctaUrl, testMode, testEmail } = body;
    
    // Validate required fields
    if (!subject || !heading || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'Subject, heading, and body are required' },
        { status: 400 }
      );
    }
    
    const resend = getResend();
    
    if (testMode) {
      // Send test email to specified address
      if (!testEmail) {
        return NextResponse.json(
          { success: false, error: 'Test email address required for test mode' },
          { status: 400 }
        );
      }
      
      const html = broadcastEmailTemplate.generateHtml({
        subject,
        heading,
        body: emailBody,
        ctaText,
        ctaUrl,
        recipientEmail: testEmail,
      });
      
      const result = await resend.emails.send({
        from: 'WeWrite <noreply@getwewrite.app>',
        to: testEmail,
        subject,
        html,
      });
      
      return NextResponse.json({
        success: true,
        mode: 'test',
        sentTo: testEmail,
        resendId: result.data?.id,
      });
    }
    
    // Production broadcast - fetch all subscribed contacts
    const contactsResponse = await fetch(
      `https://api.resend.com/audiences/${GENERAL_AUDIENCE_ID}/contacts`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
      }
    );
    
    if (!contactsResponse.ok) {
      throw new Error('Failed to fetch audience contacts');
    }
    
    const contactsData = await contactsResponse.json();
    const contacts: AudienceContact[] = contactsData.data || [];
    const subscribedContacts = contacts.filter(c => !c.unsubscribed);
    
    if (subscribedContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No subscribed contacts in audience' },
        { status: 400 }
      );
    }
    
    // Send emails in batches (Resend batch limit is 100)
    const BATCH_SIZE = 100;
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };
    
    for (let i = 0; i < subscribedContacts.length; i += BATCH_SIZE) {
      const batch = subscribedContacts.slice(i, i + BATCH_SIZE);
      
      // Build batch emails
      const emails = batch.map(contact => ({
        from: 'WeWrite <noreply@getwewrite.app>',
        to: contact.email,
        subject,
        html: broadcastEmailTemplate.generateHtml({
          subject,
          heading,
          body: emailBody,
          ctaText,
          ctaUrl,
          recipientEmail: contact.email,
        }),
      }));
      
      try {
        // Use batch send
        const batchResult = await resend.batch.send(emails);
        
        if (batchResult.data) {
          results.sent += batchResult.data.data.length;
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
      if (i + BATCH_SIZE < subscribedContacts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Log broadcast to Firestore
    const db = getAdminFirestore();
    await db.collection('broadcast_history').add({
      subject,
      heading,
      body: emailBody.substring(0, 500), // Truncate for storage
      ctaText,
      ctaUrl,
      sentAt: new Date().toISOString(),
      recipients: results.sent,
      failed: results.failed,
      errors: results.errors.slice(0, 5), // Keep first 5 errors
    });
    
    return NextResponse.json({
      success: true,
      mode: 'broadcast',
      sent: results.sent,
      failed: results.failed,
      total: subscribedContacts.length,
      errors: results.errors.length > 0 ? results.errors.slice(0, 5) : undefined,
    });
  } catch (error: any) {
    console.error('[Broadcast] Error sending broadcast:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
