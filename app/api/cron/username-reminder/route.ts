/**
 * Username Reminder Email Cron Job
 * 
 * Sends reminder emails to users who haven't set up a proper username.
 * Run daily via Vercel cron to catch users who signed up but didn't complete profile.
 * 
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/username-reminder",
 *     "schedule": "0 14 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { sendTemplatedEmail } from '../../../services/emailService';

export const maxDuration = 120; // 2 minute timeout

/**
 * GET handler for Vercel cron jobs
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify cron access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const cronApiKey = process.env.CRON_API_KEY;
    
    const isAuthorized = 
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronApiKey && authHeader === `Bearer ${cronApiKey}`);

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      console.warn('[USERNAME REMINDER] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[USERNAME REMINDER] Starting username reminder processing');
    
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    
    const db = admin.firestore();
    
    // Calculate date range - users who signed up 1-7 days ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    // Find users without proper usernames who signed up recently
    // A "proper" username means not starting with "user_" or being empty
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .where('createdAt', '>=', oneWeekAgo)
      .where('createdAt', '<=', oneDayAgo)
      .limit(200)
      .get();
    
    console.log(`[USERNAME REMINDER] Found ${usersSnapshot.size} recent users to check`);
    
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Skip users without email
        if (!userData.email) {
          skipped++;
          continue;
        }
        
        // Skip users who already have a proper username
        const username = userData.username || '';
        const hasProperUsername = username && 
          !username.startsWith('user_') && 
          !username.startsWith('User_') &&
          username.length > 3;
        
        if (hasProperUsername) {
          skipped++;
          continue;
        }
        
        // Skip users who already received this reminder (check metadata)
        if (userData.usernameReminderSent) {
          skipped++;
          continue;
        }
        
        // Skip users who opted out of engagement emails
        if (userData.emailPreferences?.engagement === false) {
          skipped++;
          continue;
        }
        
        // Send the reminder email
        const success = await sendTemplatedEmail({
          templateId: 'choose-username',
          to: userData.email,
          data: {
            currentUsername: username || `user_${userId.slice(0, 8)}`
          },
          userId
        });
        
        if (success) {
          // Mark that we sent the reminder
          await userDoc.ref.update({
            usernameReminderSent: true,
            usernameReminderSentAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sent++;
        } else {
          failed++;
        }
        
        // Rate limit
        if (sent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (userError) {
        console.error(`[USERNAME REMINDER] Error processing user ${userDoc.id}:`, userError);
        failed++;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[USERNAME REMINDER] Completed in ${duration}ms - Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalChecked: usersSnapshot.size,
        sent,
        skipped,
        failed,
        durationMs: duration
      }
    });
    
  } catch (error) {
    console.error('[USERNAME REMINDER] Error:', error);
    return NextResponse.json({
      error: 'Failed to process username reminders',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
