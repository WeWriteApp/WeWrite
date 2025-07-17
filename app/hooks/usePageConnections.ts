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
export function usePageConnections(pageId: string, pageTitle?: string): PageConnectionData & { refresh: () => void } {
  const [incoming, setIncoming] = useState<PageConnection[]>([]);
  const [outgoing, setOutgoing] = useState<PageConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchConnections = useCallback(async () => {
    if (!pageId) return;

    try {
      setLoading(true);
      setError(null);
      console.log('🔗 usePageConnections: Fetching connections for page:', pageId);

      // Use the page connections API
      const response = await fetch(`/api/page-connections?pageId=${pageId}&includeSecondHop=false&limit=50`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔗 usePageConnections: API error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔗 usePageConnections: API response:', data);
      console.log('🔗 usePageConnections: API response:', data.stats);

      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);

    } catch (err) {
      console.error('🔗 usePageConnections: Error fetching page connections:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections, refreshTrigger]);

  const refresh = useCallback(() => {
    console.log('🔄 [CONNECTIONS] Manual refresh triggered for page:', pageId);
    setRefreshTrigger(prev => prev + 1);
  }, [pageId]);

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
    error,
    refresh
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

      // Use the page connections API with second-hop enabled
      const response = await fetch(`/api/page-connections?pageId=${pageId}&includeSecondHop=true&limit=50`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔗 usePageConnectionsGraph: API error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔗 usePageConnectionsGraph: API response:', data);
      console.log('🔗 usePageConnectionsGraph: Second-hop API response:', data.stats);

      setSecondHopConnections(data.secondHopConnections || []);

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
