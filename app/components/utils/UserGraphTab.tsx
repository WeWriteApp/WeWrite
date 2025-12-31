"use client";

/**
 * UserGraphTab Component
 *
 * Shows a 3D graph visualization of all interconnected pages for a specific user.
 *
 * ## Architecture (matches PageGraphView for consistency)
 * - Preview mode: Non-interactive, slowly rotating graph preview
 * - Fullscreen mode: Interactive graph in a Drawer component
 * - Uses Drawer component with disableSwipeDismiss to prevent conflicts with graph drag
 *
 * ## Key Features
 * - Auto-rotating preview with pointer-events disabled
 * - Tap preview to open fullscreen interactive view
 * - Sortable pages list with link counts
 * - Dark/light mode support with bloom effects
 *
 * ## Related Components
 * - UserGraph3D: The actual 3D force-directed graph (WebGL)
 * - PageGraphView: Similar implementation for single page context
 * - PageGraph3D: Similar 3D graph for page connections
 *
 * @see /app/components/pages/PageGraphView.tsx - Reference implementation
 * @see /app/components/utils/UserGraph3D.tsx - 3D graph component
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import dynamic from 'next/dynamic';
import { LoadingState } from '../ui/LoadingState';
import EmptyState from '../ui/EmptyState';
import { Button } from '../ui/button';
import SubscriptionGate from '../subscription/SubscriptionGate';
import { PillLink } from './PillLink';
import { Drawer, DrawerContent, DrawerClose } from '../ui/drawer';

// Dynamically import 3D graph component (WebGL requires client-side only)
const UserGraph3D = dynamic(() => import('./UserGraph3D'), {
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
  isOrphan?: boolean;
  connectionCount?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'outgoing' | 'incoming' | 'bidirectional';
}

interface UserGraphTabProps {
  userId: string;
  username: string;
  isOwnContent?: boolean;
}

type SortField = 'title' | 'links';
type SortDirection = 'asc' | 'desc';

export default function UserGraphTab({ userId, username, isOwnContent = false }: UserGraphTabProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('links');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort nodes based on current sort field and direction
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (sortField === 'links') {
        const diff = (b.connectionCount || 0) - (a.connectionCount || 0);
        return sortDirection === 'desc' ? diff : -diff;
      } else {
        // Sort by title
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        const diff = titleA.localeCompare(titleB);
        return sortDirection === 'asc' ? diff : -diff;
      }
    });
  }, [nodes, sortField, sortDirection]);

  // Toggle sort handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default direction
      setSortField(field);
      setSortDirection(field === 'links' ? 'desc' : 'asc');
    }
  }, [sortField]);

  // Share graph URL handler
  const handleShare = useCallback(async () => {
    const graphUrl = `${window.location.origin}/u/${username}?tab=graph#graph`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${username}'s Page Connections`,
          url: graphUrl,
        });
      } catch {
        // User cancelled or error - fallback to clipboard
        await navigator.clipboard.writeText(graphUrl);
      }
    } else {
      await navigator.clipboard.writeText(graphUrl);
    }
  }, [username]);

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

  // Fetch user's graph data using optimized single-request API
  useEffect(() => {
    if (!userId) return;

    const fetchUserGraph = async () => {
      try {
        setLoading(true);

        console.log('[USER_GRAPH] Fetching graph for user:', userId);

        // Use optimized single-request API instead of N+1 queries
        const response = await fetch(`/api/user-graph?userId=${userId}&limit=100`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        console.log('[USER_GRAPH] API response:', {
          nodes: data.nodes?.length || 0,
          links: data.links?.length || 0,
          computeTimeMs: data.stats?.computeTimeMs
        });

        if (!data.nodes || data.nodes.length === 0) {
          setNodes([]);
          setLinks([]);
          setLoading(false);
          return;
        }

        // Data comes pre-computed from the API
        setNodes(data.nodes);
        setLinks(data.links || []);

      } catch (error) {
        console.error('Error fetching user graph:', error);
        setNodes([]);
        setLinks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserGraph();
  }, [userId]);

  if (loading) {
    return (
      <LoadingState
        variant="spinner"
        message={`Loading ${username}'s page connections...`}
        minHeight="h-64"
      />
    );
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon="Network"
        title="No connected pages"
        description={`${username} doesn't have any pages with connections yet. Pages become connected when they link to each other.`}
        size="lg"
      />
    );
  }

  // Fullscreen drawer component (matches PageGraphView pattern)
  const fullscreenDrawer = (
    <Drawer
      open={isFullscreen}
      onOpenChange={setIsFullscreen}
      hashId="graph"
      analyticsId="user_graph_view"
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
            <h3 className="text-lg font-semibold">{username}&apos;s Page Connections</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
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
            contentId={`user:${userId}`}
            className="h-full"
            isOwnContent={isOwnContent}
            allowInteraction={true}
          >
            <UserGraph3D
              nodes={nodes}
              links={links}
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

      <div className="space-y-6 animate-in fade-in-0 duration-300">
        {/* Graph Preview Card - tap to open fullscreen */}
        <div
          className="wewrite-card transition-all duration-200 cursor-pointer hover:shadow-md w-full text-left"
          onClick={() => setIsFullscreen(true)}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 w-full">
            <div className="flex items-center gap-2">
              <Icon name="Network" size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-medium">Page Connections Graph</h3>
            </div>
            <span className="text-xs text-muted-foreground">Tap to view interactive graph</span>
          </div>

          {/* Graph Preview - non-interactive with auto-rotation */}
          <SubscriptionGate
            featureName="graph"
            contentId={`user:${userId}`}
            className="relative"
            isOwnContent={isOwnContent}
            allowInteraction={true}
          >
            <div className="h-80 transition-all duration-300 relative">
              {/* Graph preview with pointer-events disabled */}
              <div className="absolute inset-0 pointer-events-none">
                <UserGraph3D
                  nodes={nodes}
                  links={links}
                  isFullscreen={false}
                  height={320}
                  isPreview={true}
                />
              </div>
              {/* Transparent click overlay on top */}
              <div className="absolute inset-0 z-10" />
            </div>
          </SubscriptionGate>
        </div>

        {/* Page Connections Table */}
        <div className="wewrite-card space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Icon name="FileText" size={16} />
            Pages ({nodes.length})
          </h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2 font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('title');
                      }}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Page
                      {sortField === 'title' && (
                        sortDirection === 'asc' ? <Icon name="ArrowUp" size={12} /> : <Icon name="ArrowDown" size={12} />
                      )}
                    </button>
                  </th>
                  <th className="text-right px-4 py-2 font-medium w-20 whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('links');
                      }}
                      className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      Links
                      {sortField === 'links' && (
                        sortDirection === 'desc' ? <Icon name="ArrowDown" size={12} /> : <Icon name="ArrowUp" size={12} />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedNodes.map((node) => (
                  <tr
                    key={node.id}
                    className={`border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors ${
                      node.isOrphan ? 'text-muted-foreground' : ''
                    }`}
                  >
                    <td className="px-4 py-2">
                      <PillLink
                        href={`/${node.id}`}
                        pageId={node.id}
                        className={node.isOrphan ? 'opacity-50' : ''}
                      >
                        {node.title}
                      </PillLink>
                    </td>
                    <td className="text-right px-4 py-2 tabular-nums">
                      <span className={`inline-flex items-center gap-1 ${
                        node.isOrphan ? 'text-muted-foreground/50' : 'text-muted-foreground'
                      }`}>
                        <Icon name="Link2" size={12} />
                        {node.connectionCount || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
