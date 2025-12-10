"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Maximize2, X, Network, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Link2 } from 'lucide-react';
import { LoadingState } from '../ui/LoadingState';
import { Button } from '../ui/button';
import { usePageConnectionsGraph, getLinkDirection } from '../../hooks/usePageConnections';
import { useRelatedPages } from '../../hooks/useRelatedPages';
import { useAuth } from '../../providers/AuthProvider';
import SubscriptionGate from '../subscription/SubscriptionGate';
import { PillLink } from '../utils/PillLink';
import { useTheme } from '../../providers/ThemeProvider';

// Dynamically import 3D graph component (WebGL requires client-side only)
const PageGraph3D = dynamic(() => import('./PageGraph3D'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface GraphNode {
  id: string;
  title: string;
  username?: string;
  isCenter: boolean;
  level: number; // 0 = center, 1 = direct connections, 2 = second-hop, 3 = related pages
  nodeType: 'center' | 'connected' | 'related'; // Type of node for styling
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'outgoing' | 'incoming' | 'bidirectional';
  sentiment?: 'agree' | 'disagree';
}

interface PageGraphViewProps {
  pageId: string;
  pageTitle: string;
  className?: string;
  onRefreshReady?: (refreshFn: () => void) => void;
  replyToId?: string | null;
  replyType?: 'agree' | 'disagree' | 'standard' | 'neutral' | null;
}

/**
 * PageGraphView Component
 *
 * Shows a graph visualization of page connections using D3.js:
 * - Center node: Current page
 * - Level 1: Pages that link to/from current page (1 hop)
 * - Level 2: Pages that link to/from level 1 pages (2 hops away)
 * - Level 3: Pages that link to/from level 2 pages (3 hops away)
 * - Interactive: Click to navigate, pinch to zoom, drag nodes
 * - Styled with current pill link style
 * - Visual key shows different hop levels
 */
type SortField = 'title' | 'links';
type SortDirection = 'asc' | 'desc';

export default function PageGraphView({
  pageId,
  pageTitle,
  className = "",
  onRefreshReady,
  replyToId,
  replyType
}: PageGraphViewProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const { user } = useAuth();
  const [isPageListExpanded, setIsPageListExpanded] = useState(false);
  const [sortField, setSortField] = useState<SortField>('links');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Toggle sort handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'links' ? 'desc' : 'asc');
    }
  }, [sortField]);

  // ESC key handler for fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Use consolidated page connections hook
  const {
    incoming,
    outgoing,
    bidirectional,
    allConnections,
    secondHopConnections,
    thirdHopConnections,
    graphLoading: loading,
    refresh
  } = usePageConnectionsGraph(pageId, pageTitle);

  // Use related pages hook - exclude current user's pages
  const { relatedPages, loading: relatedLoading } = useRelatedPages(pageId, pageTitle, undefined, user?.username);

  // Compute page link statistics for the page list
  const pageLinkStats = useMemo(() => {
    // Map to track unique pages and their link counts
    const pageMap = new Map<string, {
      id: string;
      title: string;
      username?: string;
      inLinks: number;
      outLinks: number;
      totalLinks: number;
    }>();

    // Add current page
    pageMap.set(pageId, {
      id: pageId,
      title: pageTitle,
      username: user?.username,
      inLinks: incoming.length,
      outLinks: outgoing.length,
      totalLinks: incoming.length + outgoing.length
    });

    // Process all direct connections
    allConnections.forEach(conn => {
      const isIncoming = incoming.some(inc => inc.id === conn.id);
      const isOutgoing = outgoing.some(out => out.id === conn.id);
      const isBidirectional = bidirectional.some(bi => bi.id === conn.id);

      let inCount = 0;
      let outCount = 0;

      if (isBidirectional) {
        // Bidirectional means this page links to us AND we link to it
        inCount = 1;
        outCount = 1;
      } else if (isIncoming) {
        // This page links to us
        outCount = 1; // From their perspective, it's an outgoing link
      } else if (isOutgoing) {
        // We link to this page
        inCount = 1; // From their perspective, it's an incoming link
      }

      if (!pageMap.has(conn.id)) {
        pageMap.set(conn.id, {
          id: conn.id,
          title: conn.title,
          username: conn.username,
          inLinks: inCount,
          outLinks: outCount,
          totalLinks: inCount + outCount
        });
      }
    });

    // Add second-hop connections
    secondHopConnections.forEach(conn => {
      if (!pageMap.has(conn.id)) {
        pageMap.set(conn.id, {
          id: conn.id,
          title: conn.title,
          username: conn.username,
          inLinks: 1, // Has at least one connection to reach here
          outLinks: 0,
          totalLinks: 1
        });
      }
    });

    // Add third-hop connections
    thirdHopConnections.forEach(conn => {
      if (!pageMap.has(conn.id)) {
        pageMap.set(conn.id, {
          id: conn.id,
          title: conn.title,
          username: conn.username,
          inLinks: 1,
          outLinks: 0,
          totalLinks: 1
        });
      }
    });

    // Convert to array (sorting will be applied in sortedPageLinkStats)
    return Array.from(pageMap.values());
  }, [pageId, pageTitle, user?.username, incoming, outgoing, bidirectional, allConnections, secondHopConnections, thirdHopConnections]);

  // Sorted page link stats based on sort field and direction
  const sortedPageLinkStats = useMemo(() => {
    return [...pageLinkStats].sort((a, b) => {
      if (sortField === 'links') {
        const diff = b.totalLinks - a.totalLinks;
        return sortDirection === 'desc' ? diff : -diff;
      } else {
        // Sort by title
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        const diff = titleA.localeCompare(titleB);
        return sortDirection === 'asc' ? diff : -diff;
      }
    });
  }, [pageLinkStats, sortField, sortDirection]);

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefreshReady && refresh) {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);

  // Build graph when connections data changes
  useEffect(() => {
    if (loading || relatedLoading) return;
    const sentiment = replyType === 'agree' || replyType === 'disagree' ? replyType : null;

    // Create center node
    const centerNode: GraphNode = {
      id: pageId,
      title: pageTitle || 'Current Page',
      isCenter: true,
      level: 0,
      nodeType: 'center'
    };

    // Create level 1 nodes (direct connections)
    const level1Nodes: GraphNode[] = allConnections.map(connection => ({
      id: connection.id,
      title: connection.title,
      username: connection.username,
      isCenter: false,
      level: 1,
      nodeType: 'connected'
    }));

    // Create level 2 nodes (2-hop connections)
    const level2Nodes: GraphNode[] = secondHopConnections.map(connection => ({
      id: connection.id,
      title: connection.title,
      username: connection.username,
      isCenter: false,
      level: 2,
      nodeType: 'connected'
    }));

    // Create level 3 nodes (3-hop connections)
    const level3Nodes: GraphNode[] = thirdHopConnections.map(connection => ({
      id: connection.id,
      title: connection.title,
      username: connection.username,
      isCenter: false,
      level: 3,
      nodeType: 'connected'
    }));

    // Create related pages nodes (floating without connections) - only show others' pages
    // If there are no connections, show more related pages to make the graph useful
    const hasAnyConnections = allConnections.length > 0 || secondHopConnections.length > 0 || thirdHopConnections.length > 0;
    const maxRelatedPages = hasAnyConnections ? 5 : 10; // Show more related pages when there are no connections

    const relatedNodes: GraphNode[] = relatedPages
      .filter(page =>
        // Exclude pages that are already in the graph as connections
        page.id !== pageId &&
        !allConnections.some(conn => conn.id === page.id) &&
        !secondHopConnections.some(conn => conn.id === page.id) &&
        !thirdHopConnections.some(conn => conn.id === page.id) &&
        // Only show related pages by other people (exclude current user's pages)
        page.username !== user?.username
      )
      .slice(0, maxRelatedPages) // Limit the number of related pages
      .map(page => ({
        id: page.id,
        title: page.title,
        username: page.username,
        isCenter: false,
        level: 4,
        nodeType: 'related'
      }));

    // Combine all nodes
    const allNodes = [centerNode, ...level1Nodes, ...level2Nodes, ...level3Nodes, ...relatedNodes];

    // Create links with proper directionality
    const allLinks: GraphLink[] = [];

    // Level 1 connections (center to/from direct connections)
    allConnections.forEach(connection => {
      const direction = getLinkDirection(pageId, connection.id, incoming, outgoing);
      const sentimentMatch = sentiment && replyToId && connection.id === replyToId ? sentiment : null;
      if (direction === 'bidirectional') {
        // Create bidirectional link
        allLinks.push({
          source: pageId,
          target: connection.id,
          type: 'bidirectional',
          sentiment: sentimentMatch || undefined
        });
      } else if (direction === 'outgoing') {
        // Center links TO this page
        allLinks.push({
          source: pageId,
          target: connection.id,
          type: 'outgoing',
          sentiment: sentimentMatch || undefined
        });
      } else {
        // This page links TO center
        allLinks.push({
          source: connection.id,
          target: pageId,
          type: 'incoming',
          sentiment: sentimentMatch || undefined
        });
      }
    });

    // Level 2 connections (second-hop to first-hop)
    // These are more realistic connections since they come from the backlinks index
    secondHopConnections.forEach(secondHopConnection => {
      // Find first-level connections this second-hop page might link to
      // Since second-hop comes from backlinks, we know there's a connection
      const possibleTargets = allConnections.filter(conn =>
        // Prefer connections that would make sense based on the data structure
        incoming.some(inc => inc.id === conn.id) || outgoing.some(out => out.id === conn.id)
      );

      if (possibleTargets.length > 0) {
        // Connect to the first available target (could be randomized or based on other criteria)
        const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
        allLinks.push({
          source: secondHopConnection.id,
          target: target.id,
          type: 'incoming'
        });
      }
    });

    // Level 3 connections (third-hop to second-hop)
    thirdHopConnections.forEach(thirdHopConnection => {
      // Find second-level connections this third-hop page might link to
      const possibleTargets = secondHopConnections.filter(conn =>
        // Ensure we have valid second-hop targets
        conn.id !== thirdHopConnection.id
      );

      if (possibleTargets.length > 0) {
        // Connect to a random second-hop target
        const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
        allLinks.push({
          source: thirdHopConnection.id,
          target: target.id,
          type: 'incoming'
        });
      }
    });

    // Add all related pages as disconnected nodes (no links)
    relatedNodes.forEach(relatedNode => {
      // Don't add links for related pages - they should appear as disconnected nodes
      console.log('🎯 Adding related page as disconnected node:', relatedNode.title);
    });

    setNodes(allNodes);
    setLinks(allLinks);
  }, [pageId, pageTitle, loading, relatedLoading, allConnections.length, incoming.length, outgoing.length, bidirectional.length, secondHopConnections.length, thirdHopConnections.length, relatedPages.length]);

  if (loading || relatedLoading) {
    return (
      <div className={className}>
        <LoadingState
          variant="spinner"
          message="Loading page connections..."
          minHeight="h-64"
        />
      </div>
    );
  }

  if (nodes.length <= 1) {
    return (
      <div className={className}>
        <div className="wewrite-card">
          <h3 className="text-sm font-medium mb-4">Graph view</h3>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>No page connections found</p>
          </div>
        </div>
      </div>
    );
  }

  // Compute theme-aware colors for fullscreen
  const fullscreenBgColor = isDarkMode ? '#000000' : '#ffffff';

  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-[9999] animate-in fade-in-0 duration-300 text-foreground"
        style={{
          touchAction: 'manipulation',
          pointerEvents: 'auto',
          backgroundColor: fullscreenBgColor,
        }}
      >
        {/* Solid background layer with computed color to ensure opacity */}
        <div className="absolute inset-0" style={{ backgroundColor: fullscreenBgColor, zIndex: -1 }} />
        {/* Header with controls */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-background border-b border-border p-4 shadow-sm">
          {/* Top row: Title and controls */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Graph view</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

        </div>

        {/* Graph container */}
        <div className="absolute inset-0 pt-16">
          <SubscriptionGate
            featureName="graph"
            className="h-full"
            allowInteraction={true}
          >
            <PageGraph3D
              nodes={nodes}
              links={links}
              pageId={pageId}
              isFullscreen={true}
            />
          </SubscriptionGate>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} animate-in fade-in-0 duration-300`}>
      <div className="wewrite-card transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Graph view</h3>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsFullscreen(true)}
            className="transition-all duration-200 hover:scale-105"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Graph container */}
        <SubscriptionGate featureName="graph" className="relative" allowInteraction={true}>
          <div className="h-96 transition-all duration-300">
            <PageGraph3D
              nodes={nodes}
              links={links}
              pageId={pageId}
              isFullscreen={false}
              height={384}
            />
          </div>
        </SubscriptionGate>

        {/* Page List - as pills with sorting */}
        {pageLinkStats.length > 1 && (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPageListExpanded(!isPageListExpanded);
              }}
              className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="font-medium">Pages ({pageLinkStats.length})</span>
              {isPageListExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {isPageListExpanded && (
              <div className="mt-3">
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left px-4 py-2 font-medium">
                          <button
                            onClick={() => handleSort('title')}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            Page
                            {sortField === 'title' && (
                              sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            )}
                          </button>
                        </th>
                        <th className="text-right px-4 py-2 font-medium w-24">
                          <button
                            onClick={() => handleSort('links')}
                            className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                          >
                            Links
                            {sortField === 'links' && (
                              sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                            )}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPageLinkStats.map((page) => (
                        <tr
                          key={page.id}
                          className={`border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors ${
                            page.id === pageId ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="px-4 py-2">
                            {page.id === pageId ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-sm font-medium rounded-lg bg-primary/20 text-primary border border-primary/30">
                                {page.title}
                              </span>
                            ) : (
                              <PillLink
                                href={`/${page.id}`}
                                pageId={page.id}
                              >
                                {page.title}
                              </PillLink>
                            )}
                          </td>
                          <td className="text-right px-4 py-2 tabular-nums">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Link2 className="h-3 w-3" />
                              {page.totalLinks}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
