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

interface PageConnection {
  id: string;
  title: string;
  username: string;
  lastModified: any;
  isPublic: boolean;
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

// Extract page IDs from nodes structure
function extractPageIdsFromNodes(nodes: any[]): string[] {
  if (!Array.isArray(nodes)) return [];
  
  const pageIds = [];
  
  for (const node of nodes) {
    if (node.type === 'link' && node.url) {
      // Extract page ID from URL
      const urlParts = node.url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart.length >= 20 && lastPart.length <= 30) {
        pageIds.push(lastPart);
      }
    }
  }
  
  return [...new Set(pageIds)]; // Remove duplicates
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

    console.log(`🔗 [PAGE_CONNECTIONS_API] Getting connections for page ${pageId}`);

    // Get incoming connections (backlinks) - try index first, then fallback
    let incoming: PageConnection[] = [];
    
    try {
      const backlinksSnapshot = await db.collection(getCollectionName('backlinks'))
        .where('targetPageId', '==', pageId)
        .where('isPublic', '==', true)
        .limit(limit)
        .get();
      
      incoming = backlinksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.sourcePageId,
          title: data.sourcePageTitle,
          username: data.sourceUsername,
          lastModified: data.lastModified,
          isPublic: data.isPublic,
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
    
    try {
      const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
      
      if (pageDoc.exists) {
        const pageData = pageDoc.data();
        let linkedPageIds: string[] = [];
        
        // Extract from content
        if (pageData.content) {
          linkedPageIds.push(...extractPageIdsFromContent(pageData.content));
        }
        
        // Extract from nodes
        if (pageData.nodes) {
          linkedPageIds.push(...extractPageIdsFromNodes(pageData.nodes));
        }
        
        // Remove duplicates and the current page
        linkedPageIds = [...new Set(linkedPageIds)].filter(id => id !== pageId);
        
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
                  if (linkedPageData.isPublic && !linkedPageData.deleted) {
                    outgoing.push({
                      id: linkedPageId,
                      title: linkedPageData.title || 'Untitled',
                      username: linkedPageData.username || 'Unknown',
                      lastModified: linkedPageData.lastModified,
                      isPublic: linkedPageData.isPublic
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

    // Get second-hop connections if requested
    let secondHopConnections: PageConnection[] = [];
    
    if (includeSecondHop && incoming.length > 0) {
      console.log('🔗 [PAGE_CONNECTIONS_API] Fetching second-hop connections');
      
      // Sample first-level connections to avoid too many requests
      const firstLevelSample = incoming.slice(0, 5);
      
      for (const firstLevelPage of firstLevelSample) {
        try {
          const secondHopSnapshot = await db.collection(getCollectionName('backlinks'))
            .where('targetPageId', '==', firstLevelPage.id)
            .where('isPublic', '==', true)
            .limit(3) // Limit per first-level page
            .get();
          
          secondHopSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.sourcePageId !== pageId && !incoming.some(p => p.id === data.sourcePageId)) {
              secondHopConnections.push({
                id: data.sourcePageId,
                title: data.sourcePageTitle,
                username: data.sourceUsername,
                lastModified: data.lastModified,
                isPublic: data.isPublic,
                linkText: data.linkText
              });
            }
          });
        } catch (error) {
          console.warn(`Failed to fetch second-hop for ${firstLevelPage.id}:`, error);
        }
      }
      
      console.log(`🔗 [PAGE_CONNECTIONS_API] Found ${secondHopConnections.length} second-hop connections`);
    }

    const result = {
      incoming,
      outgoing,
      bidirectional,
      secondHopConnections,
      stats: {
        incomingCount: incoming.length,
        outgoingCount: outgoing.length,
        bidirectionalCount: bidirectional.length,
        secondHopCount: secondHopConnections.length
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
