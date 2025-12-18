/**
 * Algolia Audit & Backfill API
 *
 * Admin endpoint to:
 * 1. Compare Firestore pages with Algolia index
 * 2. Find pages that are not indexed
 * 3. Optionally backfill missing pages
 *
 * GET /api/admin/algolia-audit - Get audit report of missing pages
 * POST /api/admin/algolia-audit - Backfill missing pages to Algolia
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, getAlgoliaIndexName, ALGOLIA_INDICES, AlgoliaPageRecord } from '../../../lib/algolia';
import { getAdminFirestore } from '../../../firebase/admin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { verifyAdminAccess, createAdminUnauthorizedResponse } from '../../../utils/adminSecurity';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow longer execution for large datasets

interface AuditResult {
  environment: string;
  timestamp: string;
  firestoreCount: number;
  algoliaCount: number;
  missingFromAlgolia: string[];
  missingFromAlgoliaDetails: Array<{
    id: string;
    title: string;
    createdAt: string;
    authorUsername?: string;
  }>;
  extraInAlgolia: string[];
  summary: {
    totalMissing: number;
    totalExtra: number;
    indexCoverage: string;
  };
}

/**
 * Extract plain text from Slate.js editor content
 */
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
 * GET /api/admin/algolia-audit
 * Compare Firestore pages with Algolia index and find missing pages
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify admin access
    const adminAuth = await verifyAdminAccess(request);
    if (!adminAuth.isAdmin) {
      return createAdminUnauthorizedResponse(adminAuth.auditId);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const includeDetails = searchParams.get('details') !== 'false';

    console.log(`[Algolia Audit] Starting audit for admin: ${adminAuth.userId}`);

    const db = getAdminFirestore();
    const client = getAdminClient();
    const envType = getEnvironmentType();
    const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);
    const collectionName = getCollectionName('pages');

    console.log(`[Algolia Audit] Environment: ${envType}, Index: ${indexName}, Collection: ${collectionName}`);

    // Step 1: Get all page IDs from Firestore (non-deleted, with title)
    const firestorePages = new Map<string, { title: string; createdAt: any; authorUsername?: string }>();
    let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    const batchSize = 500;

    while (firestorePages.size < limit) {
      let query: FirebaseFirestore.Query = db.collection(collectionName).limit(batchSize);

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
            title: data.title,
            createdAt: data.createdAt,
            authorUsername: data.authorUsername || ''
          });
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.docs.length < batchSize) break;
    }

    console.log(`[Algolia Audit] Found ${firestorePages.size} valid pages in Firestore`);

    // Step 2: Get all page IDs from Algolia
    const algoliaPageIds = new Set<string>();
    let algoliaPage = 0;
    const algoliaHitsPerPage = 1000;

    while (true) {
      try {
        const response = await client.searchSingleIndex<AlgoliaPageRecord>({
          indexName,
          searchParams: {
            query: '',
            hitsPerPage: algoliaHitsPerPage,
            page: algoliaPage,
            attributesToRetrieve: ['objectID'],
          },
        });

        if (!response.hits || response.hits.length === 0) break;

        for (const hit of response.hits) {
          algoliaPageIds.add(hit.objectID);
        }

        console.log(`[Algolia Audit] Fetched ${response.hits.length} from Algolia (page ${algoliaPage}, total: ${algoliaPageIds.size})`);

        if (response.hits.length < algoliaHitsPerPage) break;
        algoliaPage++;

        // Safety limit
        if (algoliaPage > 50) {
          console.log(`[Algolia Audit] Reached page limit, stopping Algolia fetch`);
          break;
        }
      } catch (err) {
        console.error(`[Algolia Audit] Error fetching from Algolia:`, err);
        break;
      }
    }

    console.log(`[Algolia Audit] Found ${algoliaPageIds.size} pages in Algolia`);

    // Step 3: Compare and find differences
    const missingFromAlgolia: string[] = [];
    const missingFromAlgoliaDetails: Array<{
      id: string;
      title: string;
      createdAt: string;
      authorUsername?: string;
    }> = [];

    for (const [pageId, pageData] of firestorePages) {
      if (!algoliaPageIds.has(pageId)) {
        missingFromAlgolia.push(pageId);
        if (includeDetails) {
          missingFromAlgoliaDetails.push({
            id: pageId,
            title: pageData.title,
            createdAt: pageData.createdAt?.toDate?.()?.toISOString?.() ||
                       new Date(toUnixTimestamp(pageData.createdAt)).toISOString(),
            authorUsername: pageData.authorUsername
          });
        }
      }
    }

    // Find pages in Algolia but not in Firestore (orphaned index entries)
    const extraInAlgolia: string[] = [];
    for (const algoliaId of algoliaPageIds) {
      if (!firestorePages.has(algoliaId)) {
        extraInAlgolia.push(algoliaId);
      }
    }

    // Sort missing pages by creation date (newest first)
    missingFromAlgoliaDetails.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const result: AuditResult = {
      environment: envType,
      timestamp: new Date().toISOString(),
      firestoreCount: firestorePages.size,
      algoliaCount: algoliaPageIds.size,
      missingFromAlgolia,
      missingFromAlgoliaDetails: includeDetails ? missingFromAlgoliaDetails : [],
      extraInAlgolia: extraInAlgolia.slice(0, 100), // Limit to prevent huge responses
      summary: {
        totalMissing: missingFromAlgolia.length,
        totalExtra: extraInAlgolia.length,
        indexCoverage: `${((algoliaPageIds.size / firestorePages.size) * 100).toFixed(1)}%`
      }
    };

    console.log(`[Algolia Audit] Audit complete:`, result.summary);

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[Algolia Audit] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/algolia-audit
 * Backfill missing pages to Algolia
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify admin access
    const adminAuth = await verifyAdminAccess(request);
    if (!adminAuth.isAdmin) {
      return createAdminUnauthorizedResponse(adminAuth.auditId);
    }

    const body = await request.json();
    const {
      pageIds,  // Optional: specific page IDs to backfill
      backfillAll = false,  // If true, backfill all missing pages
      limit = 100,  // Max pages to backfill in one request
      dryRun = true  // If true, just report what would be done
    } = body;

    console.log(`[Algolia Backfill] Starting backfill for admin: ${adminAuth.userId}, dryRun: ${dryRun}`);

    const db = getAdminFirestore();
    const client = getAdminClient();
    const envType = getEnvironmentType();
    const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);
    const collectionName = getCollectionName('pages');

    let pagesToBackfill: string[] = [];

    if (pageIds && Array.isArray(pageIds) && pageIds.length > 0) {
      // Backfill specific pages
      pagesToBackfill = pageIds.slice(0, limit);
    } else if (backfillAll) {
      // First, run audit to find missing pages
      const firestorePages = new Map<string, boolean>();
      let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

      while (firestorePages.size < 5000) { // Safety limit
        let query: FirebaseFirestore.Query = db.collection(collectionName).limit(500);
        if (lastDoc) query = query.startAfter(lastDoc);

        const snapshot = await query.get();
        if (snapshot.empty) break;

        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (!data.deleted && data.title) {
            firestorePages.set(doc.id, true);
          }
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < 500) break;
      }

      // Get Algolia IDs
      const algoliaPageIds = new Set<string>();
      let algoliaPage = 0;

      while (true) {
        try {
          const response = await client.searchSingleIndex<AlgoliaPageRecord>({
            indexName,
            searchParams: {
              query: '',
              hitsPerPage: 1000,
              page: algoliaPage,
              attributesToRetrieve: ['objectID'],
            },
          });

          if (!response.hits || response.hits.length === 0) break;
          for (const hit of response.hits) algoliaPageIds.add(hit.objectID);
          if (response.hits.length < 1000) break;
          algoliaPage++;
          if (algoliaPage > 50) break;
        } catch {
          break;
        }
      }

      // Find missing
      for (const pageId of firestorePages.keys()) {
        if (!algoliaPageIds.has(pageId)) {
          pagesToBackfill.push(pageId);
          if (pagesToBackfill.length >= limit) break;
        }
      }
    }

    if (pagesToBackfill.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pages to backfill',
        backfilled: 0,
        dryRun
      });
    }

    console.log(`[Algolia Backfill] Found ${pagesToBackfill.length} pages to backfill`);

    if (dryRun) {
      // Just return what would be backfilled
      const pageDetails = [];
      for (const pageId of pagesToBackfill.slice(0, 20)) {
        const doc = await db.collection(collectionName).doc(pageId).get();
        if (doc.exists) {
          const data = doc.data();
          pageDetails.push({
            id: pageId,
            title: data?.title,
            authorUsername: data?.authorUsername
          });
        }
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Would backfill ${pagesToBackfill.length} pages`,
        totalToBackfill: pagesToBackfill.length,
        samplePages: pageDetails,
        pageIds: pagesToBackfill
      });
    }

    // Actually perform the backfill
    const records: AlgoliaPageRecord[] = [];
    const errors: string[] = [];

    for (const pageId of pagesToBackfill) {
      try {
        const doc = await db.collection(collectionName).doc(pageId).get();

        if (!doc.exists) {
          errors.push(`Page ${pageId} not found`);
          continue;
        }

        const data = doc.data();
        if (!data || data.deleted || !data.title) {
          errors.push(`Page ${pageId} is deleted or has no title`);
          continue;
        }

        const record: AlgoliaPageRecord = {
          objectID: doc.id,
          title: data.title,
          content: extractTextFromContent(data.content)?.substring(0, 5000),
          authorId: data.userId || data.authorId || '',
          authorUsername: data.authorUsername || '',
          isPublic: data.isPublic ?? true,
          createdAt: toUnixTimestamp(data.createdAt),
          lastModified: toUnixTimestamp(data.lastModified),
          alternativeTitles: data.alternativeTitles || [],
        };

        records.push(record);
      } catch (err) {
        errors.push(`Error processing ${pageId}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // Save to Algolia in batches
    let backfilledCount = 0;
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        await client.saveObjects({
          indexName,
          objects: batch,
        });
        backfilledCount += batch.length;
        console.log(`[Algolia Backfill] Saved batch of ${batch.length} (total: ${backfilledCount})`);
      } catch (err) {
        errors.push(`Error saving batch: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      environment: envType,
      backfilled: backfilledCount,
      requested: pagesToBackfill.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[Algolia Backfill] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
