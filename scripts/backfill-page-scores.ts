/**
 * Backfill script to calculate and populate PageScores for all existing pages
 *
 * This script scans all pages and calculates quality scores based on:
 * - External-to-internal link ratio
 * - Internal links to other users' pages
 * - Show author links (attribution)
 * - Backlinks received
 *
 * Usage:
 *   npx tsx scripts/backfill-page-scores.ts [--dry-run] [--env=dev|prod|both]
 *
 * Options:
 *   --dry-run      Preview changes without modifying the database
 *   --env=dev      Process DEV_ collections only (default)
 *   --env=prod     Process production collections only
 *   --env=both     Process both dev and production collections
 *
 * Examples:
 *   npx tsx scripts/backfill-page-scores.ts --dry-run --env=dev
 *   npx tsx scripts/backfill-page-scores.ts --env=both
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

// Scoring constants (matching app/constants/page-scoring.ts)
const INTERNAL_USER_LINKS_SCORING = {
  EXCELLENT: { min: 5, score: 0 },
  GOOD: { min: 3, score: 5 },
  FAIR: { min: 2, score: 10 },
  MINIMAL: { min: 1, score: 15 },
  NONE: { min: 0, score: 25 }
};

const SHOW_AUTHOR_LINKS_SCORING = {
  EXCELLENT: { min: 3, score: 0 },
  GOOD: { min: 2, score: 8 },
  MINIMAL: { min: 1, score: 15 },
  NONE: { min: 0, score: 25 }
};

const BACKLINKS_SCORING = {
  EXCELLENT: { min: 5, score: 0 },
  GOOD: { min: 3, score: 5 },
  FAIR: { min: 2, score: 10 },
  MINIMAL: { min: 1, score: 15 },
  NONE: { min: 0, score: 25 }
};

interface BackfillStats {
  pagesProcessed: number;
  pagesUpdated: number;
  pagesSkipped: number;
  errors: number;
  scoreDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

interface LinkStats {
  externalCount: number;
  internalCount: number;
  internalPageLinks: Array<{ pageId: string; showAuthor: boolean }>;
  showAuthorCount: number;
}

/**
 * Extract links from editor content nodes
 */
function extractLinksFromNodes(nodes: any[]): Array<{
  type: 'external' | 'page' | 'user';
  url?: string;
  pageId?: string;
  showAuthor?: boolean;
}> {
  const links: Array<{
    type: 'external' | 'page' | 'user';
    url?: string;
    pageId?: string;
    showAuthor?: boolean;
  }> = [];

  const extractFromNode = (node: any) => {
    if (node.type === 'link' || node.url || node.href || node.pageId) {
      const url = node.url || node.href || '';

      // Check if it's an internal page link
      if (node.pageId) {
        links.push({
          type: 'page',
          pageId: node.pageId,
          showAuthor: node.showAuthor === true
        });
      } else if (node.userId && !node.pageId) {
        // User link (not a page link)
        links.push({ type: 'user' });
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        // Check if it's a WeWrite internal link
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('wewrite.app') || lowerUrl.includes('getwewrite.app')) {
          // Try to extract pageId from URL
          const match = url.match(/\/([a-zA-Z0-9_-]+)(?:\?|$)/);
          if (match && match[1] && !['u', 'user', 'settings', 'admin'].includes(match[1])) {
            links.push({
              type: 'page',
              pageId: match[1],
              showAuthor: node.showAuthor === true
            });
          }
        } else {
          // External link
          links.push({ type: 'external', url });
        }
      }
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(extractFromNode);
    }
  };

  if (Array.isArray(nodes)) {
    nodes.forEach(extractFromNode);
  }

  return links;
}

/**
 * Extract link statistics from content
 */
function extractLinkStats(content: any): LinkStats {
  let contentNodes: any[] = [];

  if (typeof content === 'string') {
    try {
      contentNodes = JSON.parse(content);
    } catch {
      return { externalCount: 0, internalCount: 0, internalPageLinks: [], showAuthorCount: 0 };
    }
  } else if (Array.isArray(content)) {
    contentNodes = content;
  } else {
    return { externalCount: 0, internalCount: 0, internalPageLinks: [], showAuthorCount: 0 };
  }

  const links = extractLinksFromNodes(contentNodes);

  let externalCount = 0;
  let internalCount = 0;
  const internalPageLinks: Array<{ pageId: string; showAuthor: boolean }> = [];
  let showAuthorCount = 0;

  for (const link of links) {
    if (link.type === 'external') {
      externalCount++;
    } else if (link.type === 'page' && link.pageId) {
      internalCount++;
      internalPageLinks.push({
        pageId: link.pageId,
        showAuthor: link.showAuthor === true
      });
      if (link.showAuthor) {
        showAuthorCount++;
      }
    } else if (link.type === 'user') {
      internalCount++;
    }
  }

  return { externalCount, internalCount, internalPageLinks, showAuthorCount };
}

/**
 * Calculate external ratio score (0-25, lower is better)
 */
function calculateExternalRatioScore(externalCount: number, internalCount: number): number {
  if (externalCount === 0) return 0;
  if (internalCount === 0 && externalCount > 0) return 25;
  const ratio = externalCount / (internalCount + externalCount);
  return Math.round(ratio * 25);
}

/**
 * Calculate internal user links score (0-25, lower is better)
 */
function calculateInternalUserLinksScore(linksToOtherUsers: number): number {
  if (linksToOtherUsers >= INTERNAL_USER_LINKS_SCORING.EXCELLENT.min) return INTERNAL_USER_LINKS_SCORING.EXCELLENT.score;
  if (linksToOtherUsers >= INTERNAL_USER_LINKS_SCORING.GOOD.min) return INTERNAL_USER_LINKS_SCORING.GOOD.score;
  if (linksToOtherUsers >= INTERNAL_USER_LINKS_SCORING.FAIR.min) return INTERNAL_USER_LINKS_SCORING.FAIR.score;
  if (linksToOtherUsers >= INTERNAL_USER_LINKS_SCORING.MINIMAL.min) return INTERNAL_USER_LINKS_SCORING.MINIMAL.score;
  return INTERNAL_USER_LINKS_SCORING.NONE.score;
}

/**
 * Calculate show author score (0-25, lower is better)
 */
function calculateShowAuthorScore(showAuthorCount: number): number {
  if (showAuthorCount >= SHOW_AUTHOR_LINKS_SCORING.EXCELLENT.min) return SHOW_AUTHOR_LINKS_SCORING.EXCELLENT.score;
  if (showAuthorCount >= SHOW_AUTHOR_LINKS_SCORING.GOOD.min) return SHOW_AUTHOR_LINKS_SCORING.GOOD.score;
  if (showAuthorCount >= SHOW_AUTHOR_LINKS_SCORING.MINIMAL.min) return SHOW_AUTHOR_LINKS_SCORING.MINIMAL.score;
  return SHOW_AUTHOR_LINKS_SCORING.NONE.score;
}

/**
 * Calculate backlinks score (0-25, lower is better)
 */
function calculateBacklinksScore(backlinkCount: number): number {
  if (backlinkCount >= BACKLINKS_SCORING.EXCELLENT.min) return BACKLINKS_SCORING.EXCELLENT.score;
  if (backlinkCount >= BACKLINKS_SCORING.GOOD.min) return BACKLINKS_SCORING.GOOD.score;
  if (backlinkCount >= BACKLINKS_SCORING.FAIR.min) return BACKLINKS_SCORING.FAIR.score;
  if (backlinkCount >= BACKLINKS_SCORING.MINIMAL.min) return BACKLINKS_SCORING.MINIMAL.score;
  return BACKLINKS_SCORING.NONE.score;
}

/**
 * Get score level from total score
 */
function getScoreLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score <= 25) return 'excellent';
  if (score <= 50) return 'good';
  if (score <= 75) return 'fair';
  return 'poor';
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
    pagesProcessed: 0,
    pagesUpdated: 0,
    pagesSkipped: 0,
    errors: 0,
    scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 }
  };

  const PAGES_COLLECTION = `${collectionPrefix}pages`;
  const BACKLINKS_COLLECTION = `${collectionPrefix}backlinks`;

  console.log(`\n📊 Processing ${envName} environment`);
  console.log(`   Pages collection: ${PAGES_COLLECTION}`);
  console.log(`   Backlinks collection: ${BACKLINKS_COLLECTION}`);

  const BATCH_SIZE = 50;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let batchNumber = 0;

  // Build a cache of page owners for efficient lookups
  const pageOwnerCache = new Map<string, string>();

  while (true) {
    batchNumber++;
    console.log(`\n   📦 Batch ${batchNumber}...`);

    let query = db.collection(PAGES_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('      No more pages to process.');
      break;
    }

    // First pass: cache page owners
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.userId) {
        pageOwnerCache.set(doc.id, data.userId);
      }
    }

    // Use a batch for efficient writes
    const writeBatch = db.batch();
    let batchWrites = 0;

    for (const doc of snapshot.docs) {
      stats.pagesProcessed++;
      const data = doc.data();
      const pageId = doc.id;
      const pageUserId = data.userId;

      // Skip deleted pages
      if (data.deleted === true) {
        stats.pagesSkipped++;
        continue;
      }

      // Skip pages without content
      if (!data.content) {
        stats.pagesSkipped++;
        continue;
      }

      try {
        // Extract link stats from content
        const linkStats = extractLinkStats(data.content);

        // Get page owners for linked pages to determine "links to other users"
        const linkedUserIds: string[] = [];
        for (const link of linkStats.internalPageLinks) {
          const ownerId = pageOwnerCache.get(link.pageId);
          if (ownerId) {
            linkedUserIds.push(ownerId);
          } else {
            // Try to fetch from database
            try {
              const linkedPageDoc = await db.collection(PAGES_COLLECTION).doc(link.pageId).get();
              if (linkedPageDoc.exists) {
                const linkedData = linkedPageDoc.data();
                if (linkedData?.userId) {
                  pageOwnerCache.set(link.pageId, linkedData.userId);
                  linkedUserIds.push(linkedData.userId);
                }
              }
            } catch {
              // Ignore errors fetching linked pages
            }
          }
        }

        // Count links to OTHER users (not self-links)
        const linksToOtherUsers = linkedUserIds.filter(uid => uid !== pageUserId).length;

        // Get backlink count
        let backlinkCount = 0;
        try {
          const backlinksSnapshot = await db.collection(BACKLINKS_COLLECTION)
            .where('targetPageId', '==', pageId)
            .where('isPublic', '==', true)
            .get();
          backlinkCount = backlinksSnapshot.size;
        } catch {
          // Backlinks collection might not exist yet
        }

        // Calculate factor scores
        const externalRatioScore = calculateExternalRatioScore(
          linkStats.externalCount,
          linkStats.internalCount
        );
        const internalUserLinksScore = calculateInternalUserLinksScore(linksToOtherUsers);
        const showAuthorScore = calculateShowAuthorScore(linkStats.showAuthorCount);
        const backlinksScore = calculateBacklinksScore(backlinkCount);

        // Total score (0-100)
        const totalScore = externalRatioScore + internalUserLinksScore + showAuthorScore + backlinksScore;
        const level = getScoreLevel(totalScore);

        // Update score distribution
        stats.scoreDistribution[level]++;

        // Prepare update data
        const updateData = {
          pageScore: totalScore,
          pageScoreFactors: {
            externalRatio: externalRatioScore,
            internalUserLinks: internalUserLinksScore,
            showAuthorLinks: showAuthorScore,
            backlinks: backlinksScore
          },
          pageScoreUpdatedAt: new Date().toISOString()
        };

        if (!dryRun) {
          writeBatch.update(doc.ref, updateData);
          batchWrites++;
        }

        stats.pagesUpdated++;

        // Log sample entries
        if (stats.pagesUpdated <= 5) {
          console.log(`      📝 ${pageId}: "${(data.title || 'Untitled').substring(0, 30)}" → Score: ${totalScore} (${level})`);
          console.log(`         Factors: ext=${externalRatioScore}, internal=${internalUserLinksScore}, author=${showAuthorScore}, backlinks=${backlinksScore}`);
        }

      } catch (error) {
        console.error(`      ❌ Error processing page ${pageId}:`, error);
        stats.errors++;
      }
    }

    // Commit the batch
    if (!dryRun && batchWrites > 0) {
      await writeBatch.commit();
      console.log(`      ✅ Updated ${batchWrites} pages`);
    } else if (dryRun) {
      console.log(`      🔍 Would update ${batchWrites} pages (dry run)`);
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
  console.log('     BACKFILL: Page Quality Scores');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Target environment: ${targetEnv.toUpperCase()}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);

  const app = initFirebase();
  const db = app.firestore();

  const allStats: BackfillStats = {
    pagesProcessed: 0,
    pagesUpdated: 0,
    pagesSkipped: 0,
    errors: 0,
    scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 }
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
    allStats.pagesProcessed += stats.pagesProcessed;
    allStats.pagesUpdated += stats.pagesUpdated;
    allStats.pagesSkipped += stats.pagesSkipped;
    allStats.errors += stats.errors;
    allStats.scoreDistribution.excellent += stats.scoreDistribution.excellent;
    allStats.scoreDistribution.good += stats.scoreDistribution.good;
    allStats.scoreDistribution.fair += stats.scoreDistribution.fair;
    allStats.scoreDistribution.poor += stats.scoreDistribution.poor;
  }

  // Print results
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Pages processed:    ${allStats.pagesProcessed}`);
  console.log(`   Pages updated:      ${allStats.pagesUpdated}`);
  console.log(`   Pages skipped:      ${allStats.pagesSkipped}`);
  console.log(`   Errors:             ${allStats.errors}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log('   Score Distribution:');
  console.log(`      🟢 Excellent (0-25):   ${allStats.scoreDistribution.excellent}`);
  console.log(`      🔵 Good (26-50):       ${allStats.scoreDistribution.good}`);
  console.log(`      🟡 Fair (51-75):       ${allStats.scoreDistribution.fair}`);
  console.log(`      🔴 Poor (76-100):      ${allStats.scoreDistribution.poor}`);
  console.log('════════════════════════════════════════════════════════════');

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('\n✅ Backfill complete!\n');
    console.log('   All pages now have quality scores.');
    console.log('   Future page saves will automatically update scores.\n');
  }

  process.exit(allStats.errors > 0 ? 1 : 0);
}

main().catch(console.error);
