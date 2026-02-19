'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import dynamic from 'next/dynamic';
import { LoadingState } from '../ui/LoadingState';
import EmptyState from '../ui/EmptyState';
import { Button } from '../ui/button';
import { PillLink } from '../utils/PillLink';
import { Drawer, DrawerContent, DrawerClose } from '../ui/drawer';

const UserGraph3D = dynamic(() => import('../utils/UserGraph3D'), {
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

interface GroupGraphTabProps {
  groupId: string;
  groupName: string;
}

type SortField = 'title' | 'links';
type SortDirection = 'asc' | 'desc';

export default function GroupGraphTab({ groupId, groupName }: GroupGraphTabProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('links');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (sortField === 'links') {
        const diff = (b.connectionCount || 0) - (a.connectionCount || 0);
        return sortDirection === 'desc' ? diff : -diff;
      } else {
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        const diff = titleA.localeCompare(titleB);
        return sortDirection === 'asc' ? diff : -diff;
      }
    });
  }, [nodes, sortField, sortDirection]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'links' ? 'desc' : 'asc');
    }
  }, [sortField]);

  const handleShare = useCallback(async () => {
    const graphUrl = `${window.location.origin}/g/${groupId}?tab=graph#graph`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${groupName} Page Connections`, url: graphUrl });
      } catch {
        await navigator.clipboard.writeText(graphUrl);
      }
    } else {
      await navigator.clipboard.writeText(graphUrl);
    }
  }, [groupId, groupName]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (!groupId) return;

    const fetchGroupGraph = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/user-graph?groupId=${groupId}&limit=100`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.nodes || data.nodes.length === 0) {
          setNodes([]);
          setLinks([]);
          setLoading(false);
          return;
        }
        setNodes(data.nodes);
        setLinks(data.links || []);
      } catch (error) {
        console.error('Error fetching group graph:', error);
        setNodes([]);
        setLinks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupGraph();
  }, [groupId]);

  if (loading) {
    return (
      <LoadingState
        variant="spinner"
        message={`Loading ${groupName}'s page connections...`}
        minHeight="h-64"
      />
    );
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon="Network"
        title="No connected pages"
        description="This group doesn't have any pages with connections yet. Pages become connected when they link to each other."
        size="lg"
      />
    );
  }

  const fullscreenDrawer = (
    <Drawer
      open={isFullscreen}
      onOpenChange={setIsFullscreen}
      hashId="graph"
      analyticsId="group_graph_view"
    >
      <DrawerContent
        height="calc(100dvh - 40px)"
        showOverlay={true}
        className="!rounded-t-3xl"
        disableSwipeDismiss={true}
      >
        <div className="px-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Group Page Connections</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare} title="Share graph view">
                <Icon name="Share2" size={16} />
              </Button>
              <DrawerClose asChild>
                <Button variant="secondary" size="sm">
                  <Icon name="X" size={16} />
                </Button>
              </DrawerClose>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <UserGraph3D nodes={nodes} links={links} isFullscreen={true} />
        </div>
      </DrawerContent>
    </Drawer>
  );

  return (
    <>
      {fullscreenDrawer}

      <div className="space-y-6 animate-in fade-in-0 duration-300">
        <div
          className="wewrite-card transition-all duration-200 cursor-pointer hover:shadow-md w-full text-left"
          onClick={() => setIsFullscreen(true)}
        >
          <div className="flex items-center justify-between mb-4 w-full">
            <div className="flex items-center gap-2">
              <Icon name="Network" size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-medium">Group Page Connections</h3>
            </div>
            <span className="text-xs text-muted-foreground">Tap to view interactive graph</span>
          </div>

          <div className="h-80 transition-all duration-300 relative">
            <div className="absolute inset-0 pointer-events-none">
              <UserGraph3D
                nodes={nodes}
                links={links}
                isFullscreen={false}
                height={320}
                isPreview={true}
              />
            </div>
            <div className="absolute inset-0 z-10" />
          </div>
        </div>

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
                      onClick={(e) => { e.stopPropagation(); handleSort('title'); }}
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
                      onClick={(e) => { e.stopPropagation(); handleSort('links'); }}
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
