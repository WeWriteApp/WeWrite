/**
 * User Graph API Endpoint
 *
 * Optimized endpoint for fetching all graph data for a user's pages in a single request.
 *
 * Performance optimizations:
 * - Single query for all user pages WITH content (eliminates N+1 for content)
 * - Batched backlinks queries using Firestore 'in' operator (max 30 per batch)
 * - Server-side caching with 5-minute TTL
 * - Truncated titles to reduce payload size
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

// Simple in-memory cache for graph data (server-side)
const graphCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedGraph(userId: string): any | null {
  const cached = graphCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  graphCache.delete(userId);
  return null;
}

function setCachedGraph(userId: string, data: any): void {
  // Limit cache size to prevent memory issues
  if (graphCache.size > 100) {
    // Remove oldest entries
    const entries = Array.from(graphCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 20; i++) {
      graphCache.delete(entries[i][0]);
    }
  }
  graphCache.set(userId, { data, timestamp: Date.now() });
}

interface UserPage {
  id: string;
  title: string;
  username?: string;
  content?: any; // Page content for link extraction
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
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skipCache = searchParams.get('skipCache') === 'true';

    if (!userId) {
      return NextResponse.json({
        error: 'userId parameter is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Check cache first (unless skipCache is set)
    if (!skipCache) {
      const cached = getCachedGraph(userId);
      if (cached) {
        return NextResponse.json({
          ...cached,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const db = admin.firestore();


    // Step 1: Get all user's pages in one query - includes content for link extraction
    // This eliminates the N+1 query for fetching page content separately
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
        username: data.username,
        content: data.content // Include content for link extraction
      };
    });


    if (userPages.length === 0) {
      const emptyResult = {
        nodes: [],
        links: [],
        stats: {
          pageCount: 0,
          linkCount: 0,
          orphanCount: 0,
          computeTimeMs: Date.now() - startTime
        }
      };
      setCachedGraph(userId, emptyResult);
      return NextResponse.json({
        ...emptyResult,
        timestamp: new Date().toISOString()
      });
    }

    const pageIds = new Set(userPages.map(p => p.id));
    const pageIdArray = Array.from(pageIds);

    // Step 2: Get all backlinks using batched 'in' queries (max 30 per batch)
    // This reduces N queries down to ceil(N/30) queries
    const BATCH_SIZE = 30;
    const backlinksResults: Array<{ targetPageId: string; sourcePageId: string }> = [];

    for (let i = 0; i < pageIdArray.length; i += BATCH_SIZE) {
      const batch = pageIdArray.slice(i, i + BATCH_SIZE);
      const batchSnapshot = await db.collection(getCollectionName('backlinks'))
        .where('targetPageId', 'in', batch)
        .limit(batch.length * 50) // Up to 50 backlinks per page
        .get();

      batchSnapshot.docs.forEach(doc => {
        const data = doc.data();
        backlinksResults.push({
          targetPageId: data.targetPageId,
          sourcePageId: data.sourcePageId
        });
      });
    }


    // Build links map - track all connections
    const linksMap = new Map<string, GraphLink>();
    const processedPairs = new Set<string>();

    // Process backlinks (incoming links) from batched results
    for (const backlink of backlinksResults) {
      const { targetPageId, sourcePageId } = backlink;

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

    // Process outgoing links from page content (already loaded in step 1)
    // No additional Firestore queries needed!
    for (const page of userPages) {
      if (page.content) {
        const linkedPageIds = extractPageReferences(page.content);

        for (const targetPageId of linkedPageIds) {
          // Only include links between user's own pages
          if (pageIds.has(targetPageId) && targetPageId !== page.id) {
            const pairKey = [page.id, targetPageId].sort().join('-');

            if (processedPairs.has(pairKey)) {
              // This is bidirectional - update existing link
              const existing = linksMap.get(pairKey);
              if (existing) {
                // Check if the outgoing direction matches or opposes existing
                if (existing.source === targetPageId && existing.target === page.id) {
                  // Opposite direction - mark as bidirectional
                  existing.type = 'bidirectional';
                }
              }
            } else {
              processedPairs.add(pairKey);
              linksMap.set(pairKey, {
                source: page.id,
                target: targetPageId,
                type: 'outgoing'
              });
            }
          }
        }
      }
    }

    const links = Array.from(linksMap.values());

    // Step 3: Compute connection counts per page
    const connectionCounts = new Map<string, number>();
    links.forEach(link => {
      connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1);
      connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1);
    });

    // Step 4: Build nodes with metadata (truncate titles to reduce payload)
    const MAX_TITLE_LENGTH = 50;
    const nodes: GraphNode[] = userPages.map(page => {
      const connectionCount = connectionCounts.get(page.id) || 0;
      const truncatedTitle = page.title.length > MAX_TITLE_LENGTH
        ? page.title.substring(0, MAX_TITLE_LENGTH) + '...'
        : page.title;
      return {
        id: page.id,
        title: truncatedTitle,
        username: page.username,
        isOrphan: connectionCount === 0,
        connectionCount
      };
    });

    const orphanCount = nodes.filter(n => n.isOrphan).length;
    const computeTimeMs = Date.now() - startTime;
    const queryCount = 1 + Math.ceil(pageIdArray.length / BATCH_SIZE); // 1 pages query + N/30 backlinks queries


    // Build result and cache it
    const result = {
      nodes,
      links,
      stats: {
        pageCount: nodes.length,
        linkCount: links.length,
        orphanCount,
        computeTimeMs,
        queryCount
      }
    };

    setCachedGraph(userId, result);

    return NextResponse.json({
      ...result,
      cached: false,
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
