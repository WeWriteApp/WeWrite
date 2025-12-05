/**
 * Migration Script: Sync Existing Users to Resend
 * 
 * This script fetches all users from Firebase and syncs them to the
 * Resend "general" audience for broadcast emails.
 * 
 * Usage:
 *   bun run scripts/sync-users-to-resend.ts
 *   bun run scripts/sync-users-to-resend.ts --dry-run
 *   bun run scripts/sync-users-to-resend.ts --limit 100
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const GENERAL_AUDIENCE_ID = '493da2d9-7034-4bb0-99de-1dcfac3b424d';
const RESEND_API_URL = 'https://api.resend.com';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

interface UserData {
  uid: string;
  email: string;
  username?: string;
  marketingOptOut?: boolean;
}

/**
 * Initialize Firebase Admin
 */
function initializeFirebase(): typeof admin {
  if (admin.apps.length > 0) {
    return admin;
  }

  const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON;
  if (!base64Json) {
    throw new Error('GOOGLE_CLOUD_KEY_JSON environment variable is not set');
  }

  const serviceAccount = JSON.parse(Buffer.from(base64Json, 'base64').toString('utf-8'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

/**
 * Create a contact in Resend
 */
async function createResendContact(user: UserData): Promise<{ id: string } | null> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }

  // Use username only - displayName is deprecated
  const firstName = user.username || 'User';

  const body: any = {
    email: user.email,
    first_name: firstName,
    unsubscribed: user.marketingOptOut ?? false,
  };

  const response = await fetch(`${RESEND_API_URL}/audiences/${GENERAL_AUDIENCE_ID}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    // 409 means contact already exists, which is fine
    if (response.status === 409) {
      return { id: 'existing' };
    }
    throw new Error(`Resend API error: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all users from Firebase
 */
async function fetchAllUsers(firebaseAdmin: typeof admin, maxUsers?: number): Promise<UserData[]> {
  const db = firebaseAdmin.firestore();
  const users: UserData[] = [];
  
  // Fetch from users collection
  let query = db.collection('users').orderBy('createdAt', 'desc');
  if (maxUsers) {
    query = query.limit(maxUsers) as any;
  }
  
  const snapshot = await query.get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.email) {
      users.push({
        uid: doc.id,
        email: data.email,
        username: data.username,
        marketingOptOut: data.marketingOptOut ?? data.emailPreferences?.marketing === false,
      });
    }
  }
  
  return users;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Resend Contact Sync Script');
  console.log('=============================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit} users`);
  console.log('');

  if (!RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Initialize Firebase
  console.log('📦 Initializing Firebase...');
  const firebaseAdmin = initializeFirebase();
  
  // Fetch users
  console.log('📥 Fetching users from Firebase...');
  const users = await fetchAllUsers(firebaseAdmin, limit);
  console.log(`   Found ${users.length} users with email addresses`);
  console.log('');

  // Stats
  let created = 0;
  let existing = 0;
  let failed = 0;
  let skipped = 0;

  // Process users
  console.log('📤 Syncing to Resend...');
  console.log('');
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const progress = `[${i + 1}/${users.length}]`;
    
    try {
      if (isDryRun) {
        console.log(`${progress} Would sync: ${user.email} (${user.username || 'no username'})`);
        created++;
      } else {
        const result = await createResendContact(user);
        if (result?.id === 'existing') {
          console.log(`${progress} ⏭️  Already exists: ${user.email}`);
          existing++;
        } else {
          console.log(`${progress} ✅ Created: ${user.email}`);
          created++;
        }
        
        // Rate limiting - Resend Contacts API allows 2 requests per second
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    } catch (error: any) {
      console.error(`${progress} ❌ Failed: ${user.email} - ${error.message}`);
      failed++;
    }
  }

  // Summary
  console.log('');
  console.log('=============================');
  console.log('📊 Summary');
  console.log('=============================');
  console.log(`Total users:     ${users.length}`);
  console.log(`Created:         ${created}`);
  console.log(`Already existed: ${existing}`);
  console.log(`Failed:          ${failed}`);
  console.log(`Skipped:         ${skipped}`);
  console.log('');
  
  if (isDryRun) {
    console.log('ℹ️  This was a dry run. No changes were made.');
    console.log('   Run without --dry-run to sync contacts.');
  } else {
    console.log('✅ Sync complete!');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
