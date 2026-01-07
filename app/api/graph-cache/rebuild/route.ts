/**
 * Graph Cache Rebuild API
 *
 * Computes and stores page connection graph data in Firestore.
 * Called when a page is saved to update its cache and affected pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { extractPageReferences } from '../../../firebase/database/links';

// Set max duration to prevent Vercel function timeouts
export const maxDuration = 30;

interface PageConnection {
  id: string;
  title: string;
  username: string;
  lastModified?: any;
  linkText?: string;
}

interface PageGraphCacheData {
  pageId: string;
  pageTitle: string;
  username: string;
  incoming: PageConnection[];
  outgoing: PageConnection[];
  bidirectional: PageConnection[];
  secondHopConnections: PageConnection[];
  thirdHopConnections: PageConnection[];
  stats: {
    incomingCount: number;
    outgoingCount: number;
    bidirectionalCount: number;
    secondHopCount: number;
    thirdHopCount: number;
    totalConnections: number;
  };
  cachedAt: FirebaseFirestore.FieldValue;
  version: number;
}

const CACHE_VERSION = 1;

/**
 * Compute graph data for a single page
 */
async function computePageGraph(
  db: FirebaseFirestore.Firestore,
  pageId: string,
  includeMultiHop: boolean = true
): Promise<PageGraphCacheData | null> {
  console.log(`📊 [GRAPH_REBUILD] Computing graph for page ${pageId}`);

  // Get the page document
  const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
  if (!pageDoc.exists) {
    console.log(`📊 [GRAPH_REBUILD] Page ${pageId} not found`);
    return null;
  }

  const pageData = pageDoc.data()!;
  if (pageData.deleted) {
    console.log(`📊 [GRAPH_REBUILD] Page ${pageId} is deleted, skipping`);
    return null;
  }

  // Get incoming connections (backlinks)
  const incoming: PageConnection[] = [];
  const backlinksSnapshot = await db.collection(getCollectionName('backlinks'))
    .where('targetPageId', '==', pageId)
    .limit(50) // Reduced from 100 to prevent timeouts
    .get();

  // OPTIMIZED: Batch fetch source pages instead of sequential individual gets
  if (backlinksSnapshot.docs.length > 0) {
    const sourcePageRefs = backlinksSnapshot.docs.map(doc =>
      db.collection(getCollectionName('pages')).doc(doc.data().sourcePageId)
    );
    const sourcePageDocs = await db.getAll(...sourcePageRefs);

    backlinksSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const sourcePageDoc = sourcePageDocs[index];
      if (sourcePageDoc.exists && !sourcePageDoc.data()?.deleted) {
        incoming.push({
          id: data.sourcePageId,
          title: data.sourcePageTitle,
          username: data.sourceUsername,
          lastModified: data.lastModified,
          linkText: data.linkText
        });
      }
    });
  }

  // Get outgoing connections (forward links from content)
  const outgoing: PageConnection[] = [];
  if (pageData.content) {
    const linkedPageIds = extractPageReferences(pageData.content);
    const uniqueIds = [...new Set(linkedPageIds)].filter(id => id !== pageId).slice(0, 30); // Reduced from 50

    // OPTIMIZED: Batch fetch linked pages instead of sequential individual gets
    if (uniqueIds.length > 0) {
      const linkedPageRefs = uniqueIds.map(id =>
        db.collection(getCollectionName('pages')).doc(id)
      );
      const linkedPageDocs = await db.getAll(...linkedPageRefs);

      linkedPageDocs.forEach((linkedPageDoc, index) => {
        if (linkedPageDoc.exists && !linkedPageDoc.data()?.deleted) {
          const linkedData = linkedPageDoc.data()!;
          outgoing.push({
            id: uniqueIds[index],
            title: linkedData.title || 'Untitled',
            username: linkedData.username || 'Unknown',
            lastModified: linkedData.lastModified
          });
        }
      });
    }
  }

  // Calculate bidirectional connections
  const bidirectional = incoming.filter(inPage =>
    outgoing.some(outPage => outPage.id === inPage.id)
  );

  // Get multi-hop connections if requested
  let secondHopConnections: PageConnection[] = [];
  let thirdHopConnections: PageConnection[] = [];

  // OPTIMIZED: Simplified multi-hop with parallel queries and reduced limits
  if (includeMultiHop) {
    const firstLevelIds = new Set([pageId, ...incoming.map(p => p.id), ...outgoing.map(p => p.id)]);

    // Second hop: Get connections of first-level pages (reduced sample size)
    const firstLevelSample = [...incoming.slice(0, 3), ...outgoing.slice(0, 3)];
    const secondHopIds = new Set<string>();

    // OPTIMIZED: Parallel fetch all second hop backlinks
    const secondHopSnapshots = await Promise.all(
      firstLevelSample.map(page =>
        db.collection(getCollectionName('backlinks'))
          .where('targetPageId', '==', page.id)
          .limit(3)
          .get()
      )
    );

    // Collect all potential second hop source IDs
    const potentialSecondHopData: Array<{ sourcePageId: string; data: any }> = [];
    secondHopSnapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!firstLevelIds.has(data.sourcePageId) && !secondHopIds.has(data.sourcePageId)) {
          secondHopIds.add(data.sourcePageId);
          potentialSecondHopData.push({ sourcePageId: data.sourcePageId, data });
        }
      });
    });

    // Batch verify source pages exist
    if (potentialSecondHopData.length > 0) {
      const secondHopRefs = potentialSecondHopData.map(item =>
        db.collection(getCollectionName('pages')).doc(item.sourcePageId)
      );
      const secondHopPageDocs = await db.getAll(...secondHopRefs);

      potentialSecondHopData.forEach((item, index) => {
        const sourcePageDoc = secondHopPageDocs[index];
        if (sourcePageDoc.exists && !sourcePageDoc.data()?.deleted) {
          secondHopConnections.push({
            id: item.sourcePageId,
            title: item.data.sourcePageTitle,
            username: item.data.sourceUsername,
            lastModified: item.data.lastModified,
            linkText: item.data.linkText
          });
        }
      });
    }

    // Third hop: Skip for performance - 2 hops is usually sufficient
    // This significantly reduces timeout risk while keeping most graph value
  }

  const admin = getFirebaseAdmin()!;
  const stats = {
    incomingCount: incoming.length,
    outgoingCount: outgoing.length,
    bidirectionalCount: bidirectional.length,
    secondHopCount: secondHopConnections.length,
    thirdHopCount: thirdHopConnections.length,
    totalConnections: incoming.length + outgoing.length + secondHopConnections.length + thirdHopConnections.length
  };

  return {
    pageId,
    pageTitle: pageData.title || 'Untitled',
    username: pageData.username || 'Unknown',
    incoming,
    outgoing,
    bidirectional,
    secondHopConnections,
    thirdHopConnections,
    stats,
    cachedAt: admin.firestore.FieldValue.serverTimestamp(),
    version: CACHE_VERSION
  };
}

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const db = admin.firestore();
    const body = await request.json();
    const { pageId, pageIds, invalidateAffected = true } = body;

    // Handle single page or batch
    const targetPageIds = pageIds || (pageId ? [pageId] : []);

    if (targetPageIds.length === 0) {
      return NextResponse.json({ error: 'pageId or pageIds required' }, { status: 400 });
    }

    console.log(`📊 [GRAPH_REBUILD] Rebuilding cache for ${targetPageIds.length} pages`);

    const results: { pageId: string; success: boolean; stats?: any; error?: string }[] = [];
    const affectedPageIds = new Set<string>();

    for (const targetPageId of targetPageIds) {
      try {
        const graphData = await computePageGraph(db, targetPageId);

        if (graphData) {
          // Save to cache
          await db.collection(getCollectionName('pageGraphCache')).doc(targetPageId).set(graphData);

          results.push({ pageId: targetPageId, success: true, stats: graphData.stats });

          // Track affected pages (pages that link to this page need their cache updated too)
          if (invalidateAffected) {
            graphData.incoming.forEach(p => affectedPageIds.add(p.id));
            graphData.outgoing.forEach(p => affectedPageIds.add(p.id));
          }
        } else {
          // Page doesn't exist or is deleted, remove any existing cache
          await db.collection(getCollectionName('pageGraphCache')).doc(targetPageId).delete().catch(() => {});
          results.push({ pageId: targetPageId, success: true, stats: null });
        }
      } catch (error) {
        console.error(`📊 [GRAPH_REBUILD] Error processing page ${targetPageId}:`, error);
        results.push({
          pageId: targetPageId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Invalidate caches for affected pages (but don't rebuild them now)
    if (invalidateAffected && affectedPageIds.size > 0) {
      // Remove the original pages from affected set
      targetPageIds.forEach(id => affectedPageIds.delete(id));

      if (affectedPageIds.size > 0) {
        console.log(`📊 [GRAPH_REBUILD] Invalidating ${affectedPageIds.size} affected page caches`);

        const batch = db.batch();
        for (const affectedId of affectedPageIds) {
          batch.delete(db.collection(getCollectionName('pageGraphCache')).doc(affectedId));
        }
        await batch.commit().catch(err => {
          console.error('Error invalidating affected caches:', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      affectedPagesInvalidated: affectedPageIds.size,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Graph cache rebuild error:', error);
    return NextResponse.json({
      error: 'Failed to rebuild graph cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check cache status
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const db = admin.firestore();
    const pageId = request.nextUrl.searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({ error: 'pageId required' }, { status: 400 });
    }

    const cacheDoc = await db.collection(getCollectionName('pageGraphCache')).doc(pageId).get();

    if (!cacheDoc.exists) {
      return NextResponse.json({ cached: false, pageId });
    }

    const data = cacheDoc.data()!;
    return NextResponse.json({
      cached: true,
      pageId,
      stats: data.stats,
      cachedAt: data.cachedAt?.toDate?.() || data.cachedAt,
      version: data.version
    });

  } catch (error) {
    console.error('Graph cache check error:', error);
    return NextResponse.json({ error: 'Failed to check cache' }, { status: 500 });
  }
}
