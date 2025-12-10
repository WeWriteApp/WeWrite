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
    .limit(100)
    .get();

  for (const doc of backlinksSnapshot.docs) {
    const data = doc.data();
    // Verify source page exists and isn't deleted
    const sourcePageDoc = await db.collection(getCollectionName('pages')).doc(data.sourcePageId).get();
    if (sourcePageDoc.exists && !sourcePageDoc.data()?.deleted) {
      incoming.push({
        id: data.sourcePageId,
        title: data.sourcePageTitle,
        username: data.sourceUsername,
        lastModified: data.lastModified,
        linkText: data.linkText
      });
    }
  }

  // Get outgoing connections (forward links from content)
  const outgoing: PageConnection[] = [];
  if (pageData.content) {
    const linkedPageIds = extractPageReferences(pageData.content);
    const uniqueIds = [...new Set(linkedPageIds)].filter(id => id !== pageId);

    for (const linkedPageId of uniqueIds.slice(0, 50)) {
      const linkedPageDoc = await db.collection(getCollectionName('pages')).doc(linkedPageId).get();
      if (linkedPageDoc.exists && !linkedPageDoc.data()?.deleted) {
        const linkedData = linkedPageDoc.data()!;
        outgoing.push({
          id: linkedPageId,
          title: linkedData.title || 'Untitled',
          username: linkedData.username || 'Unknown',
          lastModified: linkedData.lastModified
        });
      }
    }
  }

  // Calculate bidirectional connections
  const bidirectional = incoming.filter(inPage =>
    outgoing.some(outPage => outPage.id === inPage.id)
  );

  // Get multi-hop connections if requested
  let secondHopConnections: PageConnection[] = [];
  let thirdHopConnections: PageConnection[] = [];

  if (includeMultiHop) {
    const firstLevelIds = new Set([pageId, ...incoming.map(p => p.id), ...outgoing.map(p => p.id)]);

    // Second hop: Get connections of first-level pages
    const firstLevelSample = [...incoming.slice(0, 5), ...outgoing.slice(0, 5)];
    const secondHopIds = new Set<string>();

    for (const firstLevelPage of firstLevelSample) {
      const secondHopSnapshot = await db.collection(getCollectionName('backlinks'))
        .where('targetPageId', '==', firstLevelPage.id)
        .limit(3)
        .get();

      for (const doc of secondHopSnapshot.docs) {
        const data = doc.data();
        if (!firstLevelIds.has(data.sourcePageId) && !secondHopIds.has(data.sourcePageId)) {
          const sourcePageDoc = await db.collection(getCollectionName('pages')).doc(data.sourcePageId).get();
          if (sourcePageDoc.exists && !sourcePageDoc.data()?.deleted) {
            secondHopIds.add(data.sourcePageId);
            secondHopConnections.push({
              id: data.sourcePageId,
              title: data.sourcePageTitle,
              username: data.sourceUsername,
              lastModified: data.lastModified,
              linkText: data.linkText
            });
          }
        }
      }
    }

    // Third hop: Get connections of second-level pages
    if (secondHopConnections.length > 0) {
      const secondLevelSample = secondHopConnections.slice(0, 3);
      const thirdHopIds = new Set<string>();

      for (const secondLevelPage of secondLevelSample) {
        const thirdHopSnapshot = await db.collection(getCollectionName('backlinks'))
          .where('targetPageId', '==', secondLevelPage.id)
          .limit(2)
          .get();

        for (const doc of thirdHopSnapshot.docs) {
          const data = doc.data();
          if (!firstLevelIds.has(data.sourcePageId) &&
              !secondHopIds.has(data.sourcePageId) &&
              !thirdHopIds.has(data.sourcePageId)) {
            const sourcePageDoc = await db.collection(getCollectionName('pages')).doc(data.sourcePageId).get();
            if (sourcePageDoc.exists && !sourcePageDoc.data()?.deleted) {
              thirdHopIds.add(data.sourcePageId);
              thirdHopConnections.push({
                id: data.sourcePageId,
                title: data.sourcePageTitle,
                username: data.sourceUsername,
                lastModified: data.lastModified,
                linkText: data.linkText
              });
            }
          }
        }
      }
    }
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
