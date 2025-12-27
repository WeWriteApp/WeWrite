/**
 * Typesense Sync API Route
 *
 * Syncs Firestore data to Typesense collections.
 * This should be called:
 * 1. Initially to populate all data
 * 2. Periodically via cron to catch any missed updates
 * 3. Manually when needed
 *
 * For real-time sync, pages are synced via the sync-page endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminClient,
  getTypesenseCollectionName,
  TYPESENSE_COLLECTIONS,
  TypesensePageDocument,
  TypesenseUserDocument,
  ensureCollectionsExist,
  getCollectionStats,
  isTypesenseAdminConfigured,
} from '../../../lib/typesense';
import { getAdminFirestore } from '../../../firebase/admin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * Extract plain text from Slate.js editor content
 */
function extractTextFromContent(content: any): string {
  if (!content) return '';

  // If it's a string, return it directly
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      return content;
    }
  }

  // If it's an array (Slate.js format), extract text
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

/**
 * Convert Firestore timestamp to Unix timestamp (seconds)
 */
function toUnixTimestamp(timestamp: any): number {
  if (!timestamp) return Math.floor(Date.now() / 1000);
  if (timestamp.toMillis) return Math.floor(timestamp.toMillis() / 1000);
  if (timestamp._seconds) return timestamp._seconds;
  if (typeof timestamp === 'number') return Math.floor(timestamp / 1000);
  return Math.floor(Date.now() / 1000);
}

/**
 * Sync pages to Typesense
 */
async function syncPages(db: FirebaseFirestore.Firestore, batchSize: number = 100): Promise<{ synced: number; errors: number }> {
  const client = getAdminClient();
  const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.PAGES);
  const firestoreCollectionName = getCollectionName('pages');

  console.log(`[Typesense Sync] Syncing pages from ${firestoreCollectionName} to ${collectionName}`);

  let synced = 0;
  let errors = 0;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  while (true) {
    // Build query - simple query without ordering to avoid index requirements
    let query: FirebaseFirestore.Query = db.collection(firestoreCollectionName)
      .limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`[Typesense Sync] No more pages to sync`);
      break;
    }

    const documents: TypesensePageDocument[] = [];

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        // Skip deleted pages and pages without title
        if (data.deleted || !data.title) continue;

        const document: TypesensePageDocument = {
          id: doc.id,
          title: data.title,
          titleLower: data.title.toLowerCase(),
          content: extractTextFromContent(data.content)?.substring(0, 10000), // Limit content size
          authorId: data.userId || data.authorId || '',
          authorUsername: data.authorUsername || '',
          isPublic: data.isPublic ?? true,
          createdAt: toUnixTimestamp(data.createdAt),
          lastModified: toUnixTimestamp(data.lastModified),
          alternativeTitles: data.alternativeTitles || [],
        };

        documents.push(document);
      } catch (err) {
        console.error(`[Typesense Sync] Error processing page ${doc.id}:`, err);
        errors++;
      }
    }

    if (documents.length > 0) {
      try {
        // Typesense supports upsert via import with action: 'upsert'
        const results = await client
          .collections(collectionName)
          .documents()
          .import(documents, { action: 'upsert' });

        // Count successes and failures
        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.filter((r: any) => !r.success).length;

        synced += successCount;
        errors += failCount;

        if (failCount > 0) {
          const failures = results.filter((r: any) => !r.success);
          console.error(`[Typesense Sync] ${failCount} pages failed:`, failures.slice(0, 3));
        }

        console.log(`[Typesense Sync] Synced ${successCount} pages (total: ${synced})`);
      } catch (err) {
        console.error(`[Typesense Sync] Error saving pages batch:`, err);
        errors += documents.length;
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return { synced, errors };
}

/**
 * Sync users to Typesense
 */
async function syncUsers(db: FirebaseFirestore.Firestore, batchSize: number = 100): Promise<{ synced: number; errors: number }> {
  const client = getAdminClient();
  const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.USERS);
  const firestoreCollectionName = getCollectionName('users');

  console.log(`[Typesense Sync] Syncing users from ${firestoreCollectionName} to ${collectionName}`);

  let synced = 0;
  let errors = 0;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  while (true) {
    // Build query - simple query to get users
    let query: FirebaseFirestore.Query = db.collection(firestoreCollectionName)
      .limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`[Typesense Sync] No more users to sync`);
      break;
    }

    const documents: TypesenseUserDocument[] = [];

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        // Skip if no username
        if (!data.username) continue;

        const document: TypesenseUserDocument = {
          id: doc.id,
          username: data.username,
          usernameLower: data.usernameLower || data.username.toLowerCase(),
          displayName: data.displayName || data.username,
          bio: data.bio || '',
          photoURL: data.photoURL || '',
          createdAt: toUnixTimestamp(data.createdAt),
        };

        documents.push(document);
      } catch (err) {
        console.error(`[Typesense Sync] Error processing user ${doc.id}:`, err);
        errors++;
      }
    }

    if (documents.length > 0) {
      try {
        const results = await client
          .collections(collectionName)
          .documents()
          .import(documents, { action: 'upsert' });

        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.filter((r: any) => !r.success).length;

        synced += successCount;
        errors += failCount;

        if (failCount > 0) {
          const failures = results.filter((r: any) => !r.success);
          console.error(`[Typesense Sync] ${failCount} users failed:`, failures.slice(0, 3));
        }

        console.log(`[Typesense Sync] Synced ${successCount} users (total: ${synced})`);
      } catch (err) {
        console.error(`[Typesense Sync] Error saving users batch:`, err);
        errors += documents.length;
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return { synced, errors };
}

/**
 * POST /api/typesense/sync
 * Sync all data from Firestore to Typesense
 */
export async function POST(request: NextRequest) {
  try {
    if (!isTypesenseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Typesense admin credentials not configured' },
        { status: 503 }
      );
    }

    const db = getAdminFirestore();
    const envType = getEnvironmentType();

    console.log(`[Typesense Sync] Starting sync for environment: ${envType}`);

    // Ensure collections exist first
    console.log(`[Typesense Sync] Ensuring collections exist...`);
    await ensureCollectionsExist();

    // Parse request body for options
    let shouldSyncPages = true;
    let shouldSyncUsers = true;

    try {
      const body = await request.json();
      shouldSyncPages = body.pages !== false;
      shouldSyncUsers = body.users !== false;
    } catch {
      // No body or invalid JSON, use defaults
    }

    const results: any = {
      environment: envType,
      timestamp: new Date().toISOString(),
    };

    if (shouldSyncPages) {
      results.pages = await syncPages(db);
    }

    if (shouldSyncUsers) {
      results.users = await syncUsers(db);
    }

    console.log(`[Typesense Sync] Sync complete:`, results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Typesense Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/typesense/sync
 * Get sync status and collection info
 */
export async function GET(request: NextRequest) {
  try {
    if (!isTypesenseAdminConfigured()) {
      return NextResponse.json({
        configured: false,
        error: 'Typesense admin credentials not configured',
      });
    }

    const envType = getEnvironmentType();
    const stats = await getCollectionStats();

    return NextResponse.json({
      configured: true,
      environment: envType,
      collections: {
        pages: stats.pages ? {
          name: stats.pages.name,
          numDocuments: stats.pages.numDocuments,
          configured: true,
        } : {
          configured: false,
          error: 'Collection not found',
        },
        users: stats.users ? {
          name: stats.users.name,
          numDocuments: stats.users.numDocuments,
          configured: true,
        } : {
          configured: false,
          error: 'Collection not found',
        },
      },
    });
  } catch (error) {
    console.error('[Typesense Sync] Error getting status:', error);
    return NextResponse.json(
      {
        configured: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
