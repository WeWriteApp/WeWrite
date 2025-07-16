"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { usePillStyle } from '../../contexts/PillStyleContext';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../ui/button';

interface GraphNode {
  id: string;
  title: string;
  username?: string;
  isCenter: boolean;
  level: number; // 0 = center, 1 = direct connections, 2 = second-hop
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'outgoing' | 'incoming';
}

interface PageGraphViewProps {
  pageId: string;
  pageTitle: string;
  className?: string;
}

/**
 * PageGraphView Component
 * 
 * Shows a graph visualization of page connections using D3.js:
 * - Center node: Current page
 * - Level 1: Pages that link to/from current page
 * - Level 2: Pages that link to/from level 1 pages (2 hops away)
 * - Interactive: Click to navigate, pinch to zoom, drag nodes
 * - Styled with current pill link style
 */
export default function PageGraphView({ pageId, pageTitle, className = "" }: PageGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const router = useRouter();
  const { getPillStyleClasses } = usePillStyle();

  // Fetch graph data
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get backlinks (pages linking TO current page)
      const { getBacklinks } = await import('../../firebase/database/backlinks');
      const backlinks = await getBacklinks(pageId, 20);
      
      // Get outgoing links (pages current page links TO)
      const { getPageById } = await import('../../firebase/database/pages');
      const { pageData } = await getPageById(pageId);
      
      let outgoingLinks: any[] = [];
      if (pageData?.content) {
        const { extractLinksFromNodes } = await import('../../firebase/database/links');
        const content = typeof pageData.content === 'string' 
          ? JSON.parse(pageData.content) 
          : pageData.content;
        const allLinks = extractLinksFromNodes(content);
        outgoingLinks = allLinks.filter(link => link.type === 'page' && link.pageId);
      }

      // Create center node
      const centerNode: GraphNode = {
        id: pageId,
        title: pageTitle,
        isCenter: true,
        level: 0
      };

      // Create level 1 nodes (direct connections)
      const level1Nodes: GraphNode[] = [];
      const level1NodeIds = new Set<string>();

      // Add backlink nodes
      backlinks.forEach(backlink => {
        if (!level1NodeIds.has(backlink.id)) {
          level1Nodes.push({
            id: backlink.id,
            title: backlink.title,
            username: backlink.username,
            isCenter: false,
            level: 1
          });
          level1NodeIds.add(backlink.id);
        }
      });

      // Add outgoing link nodes
      for (const link of outgoingLinks) {
        if (!level1NodeIds.has(link.pageId)) {
          try {
            const { pageData: linkedPage } = await getPageById(link.pageId);
            if (linkedPage && !linkedPage.deleted) {
              level1Nodes.push({
                id: link.pageId,
                title: linkedPage.title || 'Untitled',
                username: linkedPage.username,
                isCenter: false,
                level: 1
              });
              level1NodeIds.add(link.pageId);
            }
          } catch (error) {
            console.warn(`Could not fetch page ${link.pageId}:`, error);
          }
        }
      }

      // Get level 2 nodes (2 hops away) - sample from level 1 connections
      const level2Nodes: GraphNode[] = [];
      const level2NodeIds = new Set<string>();
      
      // Limit level 2 exploration to avoid too many nodes
      const level1Sample = level1Nodes.slice(0, 5);
      
      for (const level1Node of level1Sample) {
        try {
          const level1Backlinks = await getBacklinks(level1Node.id, 3);
          level1Backlinks.forEach(backlink => {
            if (!level1NodeIds.has(backlink.id) && 
                !level2NodeIds.has(backlink.id) && 
                backlink.id !== pageId) {
              level2Nodes.push({
                id: backlink.id,
                title: backlink.title,
                username: backlink.username,
                isCenter: false,
                level: 2
              });
              level2NodeIds.add(backlink.id);
            }
          });
        } catch (error) {
          console.warn(`Could not fetch level 2 connections for ${level1Node.id}:`, error);
        }
      }

      // Combine all nodes
      const allNodes = [centerNode, ...level1Nodes, ...level2Nodes.slice(0, 10)];

      // Create links
      const allLinks: GraphLink[] = [];

      // Links from backlinks (incoming to center)
      backlinks.forEach(backlink => {
        allLinks.push({
          source: backlink.id,
          target: pageId,
          type: 'incoming'
        });
      });

      // Links from outgoing (center to outgoing)
      outgoingLinks.forEach(link => {
        if (level1NodeIds.has(link.pageId)) {
          allLinks.push({
            source: pageId,
            target: link.pageId,
            type: 'outgoing'
          });
        }
      });

      // Links between level 1 and level 2
      for (const level2Node of level2Nodes.slice(0, 10)) {
        // Find which level 1 node this connects to
        for (const level1Node of level1Sample) {
          try {
            const level1Backlinks = await getBacklinks(level1Node.id, 3);
            if (level1Backlinks.some(bl => bl.id === level2Node.id)) {
              allLinks.push({
                source: level2Node.id,
                target: level1Node.id,
                type: 'incoming'
              });
              break; // Only connect to one level 1 node to avoid clutter
            }
          } catch (error) {
            // Skip this connection
          }
        }
      }

      setNodes(allNodes);
      setLinks(allLinks);
    } catch (error) {
      console.error('Error fetching graph data:', error);
    } finally {
      setLoading(false);
    }
  }, [pageId, pageTitle]);

  // Initialize graph
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // D3 visualization
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0 || loading) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!container) return;

    // Clear previous content
    svg.selectAll("*").remove();

    // Set up dimensions
    const width = container.clientWidth;
    const height = isFullscreen ? window.innerHeight - 100 : 400;
    
    svg.attr("width", width).attr("height", height);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Create main group for zooming
    const g = svg.append("g");

    // Create force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => {
          const source = d.source as GraphNode;
          const target = d.target as GraphNode;
          if (source.level === 0 || target.level === 0) return 100; // Center connections
          return 80; // Other connections
        }))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Create links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => d.type === 'outgoing' ? 2 : 1);

    // Create nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Add circles to nodes
    node.append("circle")
      .attr("r", d => d.isCenter ? 12 : (d.level === 1 ? 8 : 6))
      .attr("fill", d => {
        if (d.isCenter) return "hsl(var(--primary))";
        if (d.level === 1) return "hsl(var(--primary) / 0.7)";
        return "hsl(var(--primary) / 0.4)";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add labels
    node.append("text")
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + "..." : d.title)
      .attr("x", 0)
      .attr("y", d => d.isCenter ? -18 : (d.level === 1 ? -14 : -12))
      .attr("text-anchor", "middle")
      .attr("font-size", d => d.isCenter ? "12px" : (d.level === 1 ? "10px" : "8px"))
      .attr("font-weight", d => d.isCenter ? "bold" : "normal")
      .attr("fill", "hsl(var(--foreground))")
      .style("pointer-events", "none");

    // Add click handler
    node.on("click", (event, d) => {
      if (d.id !== pageId) {
        router.push(`/${d.id}`);
      }
    });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, loading, isFullscreen, pageId, router]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading page connections...</span>
        </div>
      </div>
    );
  }

  if (nodes.length <= 1) {
    return (
      <div className={`flex items-center justify-center h-64 text-muted-foreground ${className}`}>
        <p>No page connections found</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Page Connections</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Graph container */}
      <div 
        ref={containerRef}
        className={`border border-border rounded-lg bg-background ${
          isFullscreen ? 'fixed inset-4 z-50 p-4' : 'h-96'
        }`}
      >
        <svg ref={svgRef} className="w-full h-full" />
        
        {/* Legend */}
        <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span>Current page</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/70"></div>
              <span>Direct connections</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
              <span>2 hops away</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs text-muted-foreground">
          <div>Click nodes to navigate • Drag to move • Scroll to zoom</div>
        </div>
      </div>
    </div>
  );
}
