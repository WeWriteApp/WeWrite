"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Maximize2, X, Link2, FileText, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { LoadingState } from '../ui/LoadingState';
import { Button } from '../ui/button';
import { graphDataCache } from '../../utils/graphDataCache';
import { createPortal } from 'react-dom';
import SubscriptionGate from '../subscription/SubscriptionGate';
import { useTheme } from '../../providers/ThemeProvider';
import { PillLink } from './PillLink';

// Dynamically import 3D graph component (WebGL requires client-side only)
const UserGraph3D = dynamic(() => import('./UserGraph3D'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface UserPage {
  id: string;
  title: string;
  username?: string;
}

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

/**
 * UserGraphTab Component
 *
 * Shows a full 3D graph of all interconnected pages for a specific user.
 * Does not include related pages - only shows actual link connections.
 * All pages are treated equally (no center node concept).
 */
type SortField = 'title' | 'links';
type SortDirection = 'asc' | 'desc';

export default function UserGraphTab({ userId, username, isOwnContent = false }: UserGraphTabProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sortField, setSortField] = useState<SortField>('links');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

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

  // Compute theme-aware colors for fullscreen - must be before any early returns
  const fullscreenBgColor = isDarkMode ? '#000000' : '#ffffff';

  // Ensure we're mounted on the client side for portal rendering
  useEffect(() => {
    setMounted(true);
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

  // Fetch user's pages and their connections (optimized with caching)
  useEffect(() => {
    if (!userId) return;

    const fetchUserGraph = async () => {
      try {
        setLoading(true);

        console.log('[USER_GRAPH] Fetching graph for user:', userId);

        // Get user's pages from cache
        const userPagesData = await graphDataCache.getUserPages(userId, 100);
        const userPages = userPagesData.pages || [];

        console.log('[USER_GRAPH] Found user pages:', userPages.length);

        if (userPages.length === 0) {
          setNodes([]);
          setLinks([]);
          setLoading(false);
          return;
        }

        // Batch fetch connections for all pages (optimized)
        const pageIds = userPages.map(p => p.id);
        const connectionsMap = await graphDataCache.getBatchPageConnections(pageIds);

        const allLinks: GraphLink[] = [];
        const processedPairs = new Set<string>();

        // Process connections to create links between user's pages
        for (const page of userPages) {
          const connections = connectionsMap.get(page.id);
          if (!connections) continue;

          const { incoming, outgoing } = connections;

          // Add outgoing links (this page links TO other user pages)
          outgoing.forEach((targetPage: UserPage) => {
            if (userPages.some(p => p.id === targetPage.id)) {
              const pairKey = [page.id, targetPage.id].sort().join('-');
              if (processedPairs.has(pairKey)) return;
              processedPairs.add(pairKey);

              // Check if bidirectional
              const targetConnections = connectionsMap.get(targetPage.id);
              const isBidirectional = targetConnections?.outgoing?.some((p: UserPage) => p.id === page.id);

              allLinks.push({
                source: page.id,
                target: targetPage.id,
                type: isBidirectional ? 'bidirectional' : 'outgoing'
              });
            }
          });

          // Add incoming links (other user pages link TO this page)
          incoming.forEach((sourcePage: UserPage) => {
            if (userPages.some(p => p.id === sourcePage.id)) {
              const pairKey = [sourcePage.id, page.id].sort().join('-');
              if (processedPairs.has(pairKey)) return;
              processedPairs.add(pairKey);

              allLinks.push({
                source: sourcePage.id,
                target: page.id,
                type: 'incoming'
              });
            }
          });
        }

        // Remove duplicate links first
        const uniqueLinks = allLinks.filter((link, index, self) =>
          index === self.findIndex(l =>
            (l.source === link.source && l.target === link.target) ||
            (l.source === link.target && l.target === link.source)
          )
        );

        // Count connections per page (internal links only)
        const connectionCounts = new Map<string, number>();
        uniqueLinks.forEach(link => {
          connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1);
          connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1);
        });

        // Create nodes for all user pages with connection counts and orphan status
        const graphNodes: GraphNode[] = userPages.map(page => {
          const connectionCount = connectionCounts.get(page.id) || 0;
          return {
            id: page.id,
            title: page.title || 'Untitled',
            username: page.username,
            isOrphan: connectionCount === 0,
            connectionCount,
          };
        });

        console.log('[USER_GRAPH] Created graph:', {
          nodes: graphNodes.length,
          links: uniqueLinks.length,
          orphans: graphNodes.filter(n => n.isOrphan).length
        });

        setNodes(graphNodes);
        setLinks(uniqueLinks);

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
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <p>No connected pages found for {username}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Page Connections Graph</h3>
          <p className="text-xs text-muted-foreground">
            {nodes.length} pages with {links.length} connections
          </p>
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
      <SubscriptionGate featureName="graph" className="relative" isOwnContent={isOwnContent} allowInteraction={true}>
        <div className="bg-background border border-border rounded-lg h-[500px] transition-all duration-300 overflow-hidden">
          <UserGraph3D
            nodes={nodes}
            links={links}
            isFullscreen={false}
            height={500}
          />
        </div>
      </SubscriptionGate>

      {/* Page Connections Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Pages
        </h3>
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
                <th className="text-right px-4 py-2 font-medium w-20 whitespace-nowrap">
                  <button
                    onClick={() => handleSort('links')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors whitespace-nowrap"
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
                      <Link2 className="h-3 w-3" />
                      {node.connectionCount || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fullscreen modal - rendered via portal to escape container constraints */}
      {mounted && isFullscreen && createPortal(
        <div
          className="fixed inset-0 z-[9999] animate-in fade-in-0 duration-300 text-foreground"
          style={{
            touchAction: 'manipulation',
            pointerEvents: 'auto',
            backgroundColor: fullscreenBgColor,
          }}
        >
          {/* Solid background layer */}
          <div className="absolute inset-0" style={{ backgroundColor: fullscreenBgColor, zIndex: -1 }} />

          {/* Header with controls */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-background border-b border-border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Page Connections Graph</h3>
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
        </div>,
        document.body
      )}
    </div>
  );
}
