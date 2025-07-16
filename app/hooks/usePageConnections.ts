"use client";

import { useState, useEffect, useCallback } from 'react';

export interface PageConnection {
  id: string;
  title: string;
  username?: string;
  lastModified?: any;
  isPublic?: boolean;
  linkText?: string;
}

export interface PageConnectionData {
  // Incoming connections (pages that link TO this page)
  incoming: PageConnection[];
  // Outgoing connections (pages this page links TO)
  outgoing: PageConnection[];
  // Bidirectional connections (pages that link to each other)
  bidirectional: PageConnection[];
  // All unique connections (for graph visualization)
  allConnections: PageConnection[];
  // Loading states
  loading: boolean;
  error: string | null;
}

/**
 * Consolidated Page Connections Hook
 * 
 * Provides all page connection data in one place:
 * - Incoming links (backlinks)
 * - Outgoing links (forward links)
 * - Bidirectional links
 * - Combined data for graph visualization
 * 
 * This replaces separate data fetching in BacklinksSection and PageGraphView
 */
export function usePageConnections(pageId: string, pageTitle?: string): PageConnectionData {
  const [incoming, setIncoming] = useState<PageConnection[]>([]);
  const [outgoing, setOutgoing] = useState<PageConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!pageId) return;

    try {
      setLoading(true);
      setError(null);
      console.log('🔗 usePageConnections: Fetching connections for page:', pageId);

      // Get incoming connections (backlinks)
      const { getBacklinks } = await import('../firebase/database/backlinks');
      const incomingConnections = await getBacklinks(pageId, 50);
      console.log('🔗 usePageConnections: Incoming connections:', incomingConnections.length);

      // Get outgoing connections (forward links)
      const outgoingConnections: PageConnection[] = [];
      try {
        const { getPageById } = await import('../firebase/database/pages');
        const { pageData } = await getPageById(pageId);
        
        if (pageData?.content) {
          const { extractLinksFromNodes } = await import('../firebase/database/links');
          const content = typeof pageData.content === 'string' 
            ? JSON.parse(pageData.content) 
            : pageData.content;
          const allLinks = extractLinksFromNodes(content);
          const pageLinks = allLinks.filter(link => link.type === 'page' && link.pageId);
          
          console.log('🔗 usePageConnections: Found page links in content:', pageLinks.length);

          // Fetch page data for each outgoing link
          for (const link of pageLinks) {
            try {
              const { pageData: linkedPage } = await getPageById(link.pageId);
              if (linkedPage && !linkedPage.deleted) {
                outgoingConnections.push({
                  id: link.pageId,
                  title: linkedPage.title || 'Untitled',
                  username: linkedPage.username,
                  lastModified: linkedPage.lastModified,
                  isPublic: linkedPage.isPublic,
                  linkText: link.text || linkedPage.title
                });
              }
            } catch (linkError) {
              console.warn(`Could not fetch outgoing link ${link.pageId}:`, linkError);
            }
          }
        }
      } catch (contentError) {
        console.warn('Could not parse page content for outgoing links:', contentError);
      }

      console.log('🔗 usePageConnections: Outgoing connections:', outgoingConnections.length);

      setIncoming(incomingConnections);
      setOutgoing(outgoingConnections);

    } catch (err) {
      console.error('Error fetching page connections:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Calculate derived data
  const bidirectional = incoming.filter(incomingPage => 
    outgoing.some(outgoingPage => outgoingPage.id === incomingPage.id)
  );

  const allConnections = [
    ...incoming,
    ...outgoing.filter(outgoingPage => 
      !incoming.some(incomingPage => incomingPage.id === outgoingPage.id)
    )
  ];

  return {
    incoming,
    outgoing,
    bidirectional,
    allConnections,
    loading,
    error
  };
}

/**
 * Extended hook for graph visualization with 2-hop connections
 */
export function usePageConnectionsGraph(pageId: string, pageTitle?: string) {
  const baseConnections = usePageConnections(pageId, pageTitle);
  const [secondHopConnections, setSecondHopConnections] = useState<PageConnection[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);

  const fetchSecondHopConnections = useCallback(async () => {
    if (!pageId || baseConnections.loading || baseConnections.allConnections.length === 0) return;

    try {
      setGraphLoading(true);
      console.log('🔗 usePageConnectionsGraph: Fetching 2-hop connections');

      const { getBacklinks } = await import('../firebase/database/backlinks');
      const secondHopSet = new Set<string>();
      const secondHopConnections: PageConnection[] = [];

      // Sample first-level connections to avoid too many requests
      const firstLevelSample = baseConnections.allConnections.slice(0, 5);

      for (const firstLevelPage of firstLevelSample) {
        try {
          const secondLevelBacklinks = await getBacklinks(firstLevelPage.id, 3);
          secondLevelBacklinks.forEach(backlink => {
            if (!secondHopSet.has(backlink.id) && 
                backlink.id !== pageId && 
                !baseConnections.allConnections.some(conn => conn.id === backlink.id)) {
              secondHopSet.add(backlink.id);
              secondHopConnections.push(backlink);
            }
          });
        } catch (error) {
          console.warn(`Could not fetch 2-hop connections for ${firstLevelPage.id}:`, error);
        }
      }

      console.log('🔗 usePageConnectionsGraph: 2-hop connections:', secondHopConnections.length);
      setSecondHopConnections(secondHopConnections.slice(0, 10)); // Limit to 10

    } catch (error) {
      console.error('Error fetching 2-hop connections:', error);
    } finally {
      setGraphLoading(false);
    }
  }, [pageId, baseConnections.loading, baseConnections.allConnections]);

  useEffect(() => {
    fetchSecondHopConnections();
  }, [fetchSecondHopConnections]);

  return {
    ...baseConnections,
    secondHopConnections,
    graphLoading: baseConnections.loading || graphLoading
  };
}

/**
 * Helper function to determine link directionality
 */
export function getLinkDirection(
  sourceId: string, 
  targetId: string, 
  incoming: PageConnection[], 
  outgoing: PageConnection[]
): 'incoming' | 'outgoing' | 'bidirectional' {
  const hasIncoming = incoming.some(conn => conn.id === targetId);
  const hasOutgoing = outgoing.some(conn => conn.id === targetId);
  
  if (hasIncoming && hasOutgoing) return 'bidirectional';
  if (hasOutgoing) return 'outgoing';
  return 'incoming';
}
