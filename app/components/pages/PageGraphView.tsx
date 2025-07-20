"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { usePillStyle } from '../../contexts/PillStyleContext';
// import { useGraphSettings } from '../../contexts/GraphSettingsContext';
import { Loader2, Maximize2, X, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { usePageConnectionsGraph, getLinkDirection } from '../../hooks/usePageConnections';
import { useRelatedPages } from '../../hooks/useRelatedPages';
import { graphDataCache } from '../../utils/graphDataCache';
import GraphSettingsPanel from './GraphSettingsPanel';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';

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
}

interface PageGraphViewProps {
  pageId: string;
  pageTitle: string;
  className?: string;
  onRefreshReady?: (refreshFn: () => void) => void;
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
export default function PageGraphView({ pageId, pageTitle, className = "", onRefreshReady }: PageGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const router = useRouter();
  const { getPillStyleClasses } = usePillStyle();
  const { currentAccount } = useCurrentAccount();
  // const { settings, openDrawer } = useGraphSettings();
  const [settings, setSettings] = useState({
    chargeStrength: -400,
    linkDistance: 120,
    centerStrength: 0.8,
    collisionRadius: 35,
    alphaDecay: 0.02,
    velocityDecay: 0.3
  });
  const openDrawer = () => {};

  // Handle settings changes
  const handleSettingsChange = (newSettings: Partial<typeof settings>) => {
    console.log('Settings change:', newSettings);
    setSettings(prev => ({ ...prev, ...newSettings }));

    // Trigger simulation update
    if (simulationRef.current) {
      const simulation = simulationRef.current;

      // Update forces with new settings
      simulation
        .force("charge", d3.forceManyBody().strength(d => {
          if (d.nodeType === 'related') return settings.chargeStrength * 0.5;
          return settings.chargeStrength;
        }))
        .force("center", d3.forceCenter(containerRef.current?.clientWidth / 2 || 0, (isFullscreen ? window.innerHeight : 400) / 2).strength(settings.centerStrength))
        .force("collision", d3.forceCollide().radius(d => {
          if (d.nodeType === 'related') return settings.collisionRadius * 0.8;
          return settings.collisionRadius;
        }))
        .alphaDecay(settings.alphaDecay)
        .velocityDecay(settings.velocityDecay);

      // Update link distance
      const linkForce = simulation.force("link") as d3.ForceLink<GraphNode, GraphLink>;
      if (linkForce) {
        linkForce.distance(d => {
          const source = d.source as GraphNode;
          const target = d.target as GraphNode;
          if (source.level === 0 || target.level === 0) return settings.linkDistance;
          return settings.linkDistance * 0.8;
        });
      }

      // Restart simulation with new settings
      simulation.alpha(0.3).restart();
    }
  };

  const handleResetSettings = () => {
    const defaultSettings = {
      chargeStrength: -400,
      linkDistance: 120,
      centerStrength: 0.8,
      collisionRadius: 35,
      alphaDecay: 0.02,
      velocityDecay: 0.3
    };
    handleSettingsChange(defaultSettings);
  };

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

  // Use related pages hook - exclude current user's pages
  const { relatedPages, loading: relatedLoading } = useRelatedPages(pageId, pageTitle, undefined, currentAccount?.username);

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefreshReady && refresh) {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);

  // Build graph when connections data changes
  useEffect(() => {
    if (loading || relatedLoading) return;

    console.log('🎯 PageGraphView: Building graph with consolidated data:', {
      pageId,
      pageTitle,
      incoming: incoming.length,
      outgoing: outgoing.length,
      bidirectional: bidirectional.length,
      secondHop: secondHopConnections.length,
      related: relatedPages.length,
      allConnectionIds: allConnections.map(c => c.id)
    });

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

    // Create related pages nodes (floating without connections) - only show others' pages
    const relatedNodes: GraphNode[] = relatedPages
      .filter(page =>
        // Exclude pages that are already in the graph as connections
        page.id !== pageId &&
        !allConnections.some(conn => conn.id === page.id) &&
        !secondHopConnections.some(conn => conn.id === page.id) &&
        // Only show related pages by other people (exclude current user's pages)
        page.username !== currentAccount?.username
      )
      .map(page => ({
        id: page.id,
        title: page.title,
        username: page.username,
        isCenter: false,
        level: 3,
        nodeType: 'related'
      }));

    // Combine all nodes
    const allNodes = [centerNode, ...level1Nodes, ...level2Nodes, ...relatedNodes];

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
  }, [pageId, pageTitle, loading, relatedLoading, allConnections.length, incoming.length, outgoing.length, bidirectional.length, secondHopConnections.length, relatedPages.length]);

  // D3 visualization
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0 || loading || relatedLoading) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!container) return;

    // Clear previous content
    svg.selectAll("*").remove();

    // Set up dimensions
    const width = container.clientWidth;
    const height = isFullscreen ? window.innerHeight : 400;

    console.log('🎯 PageGraphView: Container dimensions:', {
      width,
      height,
      centerX: width / 2,
      centerY: height / 2,
      containerClientWidth: container.clientWidth,
      containerClientHeight: container.clientHeight,
      isFullscreen
    });

    svg.attr("width", width).attr("height", height);

    // Create zoom behavior - only enable in fullscreen mode
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    // Only enable zoom/pan in fullscreen mode
    if (isFullscreen) {
      svg.call(zoom);
    } else {
      // Disable zoom/pan in collapsed mode
      svg.on('.zoom', null);
      // Make graph completely non-interactive when collapsed
      svg.style("pointer-events", "none");
    }

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

    // Initialize node positions for better distribution
    const centerNodes = nodes.filter(n => n.level === 0);
    const connectedNodes = nodes.filter(n => n.level === 1);
    const relatedNodes = nodes.filter(n => n.level === 2);

    nodes.forEach((node, i) => {
      if (node.x === undefined || node.y === undefined) {
        if (node.level === 0) {
          // Center node in the middle
          node.x = width / 2;
          node.y = height / 2;
          console.log('🎯 PageGraphView: Positioning center node at:', { x: node.x, y: node.y, nodeId: node.id });
        } else if (node.level === 1) {
          // Connected nodes in inner circle
          const connectedIndex = connectedNodes.indexOf(node);
          const angle = (connectedIndex / connectedNodes.length) * 2 * Math.PI;
          const radius = Math.min(width, height) * 0.25;
          node.x = width / 2 + Math.cos(angle) * radius;
          node.y = height / 2 + Math.sin(angle) * radius;
        } else {
          // Related nodes in outer circle
          const relatedIndex = relatedNodes.indexOf(node);
          const angle = (relatedIndex / relatedNodes.length) * 2 * Math.PI;
          const radius = Math.min(width, height) * 0.4;
          node.x = width / 2 + Math.cos(angle) * radius;
          node.y = height / 2 + Math.sin(angle) * radius;
        }
      }
    });

    // Create force simulation with settings
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => {
          const source = d.source as GraphNode;
          const target = d.target as GraphNode;
          if (source.level === 0 || target.level === 0) return settings.linkDistance; // Center connections
          return settings.linkDistance * 0.8; // Other connections
        }))
      .force("charge", d3.forceManyBody().strength(d => {
        // Related pages have weaker repulsion so they float more freely
        if (d.nodeType === 'related') return settings.chargeStrength * 0.5;
        return settings.chargeStrength;
      }))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(settings.centerStrength))
      .force("collision", d3.forceCollide().radius(d => {
        // Related pages have smaller collision radius
        if (d.nodeType === 'related') return settings.collisionRadius * 0.8;
        return settings.collisionRadius;
      }))
      .force("boundary", () => {
        // Keep nodes within container bounds with gentle constraints
        const padding = 20;
        nodes.forEach(node => {
          if (node.x !== undefined && node.y !== undefined) {
            // Apply gentle boundary forces instead of hard constraints
            if (node.x < padding) {
              node.vx = (node.vx || 0) + (padding - node.x) * 0.05;
            } else if (node.x > width - padding) {
              node.vx = (node.vx || 0) + (width - padding - node.x) * 0.05;
            }

            if (node.y < padding) {
              node.vy = (node.vy || 0) + (padding - node.y) * 0.05;
            } else if (node.y > height - padding) {
              node.vy = (node.vy || 0) + (height - padding - node.y) * 0.05;
            }
          }
        });
      })
      .alphaDecay(settings.alphaDecay)
      .velocityDecay(settings.velocityDecay);

    // Store simulation reference for settings updates
    simulationRef.current = simulation;

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
      .style("cursor", isFullscreen ? "pointer" : "default");

    // Only enable drag behavior in fullscreen mode
    if (isFullscreen) {
      node.call(d3.drag<SVGGElement, GraphNode>()
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
    }

    // Add circles to nodes
    node.append("circle")
      .attr("r", d => {
        if (d.isCenter) return 12;
        if (d.nodeType === 'connected') return d.level === 1 ? 8 : 6;
        if (d.nodeType === 'related') return 6;
        return 6;
      })
      .attr("fill", d => {
        if (d.isCenter) return "hsl(var(--primary))";
        if (d.nodeType === 'connected') return d.level === 1 ? "hsl(var(--primary) / 0.7)" : "hsl(var(--primary) / 0.4)";
        if (d.nodeType === 'related') return "hsl(var(--muted-foreground) / 0.3)"; // Grey for related pages
        return "hsl(var(--primary) / 0.4)";
      })
      .attr("stroke", d => d.nodeType === 'related' ? "hsl(var(--muted-foreground) / 0.5)" : "#fff")
      .attr("stroke-width", 2);

    // Add labels
    node.append("text")
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + "..." : d.title)
      .attr("x", 0)
      .attr("y", d => {
        if (d.isCenter) return -18;
        if (d.nodeType === 'connected') return d.level === 1 ? -14 : -12;
        if (d.nodeType === 'related') return -12;
        return -12;
      })
      .attr("text-anchor", "middle")
      .attr("font-size", d => {
        if (d.isCenter) return "12px";
        if (d.nodeType === 'connected') return d.level === 1 ? "10px" : "8px";
        if (d.nodeType === 'related') return "8px";
        return "8px";
      })
      .attr("font-weight", d => d.isCenter ? "bold" : "normal")
      .attr("fill", d => d.nodeType === 'related' ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))")
      .style("pointer-events", "none");

    // Add click handler only in fullscreen mode
    if (isFullscreen) {
      node.on("click", (event, d) => {
        if (d.id !== pageId) {
          console.log('🎯 PageGraphView: Navigating to page:', d.id, 'from current page:', pageId);
          router.push(`/${d.id}`);
        }
      });
    }

    // Start simulation with strong centering
    simulation.alpha(0.8).restart();

    // Force immediate centering after a short delay
    setTimeout(() => {
      if (simulation) {
        nodes.forEach(node => {
          if (node.level === 0) {
            // Ensure center node stays centered
            node.fx = width / 2;
            node.fy = height / 2;
          }
        });
        simulation.alpha(0.5).restart();

        // Release fixed positions after centering
        setTimeout(() => {
          nodes.forEach(node => {
            if (node.level === 0) {
              node.fx = null;
              node.fy = null;
            }
          });
        }, 1000);
      }
    }, 100);

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
  }, [nodes, links, loading, isFullscreen, pageId, router, settings]);

  // Update simulation when settings change
  useEffect(() => {
    if (!simulationRef.current) return;

    const simulation = simulationRef.current;

    // Update forces with new settings
    simulation
      .force("charge", d3.forceManyBody().strength(d => {
        if (d.nodeType === 'related') return settings.chargeStrength * 0.5;
        return settings.chargeStrength;
      }))
      .force("center", d3.forceCenter(containerRef.current?.clientWidth / 2 || 0, (isFullscreen ? window.innerHeight : 400) / 2).strength(settings.centerStrength))
      .force("collision", d3.forceCollide().radius(d => {
        if (d.nodeType === 'related') return settings.collisionRadius * 0.8;
        return settings.collisionRadius;
      }))
      .alphaDecay(settings.alphaDecay)
      .velocityDecay(settings.velocityDecay);

    // Update link distance
    const linkForce = simulation.force("link") as d3.ForceLink<GraphNode, GraphLink>;
    if (linkForce) {
      linkForce.distance(d => {
        const source = d.source as GraphNode;
        const target = d.target as GraphNode;
        if (source.level === 0 || target.level === 0) return settings.linkDistance;
        return settings.linkDistance * 0.8;
      });
    }

    // Restart simulation with new settings
    simulation.alpha(0.3).restart();
  }, [settings]);

  if (loading || relatedLoading) {
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
      <div className={`mt-8 ${className}`}>
        <div className="p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm">
          <h3 className="text-sm font-medium mb-4">Graph view</h3>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>No page connections found</p>
          </div>
        </div>
      </div>
    );
  }

  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-[9999] bg-background animate-in fade-in-0 duration-300"
        style={{
          touchAction: 'manipulation',
          pointerEvents: 'auto'
        }}
      >
        {/* Header with controls */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-background border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Graph view</h3>
            <div className="flex items-center gap-2">
              <Button
                variant={isViewSettingsOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setIsViewSettingsOpen(!isViewSettingsOpen)}
                className="transition-all duration-200"
              >
                {isViewSettingsOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsFullscreen(false);
                  setIsViewSettingsOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Graph container */}
        <div
          ref={containerRef}
          className={`bg-background ${isViewSettingsOpen ? 'h-1/2 mt-16' : 'h-full pt-16'} transition-all duration-300`}
        >
          <svg ref={svgRef} className="w-full h-full" />
        </div>

        {/* Settings panel (bottom half when open) */}
        {isViewSettingsOpen && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2 bg-background border-t border-border overflow-y-auto"
            style={{
              touchAction: 'manipulation',
              pointerEvents: 'auto'
            }}
          >
            <GraphSettingsPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onReset={handleResetSettings}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`mt-8 ${className} animate-in fade-in-0 duration-300`}>
      <div
        className="p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm cursor-pointer hover:shadow-md transition-all duration-200"
        onClick={() => setIsFullscreen(true)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Graph view</h3>
          <div className="flex items-center gap-2">
            <Button
              variant={isViewSettingsOpen ? "default" : "outline"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsViewSettingsOpen(true);
                setIsFullscreen(true);
              }}
              className="transition-all duration-200 hover:scale-105"
            >
              {isViewSettingsOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsViewSettingsOpen(false);
                setIsFullscreen(true);
              }}
              className="transition-all duration-200 hover:scale-105"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span>Current page</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary/70"></div>
            <span>Connected pages</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30 border border-muted-foreground/50"></div>
            <span>Related pages by others</span>
          </div>
        </div>

        {/* Graph container */}
        <div className="relative">
          <div
            ref={containerRef}
            className="bg-background h-96 transition-all duration-300"
          >
            <svg ref={svgRef} className="w-full h-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
