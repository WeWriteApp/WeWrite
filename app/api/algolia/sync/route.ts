/**
 * Algolia Sync API Route
 *
 * Syncs Firestore data to Algolia indices.
 * This should be called:
 * 1. Initially to populate all data
 * 2. Periodically via cron to catch any missed updates
 * 3. Manually when needed
 *
 * For real-time sync, we'll add Firestore triggers separately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, getAlgoliaIndexName, ALGOLIA_INDICES, AlgoliaPageRecord, AlgoliaUserRecord } from '../../../lib/algolia';
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
 * Convert Firestore timestamp to Unix timestamp
 */
function toUnixTimestamp(timestamp: any): number {
  if (!timestamp) return Date.now();
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp._seconds) return timestamp._seconds * 1000;
  if (typeof timestamp === 'number') return timestamp;
  return Date.now();
}

/**
 * Sync pages to Algolia
 */
async function syncPages(db: FirebaseFirestore.Firestore, batchSize: number = 100): Promise<{ synced: number; errors: number }> {
  const client = getAdminClient();
  const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);
  const collectionName = getCollectionName('pages');

  console.log(`[Algolia Sync] Syncing pages from ${collectionName} to ${indexName}`);

  let synced = 0;
  let errors = 0;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  // Configure index settings for pages
  await client.setSettings({
    indexName,
    indexSettings: {
      searchableAttributes: [
        'title',
        'alternativeTitles',
        'content',
        'authorUsername'
      ],
      attributesForFaceting: [
        'filterOnly(isPublic)',
        'filterOnly(authorId)'
      ],
      ranking: [
        'typo',
        'geo',
        'words',
        'filters',
        'proximity',
        'attribute',
        'exact',
        'custom'
      ],
      customRanking: ['desc(lastModified)'],
    },
  });

  while (true) {
    // Build query - simple query without ordering to avoid index requirements
    // For DEV_ collections, we just need to get all non-deleted pages
    let query: FirebaseFirestore.Query = db.collection(collectionName)
      .limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`[Algolia Sync] No more pages to sync`);
      break;
    }

    const records: AlgoliaPageRecord[] = [];

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        // Skip deleted pages and pages without title
        if (data.deleted || !data.title) continue;

        const record: AlgoliaPageRecord = {
          objectID: doc.id,
          title: data.title,
          content: extractTextFromContent(data.content)?.substring(0, 5000), // Limit content size
          authorId: data.userId || data.authorId || '',
          authorUsername: data.authorUsername || '',
          isPublic: data.isPublic ?? true,
          createdAt: toUnixTimestamp(data.createdAt),
          lastModified: toUnixTimestamp(data.lastModified),
          alternativeTitles: data.alternativeTitles || [],
        };

        records.push(record);
      } catch (err) {
        console.error(`[Algolia Sync] Error processing page ${doc.id}:`, err);
        errors++;
      }
    }

    if (records.length > 0) {
      try {
        await client.saveObjects({
          indexName,
          objects: records,
        });
        synced += records.length;
        console.log(`[Algolia Sync] Synced ${records.length} pages (total: ${synced})`);
      } catch (err) {
        console.error(`[Algolia Sync] Error saving pages batch:`, err);
        errors += records.length;
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return { synced, errors };
}

/**
 * Sync users to Algolia
 */
async function syncUsers(db: FirebaseFirestore.Firestore, batchSize: number = 100): Promise<{ synced: number; errors: number }> {
  const client = getAdminClient();
  const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.USERS);
  const collectionName = getCollectionName('users');

  console.log(`[Algolia Sync] Syncing users from ${collectionName} to ${indexName}`);

  let synced = 0;
  let errors = 0;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  // Configure index settings for users
  await client.setSettings({
    indexName,
    indexSettings: {
      searchableAttributes: [
        'username',
        'displayName',
        'bio'
      ],
      ranking: [
        'typo',
        'geo',
        'words',
        'filters',
        'proximity',
        'attribute',
        'exact',
        'custom'
      ],
    },
  });

  while (true) {
    // Build query - simple query to get users
    let query: FirebaseFirestore.Query = db.collection(collectionName)
      .limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`[Algolia Sync] No more users to sync`);
      break;
    }

    const records: AlgoliaUserRecord[] = [];

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        // Skip if no username
        if (!data.username) continue;

        const record: AlgoliaUserRecord = {
          objectID: doc.id,
          username: data.username,
          usernameLower: data.usernameLower || data.username.toLowerCase(),
          displayName: data.displayName || data.username,
          bio: data.bio || '',
          photoURL: data.photoURL || '',
          createdAt: toUnixTimestamp(data.createdAt),
        };

        records.push(record);
      } catch (err) {
        console.error(`[Algolia Sync] Error processing user ${doc.id}:`, err);
        errors++;
      }
    }

    if (records.length > 0) {
      try {
        await client.saveObjects({
          indexName,
          objects: records,
        });
        synced += records.length;
        console.log(`[Algolia Sync] Synced ${records.length} users (total: ${synced})`);
      } catch (err) {
        console.error(`[Algolia Sync] Error saving users batch:`, err);
        errors += records.length;
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return { synced, errors };
}

/**
 * POST /api/algolia/sync
 * Sync all data from Firestore to Algolia
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check here
    // const session = await getSession(request);
    // if (!session?.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const db = getAdminFirestore();
    const envType = getEnvironmentType();

    console.log(`[Algolia Sync] Starting sync for environment: ${envType}`);

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

    console.log(`[Algolia Sync] Sync complete:`, results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Algolia Sync] Error:', error);
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
 * GET /api/algolia/sync
 * Get sync status and index info
 */
export async function GET(request: NextRequest) {
  try {
    const client = getAdminClient();
    const envType = getEnvironmentType();
    const pagesIndex = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);
    const usersIndex = getAlgoliaIndexName(ALGOLIA_INDICES.USERS);

    // Get index stats
    let pagesStats = null;
    let usersStats = null;

    try {
      const pagesSettings = await client.getSettings({ indexName: pagesIndex });
      pagesStats = { configured: true };
    } catch (err) {
      pagesStats = { configured: false, error: 'Index not found or not configured' };
    }

    try {
      const usersSettings = await client.getSettings({ indexName: usersIndex });
      usersStats = { configured: true };
    } catch (err) {
      usersStats = { configured: false, error: 'Index not found or not configured' };
    }

    return NextResponse.json({
      environment: envType,
      indices: {
        pages: {
          name: pagesIndex,
          ...pagesStats,
        },
        users: {
          name: usersIndex,
          ...usersStats,
        },
      },
    });
  } catch (error) {
    console.error('[Algolia Sync] Error getting status:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
