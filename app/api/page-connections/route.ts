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

    if (!pageId) {
      return NextResponse.json({
        error: 'pageId parameter is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    console.log(`🔗 [PAGE_CONNECTIONS_API] Getting connections for page ${pageId}`, {
      includeSecondHop,
      limit,
      timestamp: new Date().toISOString()
    });

    // Get incoming connections (backlinks) - try index first, then fallback
    let incoming: PageConnection[] = [];
    
    try {
      // Get all backlinks (no isPublic filter since private pages no longer exist)
      const backlinksSnapshot = await db.collection(getCollectionName('backlinks'))
        .where('targetPageId', '==', pageId)
        .limit(limit)
        .get();
      
      incoming = backlinksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.sourcePageId,
          title: data.sourcePageTitle,
          username: data.sourceUsername,
          lastModified: data.lastModified,
          linkText: data.linkText
        };
      });
      
      console.log(`🔗 [PAGE_CONNECTIONS_API] Found ${incoming.length} incoming connections using index`);
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
          // Get details for linked pages (batch them to avoid too many queries)
          const batchSize = 10;
          for (let i = 0; i < linkedPageIds.length && i < limit; i += batchSize) {
            const batch = linkedPageIds.slice(i, i + batchSize);
            
            for (const linkedPageId of batch) {
              try {
                const linkedPageDoc = await db.collection(getCollectionName('pages')).doc(linkedPageId).get();
                
                if (linkedPageDoc.exists) {
                  const linkedPageData = linkedPageDoc.data();
                  // Only exclude deleted pages (no isPublic check since private pages no longer exist)
                  if (!linkedPageData.deleted) {
                    outgoing.push({
                      id: linkedPageId,
                      title: linkedPageData.title || 'Untitled',
                      username: linkedPageData.username || 'Unknown',
                      lastModified: linkedPageData.lastModified
                    });
                  }
                }
              } catch (error) {
                console.warn(`Failed to fetch linked page ${linkedPageId}:`, error);
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
      console.log('🔗 [PAGE_CONNECTIONS_API] Fetching second-hop connections');

      // Get second-hop from incoming connections (backlinks to backlinks)
      const incomingSample = incoming.slice(0, 5);

      // Get second-hop from outgoing connections (backlinks to forelinks)
      const outgoingSample = outgoing.slice(0, 5);

      // Combine both samples for comprehensive second-hop discovery
      const firstLevelSample = [...incomingSample, ...outgoingSample];

      for (const firstLevelPage of firstLevelSample) {
        try {
          // Get backlinks to this first-level page (second-hop connections)
          const secondHopSnapshot = await db.collection(getCollectionName('backlinks'))
            .where('targetPageId', '==', firstLevelPage.id)
            .limit(3) // Limit per first-level page
            .get();

          secondHopSnapshot.docs.forEach(doc => {
            const data = doc.data();
            // Exclude if it's the original page or already in first-level connections
            if (data.sourcePageId !== pageId &&
                !incoming.some(p => p.id === data.sourcePageId) &&
                !outgoing.some(p => p.id === data.sourcePageId) &&
                !secondHopConnections.some(p => p.id === data.sourcePageId)) {
              secondHopConnections.push({
                id: data.sourcePageId,
                title: data.sourcePageTitle,
                username: data.sourceUsername,
                lastModified: data.lastModified,
                linkText: data.linkText
              });
            }
          });
        } catch (error) {
          console.warn(`Failed to fetch second-hop for ${firstLevelPage.id}:`, error);
        }
      }

      console.log(`🔗 [PAGE_CONNECTIONS_API] Found ${secondHopConnections.length} second-hop connections`);

      // Get third-hop connections from second-hop pages
      if (secondHopConnections.length > 0) {
        console.log('🔗 [PAGE_CONNECTIONS_API] Fetching third-hop connections');

        // Sample second-level connections to avoid too many requests
        const secondLevelSample = secondHopConnections.slice(0, 3);

        for (const secondLevelPage of secondLevelSample) {
          try {
            const thirdHopSnapshot = await db.collection(getCollectionName('backlinks'))
              .where('targetPageId', '==', secondLevelPage.id)
              .limit(2) // Limit per second-level page
              .get();

            thirdHopSnapshot.docs.forEach(doc => {
              const data = doc.data();
              // Exclude if already in previous levels
              if (data.sourcePageId !== pageId &&
                  !incoming.some(p => p.id === data.sourcePageId) &&
                  !outgoing.some(p => p.id === data.sourcePageId) &&
                  !secondHopConnections.some(p => p.id === data.sourcePageId) &&
                  !thirdHopConnections.some(p => p.id === data.sourcePageId)) {
                thirdHopConnections.push({
                  id: data.sourcePageId,
                  title: data.sourcePageTitle,
                  username: data.sourceUsername,
                  lastModified: data.lastModified,
                  linkText: data.linkText
                });
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch third-hop for ${secondLevelPage.id}:`, error);
          }
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
