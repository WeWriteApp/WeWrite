"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { usePillStyle } from '../../contexts/PillStyleContext';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { usePageConnectionsGraph, getLinkDirection } from '../../hooks/usePageConnections';

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
  type: 'outgoing' | 'incoming' | 'bidirectional';
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const router = useRouter();
  const { getPillStyleClasses } = usePillStyle();

  // Use consolidated page connections hook
  const {
    incoming,
    outgoing,
    bidirectional,
    allConnections,
    secondHopConnections,
    graphLoading: loading,
    refresh
  } = usePageConnectionsGraph(pageId, pageTitle);

  // Build graph data from consolidated connections
  const buildGraphData = useCallback(() => {
    if (loading || !allConnections.length) return;

    console.log('🎯 PageGraphView: Building graph with consolidated data:', {
      incoming: incoming.length,
      outgoing: outgoing.length,
      bidirectional: bidirectional.length,
      secondHop: secondHopConnections.length
    });

    // Create center node
    const centerNode: GraphNode = {
      id: pageId,
      title: pageTitle || 'Current Page',
      isCenter: true,
      level: 0
    };

    // Create level 1 nodes (direct connections)
    const level1Nodes: GraphNode[] = allConnections.map(connection => ({
      id: connection.id,
      title: connection.title,
      username: connection.username,
      isCenter: false,
      level: 1
    }));

    // Create level 2 nodes (2-hop connections)
    const level2Nodes: GraphNode[] = secondHopConnections.map(connection => ({
      id: connection.id,
      title: connection.title,
      username: connection.username,
      isCenter: false,
      level: 2
    }));

    // Combine all nodes
    const allNodes = [centerNode, ...level1Nodes, ...level2Nodes];

    // Create links with proper directionality
    const allLinks: GraphLink[] = [];

    // Level 1 connections (center to/from direct connections)
    allConnections.forEach(connection => {
      const direction = getLinkDirection(pageId, connection.id, incoming, outgoing);

      if (direction === 'bidirectional') {
        // Create bidirectional link
        allLinks.push({
          source: pageId,
          target: connection.id,
          type: 'bidirectional'
        });
      } else if (direction === 'outgoing') {
        // Center links TO this page
        allLinks.push({
          source: pageId,
          target: connection.id,
          type: 'outgoing'
        });
      } else {
        // This page links TO center
        allLinks.push({
          source: connection.id,
          target: pageId,
          type: 'incoming'
        });
      }
    });

    // Level 2 connections (simplified - just incoming to level 1)
    secondHopConnections.forEach(secondHopConnection => {
      // Find a level 1 connection this might link to
      const level1Target = allConnections.find(conn =>
        // This is a simplified heuristic - in reality we'd need to check actual links
        Math.random() > 0.5 // Random for now, should be based on actual connections
      );

      if (level1Target) {
        allLinks.push({
          source: secondHopConnection.id,
          target: level1Target.id,
          type: 'incoming'
        });
      }
    });

    setNodes(allNodes);
    setLinks(allLinks);
  }, [pageId, pageTitle, loading, allConnections, incoming, outgoing, bidirectional, secondHopConnections]);

  // Build graph when connections data changes
  useEffect(() => {
    buildGraphData();
  }, [buildGraphData]);

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

    // Define arrow markers for different link types
    const defs = svg.append("defs");

    // Outgoing arrow (from center)
    defs.append("marker")
      .attr("id", "arrow-outgoing")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "hsl(var(--primary))");

    // Incoming arrow (to center)
    defs.append("marker")
      .attr("id", "arrow-incoming")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");

    // Bidirectional arrows
    defs.append("marker")
      .attr("id", "arrow-bidirectional")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "hsl(var(--primary) / 0.8)");

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

    // Create links with directional arrows
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", d => {
        if (d.type === 'bidirectional') return "hsl(var(--primary) / 0.8)";
        if (d.type === 'outgoing') return "hsl(var(--primary))";
        return "#999";
      })
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", d => {
        if (d.type === 'bidirectional') return 3;
        if (d.type === 'outgoing') return 2;
        return 1.5;
      })
      .attr("marker-end", d => {
        if (d.type === 'bidirectional') return "url(#arrow-bidirectional)";
        if (d.type === 'outgoing') return "url(#arrow-outgoing)";
        return "url(#arrow-incoming)";
      });

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
      <div className={`mt-8 px-4 sm:px-6 max-w-4xl mx-auto ${className}`}>
        <div className="p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm">
          <h3 className="text-sm font-medium mb-4">Page Connections</h3>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>No page connections found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-8 px-4 sm:px-6 max-w-4xl mx-auto ${className}`}>
      <div className="p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Page Connections</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Graph container */}
        <div className="relative">
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
      </div>
    </div>
  );
}
