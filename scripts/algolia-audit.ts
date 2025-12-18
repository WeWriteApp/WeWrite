/**
 * Algolia Audit Script
 *
 * Run this script to compare Firestore pages with Algolia index
 * and find pages that are not indexed.
 *
 * Usage:
 *   npx tsx scripts/algolia-audit.ts [--backfill] [--limit=100]
 *
 * Options:
 *   --backfill   Actually perform the backfill (dry run by default)
 *   --limit=N    Maximum pages to process (default: 5000)
 *   --env=prod   Force production environment
 */

import * as admin from 'firebase-admin';
import { algoliasearch, type SearchClient } from 'algoliasearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const shouldBackfill = args.includes('--backfill');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5000;
const forceProduction = args.includes('--env=prod');

// Configuration
const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY!;

// Determine environment
const isProduction = forceProduction || process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV;
const collectionPrefix = isProduction ? '' : 'DEV_';
const indexPrefix = isProduction ? '' : 'DEV_';

const PAGES_COLLECTION = `${collectionPrefix}pages`;
const PAGES_INDEX = `${indexPrefix}pages`;

console.log('🔍 Algolia Audit Script');
console.log('='.repeat(50));
console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`Firestore Collection: ${PAGES_COLLECTION}`);
console.log(`Algolia Index: ${PAGES_INDEX}`);
console.log(`Limit: ${limit}`);
console.log(`Backfill: ${shouldBackfill ? 'YES' : 'NO (dry run)'}`);
console.log('='.repeat(50));

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

// Initialize Algolia client
function initAlgolia(): SearchClient {
  if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
    throw new Error('Algolia credentials not configured. Set NEXT_PUBLIC_ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY');
  }
  return algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
}

// Extract text from Slate.js content
function extractTextFromContent(content: any): string {
  if (!content) return '';

  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      return content;
    }
  }

  if (Array.isArray(content)) {
    return content
      .map((node: any) => {
        if (node.text) return node.text;
        if (node.children) return extractTextFromContent(node.children);
        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
}

// Convert timestamp to Unix timestamp
function toUnixTimestamp(timestamp: any): number {
  if (!timestamp) return Date.now();
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp._seconds) return timestamp._seconds * 1000;
  if (typeof timestamp === 'number') return timestamp;
  return Date.now();
}

interface PageInfo {
  id: string;
  title: string;
  createdAt: Date;
  authorUsername?: string;
  content?: any;
  userId?: string;
  isPublic?: boolean;
  lastModified?: any;
  alternativeTitles?: string[];
}

async function main() {
  try {
    // Initialize clients
    console.log('\n📦 Initializing clients...');
    const app = initFirebase();
    const db = admin.firestore();
    const algolia = initAlgolia();
    console.log('✅ Clients initialized');

    // Step 1: Get all valid pages from Firestore
    console.log('\n📚 Fetching pages from Firestore...');
    const firestorePages = new Map<string, PageInfo>();
    let lastDoc: admin.firestore.DocumentSnapshot | null = null;
    const batchSize = 500;
    let totalFetched = 0;

    while (firestorePages.size < limit) {
      let query: admin.firestore.Query = db.collection(PAGES_COLLECTION).limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) break;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        // Only count valid pages (not deleted, has title)
        if (!data.deleted && data.title) {
          firestorePages.set(doc.id, {
            id: doc.id,
            title: data.title,
            createdAt: data.createdAt?.toDate?.() || new Date(toUnixTimestamp(data.createdAt)),
            authorUsername: data.authorUsername || '',
            content: data.content,
            userId: data.userId,
            isPublic: data.isPublic ?? true,
            lastModified: data.lastModified,
            alternativeTitles: data.alternativeTitles || []
          });
        }
      }

      totalFetched += snapshot.docs.length;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      process.stdout.write(`\r  Fetched ${totalFetched} documents, ${firestorePages.size} valid pages...`);

      if (snapshot.docs.length < batchSize) break;
      if (firestorePages.size >= limit) break;
    }

    console.log(`\n✅ Found ${firestorePages.size} valid pages in Firestore`);

    // Step 2: Get all pages from Algolia using browse API (no pagination limit)
    console.log('\n🔎 Fetching pages from Algolia...');
    const algoliaPageIds = new Set<string>();

    try {
      // Use browse API to get ALL records without pagination limits
      let cursor: string | undefined;
      let batchCount = 0;

      do {
        const browseParams: any = {
          hitsPerPage: 1000,
          attributesToRetrieve: ['objectID'],
        };

        if (cursor) {
          browseParams.cursor = cursor;
        }

        const response = await algolia.browse({
          indexName: PAGES_INDEX,
          browseParams,
        });

        if (response.hits) {
          for (const hit of response.hits) {
            algoliaPageIds.add(hit.objectID);
          }
        }

        cursor = response.cursor;
        batchCount++;
        process.stdout.write(`\r  Fetched ${algoliaPageIds.size} indexed pages (batch ${batchCount})...`);

        // Safety limit
        if (batchCount > 100) {
          console.log('\n⚠️ Reached batch limit, stopping Algolia fetch');
          break;
        }
      } while (cursor);

    } catch (err) {
      console.error('\n❌ Error fetching from Algolia:', err);
    }

    console.log(`\n✅ Found ${algoliaPageIds.size} pages in Algolia`);

    // Step 3: Compare and find differences
    console.log('\n📊 Analyzing differences...');

    const missingFromAlgolia: PageInfo[] = [];
    const extraInAlgolia: string[] = [];

    for (const [pageId, pageData] of firestorePages) {
      if (!algoliaPageIds.has(pageId)) {
        missingFromAlgolia.push(pageData);
      }
    }

    for (const algoliaId of algoliaPageIds) {
      if (!firestorePages.has(algoliaId)) {
        extraInAlgolia.push(algoliaId);
      }
    }

    // Sort missing pages by creation date (newest first)
    missingFromAlgolia.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📋 AUDIT SUMMARY');
    console.log('='.repeat(50));
    console.log(`Firestore pages: ${firestorePages.size}`);
    console.log(`Algolia pages:   ${algoliaPageIds.size}`);
    console.log(`Missing from Algolia: ${missingFromAlgolia.length}`);
    console.log(`Extra in Algolia (orphaned): ${extraInAlgolia.length}`);
    console.log(`Index coverage: ${((algoliaPageIds.size / firestorePages.size) * 100).toFixed(1)}%`);

    if (missingFromAlgolia.length > 0) {
      console.log('\n📝 Pages missing from Algolia (newest first):');
      console.log('-'.repeat(50));
      const displayCount = Math.min(20, missingFromAlgolia.length);
      for (let i = 0; i < displayCount; i++) {
        const page = missingFromAlgolia[i];
        console.log(`  ${i + 1}. [${page.createdAt.toISOString().split('T')[0]}] "${page.title}" (${page.id.substring(0, 8)}...)`);
      }
      if (missingFromAlgolia.length > displayCount) {
        console.log(`  ... and ${missingFromAlgolia.length - displayCount} more`);
      }
    }

    // Step 4: Backfill if requested
    if (shouldBackfill && missingFromAlgolia.length > 0) {
      console.log('\n🔄 Starting backfill...');
      console.log('-'.repeat(50));

      const records = [];
      let processedCount = 0;
      const errors: string[] = [];

      for (const page of missingFromAlgolia) {
        try {
          const record = {
            objectID: page.id,
            title: page.title,
            content: extractTextFromContent(page.content)?.substring(0, 5000),
            authorId: page.userId || '',
            authorUsername: page.authorUsername || '',
            isPublic: page.isPublic ?? true,
            createdAt: toUnixTimestamp(page.createdAt),
            lastModified: toUnixTimestamp(page.lastModified),
            alternativeTitles: page.alternativeTitles || [],
          };

          records.push(record);
          processedCount++;

          process.stdout.write(`\r  Processed ${processedCount}/${missingFromAlgolia.length} pages...`);
        } catch (err) {
          errors.push(`Error processing ${page.id}: ${err}`);
        }
      }

      console.log('');

      // Save to Algolia in batches
      const algoliaClient = initAlgolia();
      let backfilledCount = 0;
      const algoliBatchSize = 100;

      for (let i = 0; i < records.length; i += algoliBatchSize) {
        const batch = records.slice(i, i + algoliBatchSize);
        try {
          await algoliaClient.saveObjects({
            indexName: PAGES_INDEX,
            objects: batch,
          });
          backfilledCount += batch.length;
          console.log(`  ✅ Saved batch of ${batch.length} (total: ${backfilledCount})`);
        } catch (err) {
          console.error(`  ❌ Error saving batch:`, err);
          errors.push(`Batch save error: ${err}`);
        }
      }

      console.log('\n' + '='.repeat(50));
      console.log('✅ BACKFILL COMPLETE');
      console.log('='.repeat(50));
      console.log(`Pages backfilled: ${backfilledCount}`);
      if (errors.length > 0) {
        console.log(`Errors: ${errors.length}`);
        errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
      }
    } else if (!shouldBackfill && missingFromAlgolia.length > 0) {
      console.log('\n💡 To backfill missing pages, run with --backfill flag:');
      console.log(`   npx tsx scripts/algolia-audit.ts --backfill`);
    }

    // Output JSON for programmatic use
    if (args.includes('--json')) {
      const result = {
        environment: isProduction ? 'production' : 'development',
        timestamp: new Date().toISOString(),
        firestoreCount: firestorePages.size,
        algoliaCount: algoliaPageIds.size,
        missingCount: missingFromAlgolia.length,
        extraCount: extraInAlgolia.length,
        indexCoverage: ((algoliaPageIds.size / firestorePages.size) * 100).toFixed(1) + '%',
        missingPageIds: missingFromAlgolia.map(p => p.id)
      };
      console.log('\n📄 JSON Output:');
      console.log(JSON.stringify(result, null, 2));
    }

    console.log('\n✨ Done!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
