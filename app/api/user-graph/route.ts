/**
 * User Graph API Endpoint
 *
 * Optimized endpoint for fetching all graph data for a user's pages in a single request.
 * This eliminates the N+1 query problem where UserGraphTab was making N separate API calls.
 *
 * Returns:
 * - All user's pages with their titles
 * - All internal connections (links between the user's own pages)
 * - Pre-computed node metadata (orphan status, connection counts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { extractPageReferences } from '../../firebase/database/links';

interface UserPage {
  id: string;
  title: string;
  username?: string;
}

interface GraphNode {
  id: string;
  title: string;
  username?: string;
  isOrphan: boolean;
  connectionCount: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'outgoing' | 'incoming' | 'bidirectional';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const db = admin.firestore();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!userId) {
      return NextResponse.json({
        error: 'userId parameter is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    console.log(`📊 [USER_GRAPH_API] Fetching graph for user ${userId}, limit ${limit}`);

    // Step 1: Get all user's pages in one query
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('userId', '==', userId)
      .where('deleted', '==', false)
      .orderBy('lastModified', 'desc')
      .limit(limit)
      .get();

    const userPages: UserPage[] = pagesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Untitled',
        username: data.username
      };
    });

    console.log(`📊 [USER_GRAPH_API] Found ${userPages.length} pages`);

    if (userPages.length === 0) {
      return NextResponse.json({
        nodes: [],
        links: [],
        stats: {
          pageCount: 0,
          linkCount: 0,
          orphanCount: 0,
          computeTimeMs: Date.now() - startTime
        },
        timestamp: new Date().toISOString()
      });
    }

    const pageIds = new Set(userPages.map(p => p.id));

    // Step 2: Get all backlinks between user's pages in parallel
    // We need to find links where both source AND target are in the user's pages
    const backlinksPromises = userPages.map(page =>
      db.collection(getCollectionName('backlinks'))
        .where('targetPageId', '==', page.id)
        .limit(50)
        .get()
    );

    const backlinksSnapshots = await Promise.all(backlinksPromises);

    // Step 3: Also get outgoing links from page content (in case backlinks aren't indexed yet)
    // Fetch page content in parallel for link extraction
    const pageContentPromises = userPages.map(page =>
      db.collection(getCollectionName('pages')).doc(page.id).get()
    );
    const pageContentDocs = await Promise.all(pageContentPromises);

    // Build links map - track all connections
    const linksMap = new Map<string, GraphLink>();
    const processedPairs = new Set<string>();

    // Process backlinks (incoming links)
    for (let i = 0; i < backlinksSnapshots.length; i++) {
      const targetPageId = userPages[i].id;
      const snapshot = backlinksSnapshots[i];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const sourcePageId = data.sourcePageId;

        // Only include links between user's own pages
        if (pageIds.has(sourcePageId)) {
          const pairKey = [sourcePageId, targetPageId].sort().join('-');

          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            linksMap.set(pairKey, {
              source: sourcePageId,
              target: targetPageId,
              type: 'incoming'
            });
          }
        }
      }
    }

    // Process outgoing links from content
    for (let i = 0; i < pageContentDocs.length; i++) {
      const pageDoc = pageContentDocs[i];
      const sourcePageId = userPages[i].id;

      if (pageDoc.exists) {
        const pageData = pageDoc.data();

        if (pageData?.content) {
          const linkedPageIds = extractPageReferences(pageData.content);

          for (const targetPageId of linkedPageIds) {
            // Only include links between user's own pages
            if (pageIds.has(targetPageId) && targetPageId !== sourcePageId) {
              const pairKey = [sourcePageId, targetPageId].sort().join('-');

              if (processedPairs.has(pairKey)) {
                // This is bidirectional - update existing link
                const existing = linksMap.get(pairKey);
                if (existing) {
                  // Check if the outgoing direction matches or opposes existing
                  if (existing.source === targetPageId && existing.target === sourcePageId) {
                    // Opposite direction - mark as bidirectional
                    existing.type = 'bidirectional';
                  }
                }
              } else {
                processedPairs.add(pairKey);
                linksMap.set(pairKey, {
                  source: sourcePageId,
                  target: targetPageId,
                  type: 'outgoing'
                });
              }
            }
          }
        }
      }
    }

    const links = Array.from(linksMap.values());

    // Step 4: Compute connection counts per page
    const connectionCounts = new Map<string, number>();
    links.forEach(link => {
      connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1);
      connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1);
    });

    // Step 5: Build nodes with metadata
    const nodes: GraphNode[] = userPages.map(page => {
      const connectionCount = connectionCounts.get(page.id) || 0;
      return {
        id: page.id,
        title: page.title,
        username: page.username,
        isOrphan: connectionCount === 0,
        connectionCount
      };
    });

    const orphanCount = nodes.filter(n => n.isOrphan).length;
    const computeTimeMs = Date.now() - startTime;

    console.log(`📊 [USER_GRAPH_API] Completed in ${computeTimeMs}ms:`, {
      pageCount: nodes.length,
      linkCount: links.length,
      orphanCount
    });

    return NextResponse.json({
      nodes,
      links,
      stats: {
        pageCount: nodes.length,
        linkCount: links.length,
        orphanCount,
        computeTimeMs
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('User graph API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch user graph',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
