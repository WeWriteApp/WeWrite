/**
 * Backfill script to populate the external links index from existing pages
 *
 * This script scans all pages and creates index entries for external links,
 * enabling O(1) lookups for "pages linking to this URL" queries.
 *
 * Usage:
 *   npx tsx scripts/backfill-external-links.ts [--dry-run] [--env=prod]
 *
 * Options:
 *   --dry-run    Preview changes without modifying the database
 *   --env=prod   Force production environment
 *
 * @see docs/features/external-links-index.md for full documentation
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
const forceProduction = args.includes('--env=prod');

// Determine environment and collection name
const isProduction = forceProduction || process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV;
const collectionPrefix = isProduction ? '' : 'DEV_';
const PAGES_COLLECTION = `${collectionPrefix}pages`;
const EXTERNAL_LINKS_COLLECTION = `${collectionPrefix}externalLinks`;

// Initialize Firebase Admin
function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  // Try to get credentials from environment
  const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;

  if (keyJson) {
    // Decode if base64 encoded
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

  // Try using service account file
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  throw new Error('No Firebase credentials found. Set GOOGLE_CLOUD_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS');
}

interface BackfillStats {
  pagesProcessed: number;
  pagesWithExternalLinks: number;
  pagesSkipped: number;
  linksIndexed: number;
  uniqueDomains: Set<string>;
  errors: number;
}

/**
 * Extract external links from editor content
 */
function extractExternalLinks(nodes: any[]): Array<{
  url: string;
  text: string;
  domain: string | null;
}> {
  const links: Array<{ url: string; text: string; domain: string | null }> = [];

  const extractFromNode = (node: any) => {
    // Check if this is a link
    if (node.type === 'link' || node.url || node.href) {
      const url = node.url || node.href || '';

      // Only process external links with http/https protocol
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // Skip WeWrite internal links
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('wewrite.app') || lowerUrl.includes('localhost')) {
          return;
        }

        // Extract domain
        let domain: string | null = null;
        try {
          domain = new URL(url).hostname;
        } catch {
          // Invalid URL, skip
        }

        // Extract text
        let linkText = node.text || node.displayText || '';
        if (!linkText && node.children && Array.isArray(node.children)) {
          linkText = node.children.map((child: any) => child.text || '').join('');
        }

        links.push({
          url,
          text: linkText || url,
          domain
        });
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

  // Deduplicate by URL
  const seen = new Set<string>();
  return links.filter(link => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

/**
 * Create a hash-like identifier from a URL
 */
function createUrlHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function backfillExternalLinks(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    pagesProcessed: 0,
    pagesWithExternalLinks: 0,
    pagesSkipped: 0,
    linksIndexed: 0,
    uniqueDomains: new Set(),
    errors: 0,
  };

  const app = initFirebase();
  const db = app.firestore();

  console.log(`\n🔄 Starting external links index backfill`);
  console.log(`   Pages collection: ${PAGES_COLLECTION}`);
  console.log(`   External links collection: ${EXTERNAL_LINKS_COLLECTION}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}\n`);

  try {
    // Clear existing external links index first (only in live mode)
    if (!dryRun) {
      console.log('🧹 Clearing existing external links index...');
      const existingDocs = await db.collection(EXTERNAL_LINKS_COLLECTION).limit(500).get();
      let deleted = 0;

      while (existingDocs.size > 0) {
        const batch = db.batch();
        existingDocs.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        deleted += existingDocs.size;

        const more = await db.collection(EXTERNAL_LINKS_COLLECTION).limit(500).get();
        if (more.empty) break;
      }

      if (deleted > 0) {
        console.log(`   ✅ Deleted ${deleted} existing entries\n`);
      }
    }

    // Process pages in batches
    const BATCH_SIZE = 100;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let batchNumber = 0;

    while (true) {
      batchNumber++;
      console.log(`📦 Processing batch ${batchNumber}...`);

      let query = db.collection(PAGES_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log('   No more pages to process.');
        break;
      }

      // Use a Firestore batch for efficient writes
      const writeBatch = db.batch();
      let batchWrites = 0;

      for (const doc of snapshot.docs) {
        stats.pagesProcessed++;
        const data = doc.data();
        const pageId = doc.id;

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

        // Parse content
        let contentNodes: any[] = [];
        try {
          if (typeof data.content === 'string') {
            contentNodes = JSON.parse(data.content);
          } else if (Array.isArray(data.content)) {
            contentNodes = data.content;
          } else {
            stats.pagesSkipped++;
            continue;
          }
        } catch {
          stats.pagesSkipped++;
          continue;
        }

        // Extract external links
        const externalLinks = extractExternalLinks(contentNodes);

        if (externalLinks.length === 0) {
          continue;
        }

        stats.pagesWithExternalLinks++;
        const now = new Date().toISOString();

        // Create index entries for each external link
        for (const link of externalLinks) {
          const urlHash = createUrlHash(link.url);
          const entryId = `${pageId}_${urlHash}`;

          const entry = {
            id: entryId,
            url: link.url,
            domain: link.domain,
            pageId,
            pageTitle: data.title || 'Untitled',
            userId: data.userId || '',
            username: data.username || 'Anonymous',
            linkText: link.text,
            createdAt: now,
            lastModified: data.lastModified || now,
            isPublic: data.isPublic !== false // Default to true
          };

          if (!dryRun) {
            const docRef = db.collection(EXTERNAL_LINKS_COLLECTION).doc(entryId);
            writeBatch.set(docRef, entry);
            batchWrites++;
          }

          stats.linksIndexed++;
          if (link.domain) {
            stats.uniqueDomains.add(link.domain);
          }
        }

        // Log sample entries
        if (stats.pagesWithExternalLinks <= 3) {
          console.log(`   📝 ${pageId}: "${data.title}" has ${externalLinks.length} external links`);
          externalLinks.slice(0, 2).forEach(link => {
            console.log(`      → ${link.domain}: ${link.url.substring(0, 60)}${link.url.length > 60 ? '...' : ''}`);
          });
        }
      }

      // Commit the batch
      if (!dryRun && batchWrites > 0) {
        await writeBatch.commit();
        console.log(`   ✅ Indexed ${batchWrites} external links`);
      }

      // Update the last document for pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    stats.errors++;
  }

  return stats;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('     BACKFILL: External Links Index');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Pages collection: ${PAGES_COLLECTION}`);
  console.log(`External links collection: ${EXTERNAL_LINKS_COLLECTION}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const stats = await backfillExternalLinks();

  // Get top domains
  const domainArray = Array.from(stats.uniqueDomains);
  const topDomains = domainArray.slice(0, 10);

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Pages processed:          ${stats.pagesProcessed}`);
  console.log(`   Pages with external links: ${stats.pagesWithExternalLinks}`);
  console.log(`   Pages skipped:             ${stats.pagesSkipped}`);
  console.log(`   External links indexed:    ${stats.linksIndexed}`);
  console.log(`   Unique domains:            ${stats.uniqueDomains.size}`);
  console.log(`   Errors:                    ${stats.errors}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log('   Sample domains indexed:');
  topDomains.forEach(domain => console.log(`      • ${domain}`));
  console.log('════════════════════════════════════════════════════════════');

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('\n✅ Backfill complete!\n');
    console.log('   The external links index is now populated.');
    console.log('   Future page saves will automatically update the index.\n');
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(console.error);
