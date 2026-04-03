/**
 * Backfill script to calculate and populate Trust Scores for all existing users
 *
 * This script scans all users and calculates trust scores based on:
 * - Account age
 * - Email verification status
 * - Page count (content creation)
 * - Subscription status
 * - Admin status
 *
 * Note: This calculates a simplified trust score based on stored user data.
 * The full RiskScoringService includes additional real-time factors (bot detection,
 * IP reputation, behavioral patterns) that require live data.
 *
 * Higher scores = more trusted (100 = fully trusted, 0 = suspicious)
 *
 * Usage:
 *   npx tsx scripts/backfill-user-trust-scores.ts [--dry-run] [--env=dev|prod|both]
 *
 * Options:
 *   --dry-run      Preview changes without modifying the database
 *   --env=dev      Process DEV_ collections only (default)
 *   --env=prod     Process production collections only
 *   --env=both     Process both dev and production collections
 *
 * Examples:
 *   npx tsx scripts/backfill-user-trust-scores.ts --dry-run --env=dev
 *   npx tsx scripts/backfill-user-trust-scores.ts --env=prod
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const envArg = args.find(arg => arg.startsWith('--env='));
const targetEnv = envArg?.split('=')[1] || 'dev';

if (!['dev', 'prod', 'both'].includes(targetEnv)) {
  console.error('Invalid --env value. Use: dev, prod, or both');
  process.exit(1);
}

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

// Trust score thresholds (higher = more trusted)
const TRUST_THRESHOLDS = {
  ALLOW: 75,           // 75-100: Trusted
  SOFT_CHALLENGE: 50,  // 50-74: Medium
  HARD_CHALLENGE: 25,  // 25-49: Suspicious
  BLOCK: 0             // 0-24: Very suspicious
};

interface BackfillStats {
  usersProcessed: number;
  usersUpdated: number;
  usersSkipped: number;
  errors: number;
  scoreDistribution: {
    trusted: number;
    medium: number;
    suspicious: number;
    verySuspicious: number;
  };
}

/**
 * Get trust level from score (higher = more trusted)
 */
function getTrustLevel(score: number): 'trusted' | 'medium' | 'suspicious' | 'verySuspicious' {
  if (score >= TRUST_THRESHOLDS.ALLOW) return 'trusted';
  if (score >= TRUST_THRESHOLDS.SOFT_CHALLENGE) return 'medium';
  if (score >= TRUST_THRESHOLDS.HARD_CHALLENGE) return 'suspicious';
  return 'verySuspicious';
}

/**
 * Calculate trust score based on user data
 * Higher scores = more trusted
 */
function calculateTrustScore(userData: {
  createdAt?: any;
  emailVerified?: boolean;
  pageCount?: number;
  pagesCount?: number;
  hasActiveSubscription?: boolean;
  isAdmin?: boolean;
}): number {
  let score = 50; // Start at medium trust

  // Account age increases trust (max +30 points)
  if (userData.createdAt) {
    let createdDate: Date;
    if (userData.createdAt?.toDate) {
      createdDate = userData.createdAt.toDate();
    } else if (typeof userData.createdAt === 'string') {
      createdDate = new Date(userData.createdAt);
    } else if (userData.createdAt instanceof Date) {
      createdDate = userData.createdAt;
    } else {
      createdDate = new Date();
    }

    const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays > 90) score += 30;
    else if (ageInDays > 30) score += 20;
    else if (ageInDays > 7) score += 10;
    else score -= 10; // New accounts are less trusted
  } else {
    score -= 10; // Unknown creation date
  }

  // Email verification increases trust (+15 points)
  if (userData.emailVerified) {
    score += 15;
  } else {
    score -= 5;
  }

  // Content creation shows engagement (+15 points max)
  const pageCount = userData.pageCount || userData.pagesCount || 0;
  if (pageCount > 50) score += 15;
  else if (pageCount > 10) score += 10;
  else if (pageCount > 0) score += 5;
  else score -= 5; // No content yet

  // Subscription shows commitment (+10 points)
  if (userData.hasActiveSubscription) {
    score += 10;
  }

  // Admin users are trusted (+20 points)
  if (userData.isAdmin) {
    score += 20;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Process a single environment (dev or prod)
 */
async function processEnvironment(
  db: admin.firestore.Firestore,
  collectionPrefix: string,
  envName: string
): Promise<BackfillStats> {
  const stats: BackfillStats = {
    usersProcessed: 0,
    usersUpdated: 0,
    usersSkipped: 0,
    errors: 0,
    scoreDistribution: { trusted: 0, medium: 0, suspicious: 0, verySuspicious: 0 }
  };

  const USERS_COLLECTION = `${collectionPrefix}users`;
  const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

  console.log(`\n📊 Processing ${envName} environment`);
  console.log(`   Users collection: ${USERS_COLLECTION}`);

  const BATCH_SIZE = 50;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let batchNumber = 0;

  // Build a cache of active subscriptions
  const subscriptionCache = new Map<string, boolean>();

  while (true) {
    batchNumber++;
    console.log(`\n   📦 Batch ${batchNumber}...`);

    let query = db.collection(USERS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('      No more users to process.');
      break;
    }

    // Fetch subscription data for this batch
    const userIds = snapshot.docs.map(doc => doc.id);
    for (const userId of userIds) {
      try {
        // Check for active subscription
        const subDocPath = `${collectionPrefix}stripeCustomers/${userId}/${SUBSCRIPTIONS_COLLECTION}/current`;
        const subDoc = await db.doc(subDocPath).get();
        if (subDoc.exists) {
          const subData = subDoc.data();
          const isActive = subData?.status === 'active' || subData?.status === 'trialing';
          subscriptionCache.set(userId, isActive);
        } else {
          subscriptionCache.set(userId, false);
        }
      } catch {
        subscriptionCache.set(userId, false);
      }
    }

    // Use a batch for efficient writes
    const writeBatch = db.batch();
    let batchWrites = 0;

    for (const doc of snapshot.docs) {
      stats.usersProcessed++;
      const data = doc.data();
      const userId = doc.id;

      try {
        const hasActiveSubscription = subscriptionCache.get(userId) || false;

        // Calculate trust score
        const trustScore = calculateTrustScore({
          createdAt: data.createdAt,
          emailVerified: data.emailVerified,
          pageCount: data.pageCount || data.pagesCount,
          hasActiveSubscription,
          isAdmin: data.isAdmin
        });

        const level = getTrustLevel(trustScore);
        stats.scoreDistribution[level]++;

        // Prepare update data
        const updateData = {
          riskScore: trustScore, // Keep field name for backwards compatibility
          riskScoreUpdatedAt: new Date().toISOString()
        };

        if (!dryRun) {
          writeBatch.update(doc.ref, updateData);
        }
        batchWrites++;

        stats.usersUpdated++;

        // Log sample entries
        if (stats.usersUpdated <= 5) {
          console.log(`      👤 ${userId}: "${(data.username || data.email || 'Unknown').substring(0, 25)}" → Trust: ${trustScore} (${level})`);
          console.log(`         Verified: ${data.emailVerified ? 'Yes' : 'No'}, Pages: ${data.pageCount || data.pagesCount || 0}, Sub: ${hasActiveSubscription ? 'Yes' : 'No'}`);
        }

      } catch (error) {
        console.error(`      ❌ Error processing user ${userId}:`, error);
        stats.errors++;
      }
    }

    // Commit the batch
    if (!dryRun && batchWrites > 0) {
      await writeBatch.commit();
      console.log(`      ✅ Updated ${batchWrites} users`);
    } else if (dryRun) {
      console.log(`      🔍 Would update ${batchWrites} users (dry run)`);
    }

    // Update last doc for pagination
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return stats;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('     BACKFILL: User Trust Scores');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Target environment: ${targetEnv.toUpperCase()}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);
  console.log('');
  console.log('Trust Levels (Higher = More Trusted):');
  console.log('  🟢 Trusted (75-100): Account appears legitimate');
  console.log('  🔵 Medium (50-74): Some verification may be needed');
  console.log('  🟡 Suspicious (25-49): Multiple flags detected');
  console.log('  🔴 Very Suspicious (0-24): Likely spam/bot');

  const app = initFirebase();
  const db = app.firestore();

  const allStats: BackfillStats = {
    usersProcessed: 0,
    usersUpdated: 0,
    usersSkipped: 0,
    errors: 0,
    scoreDistribution: { trusted: 0, medium: 0, suspicious: 0, verySuspicious: 0 }
  };

  // Process environments based on target
  const environments: Array<{ prefix: string; name: string }> = [];

  if (targetEnv === 'dev' || targetEnv === 'both') {
    environments.push({ prefix: 'DEV_', name: 'Development' });
  }
  if (targetEnv === 'prod' || targetEnv === 'both') {
    environments.push({ prefix: '', name: 'Production' });
  }

  for (const env of environments) {
    const stats = await processEnvironment(db, env.prefix, env.name);

    // Aggregate stats
    allStats.usersProcessed += stats.usersProcessed;
    allStats.usersUpdated += stats.usersUpdated;
    allStats.usersSkipped += stats.usersSkipped;
    allStats.errors += stats.errors;
    allStats.scoreDistribution.trusted += stats.scoreDistribution.trusted;
    allStats.scoreDistribution.medium += stats.scoreDistribution.medium;
    allStats.scoreDistribution.suspicious += stats.scoreDistribution.suspicious;
    allStats.scoreDistribution.verySuspicious += stats.scoreDistribution.verySuspicious;
  }

  // Print results
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Users processed:    ${allStats.usersProcessed}`);
  console.log(`   Users updated:      ${allStats.usersUpdated}`);
  console.log(`   Users skipped:      ${allStats.usersSkipped}`);
  console.log(`   Errors:             ${allStats.errors}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log('   Trust Score Distribution:');
  console.log(`      🟢 Trusted (75-100):        ${allStats.scoreDistribution.trusted}`);
  console.log(`      🔵 Medium (50-74):          ${allStats.scoreDistribution.medium}`);
  console.log(`      🟡 Suspicious (25-49):      ${allStats.scoreDistribution.suspicious}`);
  console.log(`      🔴 Very Suspicious (0-24):  ${allStats.scoreDistribution.verySuspicious}`);
  console.log('════════════════════════════════════════════════════════════');

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('\n✅ Backfill complete!\n');
    console.log('   All users now have trust scores calculated.');
    console.log('   Note: Real-time factors (bot detection, IP reputation) are');
    console.log('   calculated dynamically via the RiskScoringService.\n');
  }

  process.exit(allStats.errors > 0 ? 1 : 0);
}

main().catch(console.error);
