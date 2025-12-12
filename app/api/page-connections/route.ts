/**
 * Page Connections API Endpoint
 * 
 * Provides comprehensive page connection data for graph visualization:
 * - Incoming links (backlinks)
 * - Outgoing links (forward links)
 * - Bidirectional links
 * - Second-hop connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { extractPageReferences } from '../../firebase/database/links';

interface PageConnection {
  id: string;
  title: string;
  username: string;
  lastModified: any;
  linkText?: string;
}

// Extract page IDs from content
function extractPageIdsFromContent(content: string): string[] {
  if (!content) return [];
  
  const pageIds = [];
  
  // Look for page ID patterns (assuming they're alphanumeric strings of certain length)
  const pageIdRegex = /[a-zA-Z0-9]{20,}/g;
  const matches = content.match(pageIdRegex) || [];
  
  for (const match of matches) {
    if (match.length >= 20 && match.length <= 30) { // Typical Firestore ID length
      pageIds.push(match);
    }
  }
  
  return [...new Set(pageIds)]; // Remove duplicates
}

// Extract page IDs from nodes structure using the same method as backlinks
function extractPageIdsFromNodes(nodes: any[]): string[] {
  if (!Array.isArray(nodes)) return [];

  console.log('🔍 [PAGE_CONNECTIONS_API] Extracting page IDs from nodes:', nodes.length);

  // Use the same extraction method as the backlinks system
  const links = extractPageReferences(nodes);

  console.log('🔍 [PAGE_CONNECTIONS_API] Extracted page IDs:', links);

  return links;
}

export async function GET(request: NextRequest) {
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
    const pageId = searchParams.get('pageId');
    const includeSecondHop = searchParams.get('includeSecondHop') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const skipCache = searchParams.get('skipCache') === 'true';

    if (!pageId) {
      return NextResponse.json({
        error: 'pageId parameter is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    console.log(`🔗 [PAGE_CONNECTIONS_API] Getting connections for page ${pageId}`, {
      includeSecondHop,
      limit,
      skipCache,
      timestamp: new Date().toISOString()
    });

    // Try to get from cache first (unless skipCache is true)
    if (!skipCache) {
      try {
        const cacheDoc = await db.collection(getCollectionName('pageGraphCache')).doc(pageId).get();

        if (cacheDoc.exists) {
          const cacheData = cacheDoc.data()!;

          // Check cache version
          if (cacheData.version === 1) {
            console.log(`🔗 [PAGE_CONNECTIONS_API] Cache hit for page ${pageId}`, cacheData.stats);

            // Return cached data
            return NextResponse.json({
              incoming: cacheData.incoming?.slice(0, limit) || [],
              outgoing: cacheData.outgoing?.slice(0, limit) || [],
              bidirectional: cacheData.bidirectional || [],
              secondHopConnections: includeSecondHop ? (cacheData.secondHopConnections || []) : [],
              thirdHopConnections: includeSecondHop ? (cacheData.thirdHopConnections || []) : [],
              stats: cacheData.stats,
              cached: true,
              cachedAt: cacheData.cachedAt?.toDate?.()?.toISOString() || null,
              timestamp: new Date().toISOString()
            }, { status: 200 });
          }
        }

        console.log(`🔗 [PAGE_CONNECTIONS_API] Cache miss for page ${pageId}, computing...`);
      } catch (cacheError) {
        console.warn(`🔗 [PAGE_CONNECTIONS_API] Cache read error, falling back to computation:`, cacheError);
      }
    }

    // Get incoming connections (backlinks) - optimized with parallel validation
    let incoming: PageConnection[] = [];

    try {
      // Get all backlinks (no isPublic filter since private pages no longer exist)
      const backlinksSnapshot = await db.collection(getCollectionName('backlinks'))
        .where('targetPageId', '==', pageId)
        .limit(limit * 2) // Get more to account for filtering
        .get();

      // OPTIMIZATION: Batch fetch all source pages in parallel instead of sequential
      const sourcePageIds = backlinksSnapshot.docs.map(doc => doc.data().sourcePageId);
      const uniqueSourceIds = [...new Set(sourcePageIds)];

      // Fetch all source pages in parallel (Firestore supports up to 500 in a batch)
      const sourcePagePromises = uniqueSourceIds.map(id =>
        db.collection(getCollectionName('pages')).doc(id).get()
      );
      const sourcePageDocs = await Promise.all(sourcePagePromises);

      // Create a map for quick lookup
      const sourcePageMap = new Map<string, any>();
      sourcePageDocs.forEach(doc => {
        if (doc.exists) {
          sourcePageMap.set(doc.id, doc.data());
        }
      });

      // Filter out backlinks from deleted pages using the cached map
      const validIncoming = [];
      for (const doc of backlinksSnapshot.docs) {
        const data = doc.data();
        const sourcePageData = sourcePageMap.get(data.sourcePageId);

        if (sourcePageData && !sourcePageData.deleted) {
          validIncoming.push({
            id: data.sourcePageId,
            title: data.sourcePageTitle,
            username: data.sourceUsername,
            lastModified: data.lastModified,
            linkText: data.linkText
          });
        }

        // Stop if we have enough valid results
        if (validIncoming.length >= limit) break;
      }

      incoming = validIncoming;

      console.log(`🔗 [PAGE_CONNECTIONS_API] Found ${incoming.length} incoming connections using index (filtered from ${backlinksSnapshot.size} total, ${uniqueSourceIds.length} unique sources)`);
    } catch (error) {
      console.log('🔗 [PAGE_CONNECTIONS_API] Backlinks index not available, using fallback');
      // Fallback method would go here if needed
    }

    // Get outgoing connections (forward links)
    let outgoing: PageConnection[] = [];
    console.log(`🔗 [PAGE_CONNECTIONS_API] Getting outgoing connections for page: ${pageId}`);
    
    try {
      const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
      
      if (pageDoc.exists) {
        const pageData = pageDoc.data();
        console.log(`🔗 [PAGE_CONNECTIONS_API] Page data:`, {
          hasContent: !!pageData.content,
          contentType: typeof pageData.content,
          contentLength: pageData.content ? JSON.stringify(pageData.content).length : 0,
          hasNodes: !!pageData.nodes
        });

        let linkedPageIds: string[] = [];

        // Extract page references from content using the proper link extraction function
        if (pageData.content) {
          // Debug: Log the actual content structure for the specific page we're testing
          if (pageId === 'BvkkVeByRFiRVPbo8lCz') {
            console.log(`🔗 [DEBUG] Raw content for page ${pageId}:`, JSON.stringify(pageData.content, null, 2));
          }

          const extractedIds = extractPageReferences(pageData.content);
          console.log(`🔗 [PAGE_CONNECTIONS_API] extractPageReferences found ${extractedIds.length} IDs:`, extractedIds);
          linkedPageIds.push(...extractedIds);
        }

        // Extract from nodes (legacy support)
        if (pageData.nodes) {
          const nodeIds = extractPageIdsFromNodes(pageData.nodes);
          console.log(`🔗 [PAGE_CONNECTIONS_API] extractPageIdsFromNodes found ${nodeIds.length} IDs:`, nodeIds);
          linkedPageIds.push(...nodeIds);
        }

        // Remove duplicates and the current page
        linkedPageIds = [...new Set(linkedPageIds)].filter(id => id !== pageId);
        console.log(`🔗 [PAGE_CONNECTIONS_API] After filtering: ${linkedPageIds.length} unique outgoing links:`, linkedPageIds);
        
        if (linkedPageIds.length > 0) {
          // OPTIMIZATION: Fetch all linked pages in parallel instead of sequential batches
          const pagesToFetch = linkedPageIds.slice(0, limit);
          const linkedPagePromises = pagesToFetch.map(id =>
            db.collection(getCollectionName('pages')).doc(id).get()
          );
          const linkedPageDocs = await Promise.all(linkedPagePromises);

          for (let i = 0; i < linkedPageDocs.length; i++) {
            const linkedPageDoc = linkedPageDocs[i];
            const linkedPageId = pagesToFetch[i];

            if (linkedPageDoc.exists) {
              const linkedPageData = linkedPageDoc.data();
              // Only exclude deleted pages (no isPublic check since private pages no longer exist)
              if (!linkedPageData?.deleted) {
                outgoing.push({
                  id: linkedPageId,
                  title: linkedPageData?.title || 'Untitled',
                  username: linkedPageData?.username || 'Unknown',
                  lastModified: linkedPageData?.lastModified
                });
              }
            }
          }
        }
      }
      
      console.log(`🔗 [PAGE_CONNECTIONS_API] Found ${outgoing.length} outgoing connections`);
    } catch (error) {
      console.error('Error getting outgoing connections:', error);
    }

    // Calculate bidirectional connections
    const bidirectional = incoming.filter(incomingPage => 
      outgoing.some(outgoingPage => outgoingPage.id === incomingPage.id)
    );

    // Get second-hop and third-hop connections if requested
    let secondHopConnections: PageConnection[] = [];
    let thirdHopConnections: PageConnection[] = [];

    if (includeSecondHop) {
      console.log('🔗 [PAGE_CONNECTIONS_API] Fetching second-hop connections (optimized)');

      // Get second-hop from incoming connections (backlinks to backlinks)
      const incomingSample = incoming.slice(0, 5);

      // Get second-hop from outgoing connections (backlinks to forelinks)
      const outgoingSample = outgoing.slice(0, 5);

      // Combine both samples for comprehensive second-hop discovery
      const firstLevelSample = [...incomingSample, ...outgoingSample];

      // OPTIMIZATION: Fetch all second-hop backlinks in parallel
      const secondHopPromises = firstLevelSample.map(page =>
        db.collection(getCollectionName('backlinks'))
          .where('targetPageId', '==', page.id)
          .limit(3)
          .get()
      );
      const secondHopSnapshots = await Promise.all(secondHopPromises);

      // Collect all candidate second-hop pages
      const secondHopCandidates: Array<{id: string; title: string; username: string; lastModified: any; linkText?: string}> = [];
      const existingIds = new Set([pageId, ...incoming.map(p => p.id), ...outgoing.map(p => p.id)]);

      for (const snapshot of secondHopSnapshots) {
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (!existingIds.has(data.sourcePageId) && !secondHopCandidates.some(p => p.id === data.sourcePageId)) {
            secondHopCandidates.push({
              id: data.sourcePageId,
              title: data.sourcePageTitle,
              username: data.sourceUsername,
              lastModified: data.lastModified,
              linkText: data.linkText
            });
          }
        }
      }

      // OPTIMIZATION: Batch validate all second-hop pages in parallel
      if (secondHopCandidates.length > 0) {
        const uniqueSecondHopIds = [...new Set(secondHopCandidates.map(c => c.id))];
        const secondHopPagePromises = uniqueSecondHopIds.map(id =>
          db.collection(getCollectionName('pages')).doc(id).get()
        );
        const secondHopPageDocs = await Promise.all(secondHopPagePromises);

        const validSecondHopIds = new Set<string>();
        secondHopPageDocs.forEach(doc => {
          if (doc.exists && !doc.data()?.deleted) {
            validSecondHopIds.add(doc.id);
          }
        });

        // Filter to only valid pages
        secondHopConnections = secondHopCandidates.filter(c => validSecondHopIds.has(c.id));
      }

      console.log(`🔗 [PAGE_CONNECTIONS_API] Found ${secondHopConnections.length} second-hop connections`);

      // Get third-hop connections from second-hop pages
      if (secondHopConnections.length > 0) {
        console.log('🔗 [PAGE_CONNECTIONS_API] Fetching third-hop connections (optimized)');

        // Sample second-level connections to avoid too many requests
        const secondLevelSample = secondHopConnections.slice(0, 3);

        // OPTIMIZATION: Fetch all third-hop backlinks in parallel
        const thirdHopPromises = secondLevelSample.map(page =>
          db.collection(getCollectionName('backlinks'))
            .where('targetPageId', '==', page.id)
            .limit(2)
            .get()
        );
        const thirdHopSnapshots = await Promise.all(thirdHopPromises);

        // Collect all candidate third-hop pages
        const thirdHopCandidates: Array<{id: string; title: string; username: string; lastModified: any; linkText?: string}> = [];
        const secondHopIds = new Set(secondHopConnections.map(p => p.id));

        for (const snapshot of thirdHopSnapshots) {
          for (const doc of snapshot.docs) {
            const data = doc.data();
            if (!existingIds.has(data.sourcePageId) &&
                !secondHopIds.has(data.sourcePageId) &&
                !thirdHopCandidates.some(p => p.id === data.sourcePageId)) {
              thirdHopCandidates.push({
                id: data.sourcePageId,
                title: data.sourcePageTitle,
                username: data.sourceUsername,
                lastModified: data.lastModified,
                linkText: data.linkText
              });
            }
          }
        }

        // OPTIMIZATION: Batch validate all third-hop pages in parallel
        if (thirdHopCandidates.length > 0) {
          const uniqueThirdHopIds = [...new Set(thirdHopCandidates.map(c => c.id))];
          const thirdHopPagePromises = uniqueThirdHopIds.map(id =>
            db.collection(getCollectionName('pages')).doc(id).get()
          );
          const thirdHopPageDocs = await Promise.all(thirdHopPagePromises);

          const validThirdHopIds = new Set<string>();
          thirdHopPageDocs.forEach(doc => {
            if (doc.exists && !doc.data()?.deleted) {
              validThirdHopIds.add(doc.id);
            }
          });

          // Filter to only valid pages
          thirdHopConnections = thirdHopCandidates.filter(c => validThirdHopIds.has(c.id));
        }

        console.log(`🔗 [PAGE_CONNECTIONS_API] Found ${thirdHopConnections.length} third-hop connections`);
      }
    }

    const result = {
      incoming,
      outgoing,
      bidirectional,
      secondHopConnections,
      thirdHopConnections,
      stats: {
        incomingCount: incoming.length,
        outgoingCount: outgoing.length,
        bidirectionalCount: bidirectional.length,
        secondHopCount: secondHopConnections.length,
        thirdHopCount: thirdHopConnections.length
      },
      timestamp: new Date().toISOString()
    };

    console.log(`🔗 [PAGE_CONNECTIONS_API] Returning connections:`, result.stats);

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Page connections API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch page connections',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
