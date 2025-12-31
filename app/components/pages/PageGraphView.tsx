"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import dynamic from 'next/dynamic';
import { LoadingState } from '../ui/LoadingState';
import { Button } from '../ui/button';
import { usePageConnectionsGraph, getLinkDirection } from '../../hooks/usePageConnections';
import { useRelatedPages } from '../../hooks/useRelatedPages';
import { useAuth } from '../../providers/AuthProvider';
import SubscriptionGate from '../subscription/SubscriptionGate';
import { PillLink } from '../utils/PillLink';
import { Drawer, DrawerContent, DrawerClose } from '../ui/drawer';

// Dynamically import 3D graph component (WebGL requires client-side only)
const PageGraph3D = dynamic(() => import('./PageGraph3D'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Icon name="Loader" className="text-muted-foreground" />
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
  pageOwnerId?: string; // The user ID of the page owner, to determine if viewing own content
  embedded?: boolean; // If true, renders just the graph without card wrapper (for drawer/modal use)
  // Pre-loaded graph data (optional) - when provided, skips fetching
  initialGraphData?: {
    nodes: Array<{ id: string; title: string; isOrphan?: boolean }>;
    links: Array<{ source: string; target: string; type: string }>;
  };
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

export default function PageGraphView({
  pageId,
  pageTitle,
  className = "",
  onRefreshReady,
  replyToId,
  replyType,
  pageOwnerId,
  embedded = false,
  initialGraphData
}: PageGraphViewProps) {
  // Initialize nodes/links from pre-loaded data if available
  const [nodes, setNodes] = useState<GraphNode[]>(() => {
    if (initialGraphData?.nodes) {
      return initialGraphData.nodes.map(node => ({
        id: node.id,
        title: node.title,
        isCenter: node.id === pageId,
        level: node.id === pageId ? 0 : 1,
        nodeType: node.id === pageId ? 'center' : 'connected' as const,
      }));
    }
    return [];
  });
  const [links, setLinks] = useState<GraphLink[]>(() => {
    if (initialGraphData?.links) {
      return initialGraphData.links.map(link => ({
        source: link.source,
        target: link.target,
        type: link.type as 'outgoing' | 'incoming' | 'bidirectional',
      }));
    }
    return [];
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasActivatedGraph, setHasActivatedGraph] = useState(false);
  const { user } = useAuth();

  // Determine if user is viewing their own content (allows viewing without subscription)
  const isOwnContent = Boolean(user?.uid && pageOwnerId && user.uid === pageOwnerId);

  // Handle graph activation (user taps to use a free view)
  const handleActivateGraph = useCallback(() => {
    setHasActivatedGraph(true);
    setIsFullscreen(true);
  }, []);

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

  // Skip fetching if we have pre-loaded graph data
  const hasInitialData = Boolean(initialGraphData?.nodes && initialGraphData.nodes.length > 0);

  // Use consolidated page connections hook - only fetch if no initial data
  const {
    incoming,
    outgoing,
    bidirectional,
    allConnections,
    secondHopConnections,
    thirdHopConnections,
    graphLoading: hookLoading,
    refresh
  } = usePageConnectionsGraph(hasInitialData ? '' : pageId, hasInitialData ? '' : pageTitle);

  // Use related pages hook - returns relatedByOthers (pages by other authors)
  // Only fetch if no initial data
  const { relatedByOthers: relatedPages, loading: relatedHookLoading } = useRelatedPages({
    pageId: hasInitialData ? '' : pageId,
    pageTitle: hasInitialData ? '' : pageTitle,
    limitByOthers: 10,
    limitByAuthor: 0 // We only need related pages by others for the graph
  });

  // If we have initial data, skip loading states
  const loading = hasInitialData ? false : hookLoading;
  const relatedLoading = hasInitialData ? false : relatedHookLoading;

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefreshReady && refresh) {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);

  // Build graph when connections data changes
  // Skip if we already have initial data loaded
  useEffect(() => {
    if (hasInitialData) return; // Already have pre-loaded data
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

    // Related pages are added as disconnected nodes (no links) - they float in the graph

    setNodes(allNodes);
    setLinks(allLinks);
  }, [pageId, pageTitle, loading, relatedLoading, hasInitialData, allConnections.length, incoming.length, outgoing.length, bidirectional.length, secondHopConnections.length, thirdHopConnections.length, relatedPages.length]);

  // Share the graph view URL - must be defined before any early returns
  const handleShare = useCallback(async () => {
    const graphUrl = `${window.location.origin}/${pageId}#graph`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Graph view: ${pageTitle}`,
          url: graphUrl,
        });
      } catch {
        // User cancelled or share failed, fall back to clipboard
        await navigator.clipboard.writeText(graphUrl);
      }
    } else {
      await navigator.clipboard.writeText(graphUrl);
    }
  }, [pageId, pageTitle]);

  // Loading state - handle embedded mode differently
  if (loading || relatedLoading) {
    if (embedded) {
      return (
        <div className={`${className} h-full w-full flex items-center justify-center`}>
          <LoadingState
            variant="spinner"
            message="Loading page connections..."
            minHeight="h-full"
          />
        </div>
      );
    }
    return (
      <div className={className}>
        <div className="wewrite-card">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Network" size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-medium">Graph view</h3>
          </div>
          <LoadingState
            variant="spinner"
            message="Loading page connections..."
            minHeight="h-64"
          />
        </div>
      </div>
    );
  }

  // Empty state - handle embedded mode differently
  if (nodes.length <= 1) {
    if (embedded) {
      return (
        <div className={`${className} h-full w-full flex items-center justify-center text-muted-foreground`}>
          <p>No page connections found</p>
        </div>
      );
    }
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


  // Embedded mode: render just the graph content without card wrapper
  // Return early before creating the fullscreen drawer
  if (embedded) {
    return (
      <div className={`${className} h-full w-full overflow-hidden`}>
        <SubscriptionGate
          featureName="graph"
          contentId={pageId}
          className="relative h-full overflow-hidden"
          allowInteraction={true}
          isOwnContent={isOwnContent}
          requireActivation={false}
          isActivated={true}
          onActivate={() => {}}
        >
          <div className="h-full w-full overflow-hidden">
            <PageGraph3D
              nodes={nodes}
              links={links}
              pageId={pageId}
              isFullscreen={false}
              height={500}
              isPreview={false}
            />
          </div>
        </SubscriptionGate>
      </div>
    );
  }

  // Fullscreen drawer for non-embedded mode
  const fullscreenDrawer = (
    <Drawer
      open={isFullscreen}
      onOpenChange={setIsFullscreen}
      hashId="graph"
      analyticsId="graph_view"
    >
      <DrawerContent
        height="calc(100dvh - 40px)"
        showOverlay={true}
        className="!rounded-t-3xl"
        disableSwipeDismiss={true}
      >
        {/* Header with controls */}
        <div className="px-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Connections to {pageTitle}</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="text-muted-foreground hover:text-foreground"
                title="Share graph view"
              >
                <Icon name="Share2" size={16} />
              </Button>
              <DrawerClose asChild>
                <Button
                  variant="secondary"
                  size="sm"
                >
                  <Icon name="X" size={16} />
                </Button>
              </DrawerClose>
            </div>
          </div>
        </div>

        {/* Graph container */}
        <div className="flex-1 min-h-0">
          <SubscriptionGate
            featureName="graph"
            contentId={pageId}
            className="h-full"
            allowInteraction={true}
            isOwnContent={isOwnContent}
            requireActivation={!isOwnContent}
            isActivated={hasActivatedGraph}
            onActivate={() => setHasActivatedGraph(true)}
          >
            <PageGraph3D
              nodes={nodes}
              links={links}
              pageId={pageId}
              isFullscreen={true}
            />
          </SubscriptionGate>
        </div>
      </DrawerContent>
    </Drawer>
  );

  return (
    <>
      {/* Fullscreen Drawer */}
      {fullscreenDrawer}

      <div className={`${className} animate-in fade-in-0 duration-300`}>
        <div
          className="wewrite-card transition-all duration-200 cursor-pointer hover:shadow-md w-full text-left"
          onClick={() => setIsFullscreen(true)}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 w-full">
            <div className="flex items-center gap-2">
              <Icon name="Network" size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-medium">Graph view</h3>
            </div>
            <span className="text-xs text-muted-foreground">Tap to view interactive graph</span>
          </div>

          {/* Graph container - preview mode with auto-rotation */}
          {/* Use requireActivation mode for non-owners so tapping to view consumes a free view */}
          <SubscriptionGate
            featureName="graph"
            contentId={pageId}
            className="relative"
            allowInteraction={true}
            isOwnContent={isOwnContent}
            requireActivation={!isOwnContent}
            isActivated={hasActivatedGraph}
            onActivate={handleActivateGraph}
          >
            <div className="h-96 transition-all duration-300 relative">
              {/* Graph preview with pointer-events disabled */}
              <div className="absolute inset-0 pointer-events-none">
                <PageGraph3D
                  nodes={nodes}
                  links={links}
                  pageId={pageId}
                  isFullscreen={false}
                  height={384}
                  isPreview={true}
                />
              </div>
              {/* Transparent click overlay on top */}
              <div className="absolute inset-0 z-10" />
            </div>
          </SubscriptionGate>
        </div>
      </div>
    </>
  );
}
