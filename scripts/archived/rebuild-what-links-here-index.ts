/**
 * Rebuild What Links Here Index Script
 *
 * This script rebuilds the what-links-here index from scratch using firebase-admin.
 * It scans all pages and creates index entries for efficient retrieval of pages
 * that link to any given page.
 *
 * Note: The Firestore collection is still named "backlinks" for backward compatibility.
 *
 * Usage:
 *   npx tsx scripts/rebuild-what-links-here-index.ts [--env=prod|dev] [--dry-run] [--page=pageId]
 *
 * Options:
 *   --env=prod   Force production environment
 *   --env=dev    Force development environment
 *   --dry-run    Show what would be done without making changes
 *   --page=ID    Only process a specific page (useful for testing)
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const envArg = args.find(a => a.startsWith('--env='));
const forcedEnv = envArg ? envArg.split('=')[1] : null;
const isDryRun = args.includes('--dry-run');
const pageArg = args.find(a => a.startsWith('--page='));
const specificPageId = pageArg ? pageArg.split('=')[1] : null;

// Determine environment
const isProduction = forcedEnv === 'prod' || (!forcedEnv && (process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV));
const collectionPrefix = isProduction ? '' : 'DEV_';

const PAGES_COLLECTION = `${collectionPrefix}pages`;
// Collection name kept as 'backlinks' for backward compatibility with existing data
const WHAT_LINKS_HERE_COLLECTION = `${collectionPrefix}backlinks`;
const USERS_COLLECTION = `${collectionPrefix}users`;

console.log('🔗 What Links Here Index Rebuild Script');
console.log('='.repeat(50));
console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`Pages Collection: ${PAGES_COLLECTION}`);
console.log(`What Links Here Collection: ${WHAT_LINKS_HERE_COLLECTION}`);
console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
if (specificPageId) {
  console.log(`Specific Page: ${specificPageId}`);
}
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

  // Try default credentials (for local development with gcloud auth)
  return admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

interface LinkData {
  url: string;
  text: string;
  type: 'page' | 'user' | 'external';
  pageId?: string;
  userId?: string;
}

/**
 * Extract links from editor content nodes
 * Simplified version of the extractLinksFromNodes function
 */
function extractLinksFromNodes(nodes: any[]): LinkData[] {
  const links: LinkData[] = [];

  const extractFromNode = (node: any) => {
    if (!node || typeof node !== 'object') return;

    // Check if this node is a link
    if (node.type === 'link' || node.url || node.href || node.pageId) {
      // Extract text from children if available
      let linkText = node.text || node.displayText || '';
      if (!linkText && node.children && Array.isArray(node.children)) {
        linkText = node.children.map((child: any) => child.text || '').join('');
      }

      const linkData: LinkData = {
        url: node.url || node.href || '',
        text: linkText,
        type: 'external'
      };

      // Check for direct pageId property first (most reliable)
      if (node.pageId) {
        linkData.type = 'page';
        linkData.pageId = node.pageId;
      }
      // Check for isPageLink flag
      else if (node.isPageLink) {
        linkData.type = 'page';
        // Try to extract pageId from URL
        if (linkData.url.startsWith('/pages/')) {
          linkData.pageId = linkData.url.replace('/pages/', '').split(/[\/\?#]/)[0];
        } else if (linkData.url.startsWith('/') && linkData.url.length > 1) {
          const directPageId = linkData.url.substring(1).split(/[\/\?#]/)[0];
          if (!directPageId.includes('/')) {
            linkData.pageId = directPageId;
          }
        }
      }
      // Check URL patterns for internal links
      else if (linkData.url.startsWith('/') && !linkData.url.startsWith('/users')) {
        linkData.type = 'page';
        if (linkData.url.startsWith('/pages/')) {
          linkData.pageId = linkData.url.replace('/pages/', '').split(/[\/\?#]/)[0];
        } else if (linkData.url.length > 1) {
          const directPageId = linkData.url.substring(1).split(/[\/\?#]/)[0];
          if (!directPageId.includes('/')) {
            linkData.pageId = directPageId;
          }
        }
      }

      if (linkData.pageId) {
        links.push(linkData);
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

  // Remove duplicates based on pageId
  const uniqueLinks = links.filter((link, index, self) =>
    index === self.findIndex(l => l.pageId === link.pageId)
  );

  return uniqueLinks;
}

interface WhatLinksHereEntry {
  id: string;
  sourcePageId: string;
  sourcePageTitle: string;
  sourceUsername: string;
  targetPageId: string;
  linkText: string;
  linkUrl: string;
  createdAt: admin.firestore.FieldValue;
  lastModified: string;
  isPublic: boolean;
}

async function rebuildWhatLinksHereIndex() {
  const app = initFirebase();
  const db = admin.firestore();

  console.log('\n📊 Starting what-links-here index rebuild...\n');

  // Stats
  let pagesProcessed = 0;
  let entriesCreated = 0;
  let entriesDeleted = 0;
  let errors = 0;

  // Build user lookup cache (userId -> username)
  const userCache = new Map<string, string>();
  console.log('👤 Building user cache...');
  const usersSnapshot = await db.collection(USERS_COLLECTION).get();
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    // The document ID is the userId, and userData.username is the actual username
    if (userData.username) {
      userCache.set(userDoc.id, userData.username);
    }
  }
  console.log(`   Cached ${userCache.size} users\n`);

  try {
    // Step 1: Clear existing entries (unless processing specific page)
    if (!specificPageId && !isDryRun) {
      console.log('🗑️  Clearing existing index entries...');
      const existingEntries = await db.collection(WHAT_LINKS_HERE_COLLECTION).get();

      if (!existingEntries.empty) {
        const batchSize = 500;
        const batches: admin.firestore.WriteBatch[] = [];
        let currentBatch = db.batch();
        let operationCount = 0;

        for (const doc of existingEntries.docs) {
          currentBatch.delete(doc.ref);
          operationCount++;
          entriesDeleted++;

          if (operationCount >= batchSize) {
            batches.push(currentBatch);
            currentBatch = db.batch();
            operationCount = 0;
          }
        }

        if (operationCount > 0) {
          batches.push(currentBatch);
        }

        for (const batch of batches) {
          await batch.commit();
        }

        console.log(`   Deleted ${entriesDeleted} existing entries\n`);
      } else {
        console.log('   No existing entries to delete\n');
      }
    }

    // Step 2: Get pages to process
    let pagesQuery: admin.firestore.Query = db.collection(PAGES_COLLECTION);

    if (specificPageId) {
      // Get specific page
      const pageDoc = await db.collection(PAGES_COLLECTION).doc(specificPageId).get();
      if (!pageDoc.exists) {
        console.error(`❌ Page ${specificPageId} not found`);
        return;
      }

      const pageData = pageDoc.data()!;
      await processPage(db, pageDoc.id, pageData);
      pagesProcessed = 1;
    } else {
      // Get all non-deleted pages
      const pagesSnapshot = await pagesQuery.get();
      console.log(`📄 Found ${pagesSnapshot.size} pages to process\n`);

      for (const pageDoc of pagesSnapshot.docs) {
        const pageData = pageDoc.data();

        // Skip deleted pages
        if (pageData.deleted === true) {
          continue;
        }

        try {
          const linksCreated = await processPage(db, pageDoc.id, pageData);
          entriesCreated += linksCreated;
          pagesProcessed++;

          if (pagesProcessed % 50 === 0) {
            console.log(`   Progress: ${pagesProcessed} pages processed, ${entriesCreated} entries created`);
          }
        } catch (err) {
          console.error(`   ❌ Error processing page ${pageDoc.id}:`, err);
          errors++;
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 REBUILD COMPLETE');
    console.log('='.repeat(50));
    console.log(`Pages processed: ${pagesProcessed}`);
    console.log(`Entries deleted: ${entriesDeleted}`);
    console.log(`Entries created: ${entriesCreated}`);
    console.log(`Errors: ${errors}`);
    if (isDryRun) {
      console.log('\n⚠️  DRY RUN - No changes were made');
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }

  async function processPage(
    db: admin.firestore.Firestore,
    pageId: string,
    pageData: admin.firestore.DocumentData
  ): Promise<number> {
    // Parse content
    let contentNodes: any[] = [];

    if (pageData.content) {
      if (typeof pageData.content === 'string') {
        try {
          contentNodes = JSON.parse(pageData.content);
        } catch {
          // Could not parse content
          return 0;
        }
      } else if (Array.isArray(pageData.content)) {
        contentNodes = pageData.content;
      }
    }

    // Extract page links
    const links = extractLinksFromNodes(contentNodes);
    const pageLinks = links.filter(link => link.type === 'page' && link.pageId);

    if (pageLinks.length === 0) {
      return 0;
    }

    const pageTitle = pageData.title || 'Untitled';
    // The page.username field often contains userId, so look up the actual username
    const userIdOrUsername = pageData.username || pageData.userId || '';
    const username = userCache.get(userIdOrUsername) || userIdOrUsername || 'Anonymous';
    // Treat pages as public unless explicitly set to false
    // Most pages don't have isPublic set, so we default to true
    const isPublic = pageData.isPublic !== false;
    const lastModified = pageData.lastModified || new Date().toISOString();

    if (isDryRun) {
      console.log(`   [DRY RUN] ${pageTitle} -> ${pageLinks.length} links: ${pageLinks.map(l => l.pageId).join(', ')}`);
      return pageLinks.length;
    }

    // Create what-links-here entries
    const batch = db.batch();

    for (const link of pageLinks) {
      const entryId = `${pageId}_to_${link.pageId}`;
      const entryRef = db.collection(WHAT_LINKS_HERE_COLLECTION).doc(entryId);

      const entry: WhatLinksHereEntry = {
        id: entryId,
        sourcePageId: pageId,
        sourcePageTitle: pageTitle,
        sourceUsername: username,
        targetPageId: link.pageId!,
        linkText: link.text || '',
        linkUrl: link.url || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModified: lastModified,
        isPublic: isPublic
      };

      batch.set(entryRef, entry);
    }

    await batch.commit();

    console.log(`   ✅ ${pageTitle}: ${pageLinks.length} entries created`);
    return pageLinks.length;
  }
}

// Run the script
rebuildWhatLinksHereIndex()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
