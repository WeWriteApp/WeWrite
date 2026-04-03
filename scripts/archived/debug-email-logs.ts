/**
 * Debug script to investigate emailLogs collection
 *
 * Usage: npx tsx scripts/debug-email-logs.ts --env=prod
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const forceProduction = args.includes('--env=prod');

// Determine environment
const isProduction = forceProduction || process.env.NODE_ENV === 'production';

console.log(`\n🔍 Email Logs Debug Script`);
console.log(`Target environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log('='.repeat(50));

// Initialize Firebase Admin
function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;

  if (keyJson) {
    let credentials;
    try {
      credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(keyJson);
    }

    return admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: credentials.project_id
    });
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  throw new Error('No Firebase credentials found. Set GOOGLE_CLOUD_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS');
}

async function investigateEmailLogs() {
  const app = initFirebase();
  console.log('✓ Firebase Admin initialized');

  const db = admin.firestore();

  // Check both collections
  const collections = ['emailLogs', 'DEV_emailLogs'];

  for (const collectionName of collections) {
    console.log(`\n📁 Collection: ${collectionName}`);
    console.log('-'.repeat(40));

    try {
      // Get total count (approximate)
      const countSnapshot = await db.collection(collectionName).limit(1000).get();
      console.log(`Total documents (up to 1000): ${countSnapshot.size}`);

      if (countSnapshot.size === 0) {
        console.log('  (empty collection)');
        continue;
      }

      // Get the most recent 5 entries by sentAt
      console.log('\n📧 Most recent 5 emails (by sentAt):');
      try {
        const recentSnapshot = await db.collection(collectionName)
          .orderBy('sentAt', 'desc')
          .limit(5)
          .get();

        for (const doc of recentSnapshot.docs) {
          const data = doc.data();
          console.log(`  • ${data.sentAt} | ${data.templateId} | ${data.recipientUsername || data.recipientEmail} | status: ${data.status}`);
        }
      } catch (indexError: any) {
        console.log(`  ⚠️ Index error (needs sentAt desc index): ${indexError.message}`);

        // Try without ordering
        console.log('\n📧 Sample 5 emails (unordered):');
        const sampleSnapshot = await db.collection(collectionName).limit(5).get();
        for (const doc of sampleSnapshot.docs) {
          const data = doc.data();
          console.log(`  • ${data.sentAt || data.createdAt} | ${data.templateId} | ${data.recipientUsername || data.recipientEmail} | status: ${data.status}`);
        }
      }

      // Get template breakdown
      console.log('\n📊 Template breakdown:');
      const allDocs = countSnapshot.docs;
      const templateCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};
      let oldestDate = '';
      let newestDate = '';

      for (const doc of allDocs) {
        const data = doc.data();
        const templateId = data.templateId || 'unknown';
        const status = data.status || 'unknown';
        const sentAt = data.sentAt || data.createdAt || '';

        templateCounts[templateId] = (templateCounts[templateId] || 0) + 1;
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        if (!oldestDate || sentAt < oldestDate) oldestDate = sentAt;
        if (!newestDate || sentAt > newestDate) newestDate = sentAt;
      }

      for (const [templateId, count] of Object.entries(templateCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  • ${templateId}: ${count}`);
      }

      console.log('\n📊 Status breakdown:');
      for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  • ${status}: ${count}`);
      }

      console.log('\n📅 Date range:');
      console.log(`  Oldest: ${oldestDate}`);
      console.log(`  Newest: ${newestDate}`);

    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  // Check if there's any rate limit data
  console.log('\n\n📁 Rate Limit Collections');
  console.log('-'.repeat(40));

  for (const prefix of ['', 'DEV_']) {
    const collectionName = `${prefix}emailRateLimits`;
    try {
      const snapshot = await db.collection(collectionName).limit(10).get();
      console.log(`\n${collectionName}: ${snapshot.size} documents`);

      for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log(`  • ${doc.id}: totalSent=${data.totalSent || 0}, p0=${data.p0Sent || 0}, p1=${data.p1Sent || 0}, p2=${data.p2Sent || 0}, p3=${data.p3Sent || 0}`);
      }
    } catch (error: any) {
      console.log(`${collectionName}: Error - ${error.message}`);
    }
  }
}

investigateEmailLogs()
  .then(() => {
    console.log('\n✓ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error);
    process.exit(1);
  });
