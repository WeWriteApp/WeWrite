"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { usePillStyle } from '../../contexts/PillStyleContext';
// import { useGraphSettings } from '../../contexts/GraphSettingsContext';
import { Loader2, Maximize2, X, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { graphDataCache } from '../../utils/graphDataCache';
import GraphSettingsPanel from '../pages/GraphSettingsPanel';
import { createPortal } from 'react-dom';
import SubscriptionGate from '../subscription/SubscriptionGate';

interface UserPage {
  id: string;
  title: string;
  username?: string;
}

interface GraphNode {
  id: string;
  title: string;
  username?: string;
  isCenter: boolean;
  level: number;
  nodeType: 'page';
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

interface UserGraphTabProps {
  userId: string;
  username: string;
  isOwnContent?: boolean;
}

/**
 * UserGraphTab Component
 * 
 * Shows a full graph of all interconnected pages for a specific user.
 * Does not include related pages - only shows actual link connections.
 * All pages are treated equally (no center node concept).
 */
export default function UserGraphTab({ userId, username, isOwnContent = false }: UserGraphTabProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { getPillStyleClasses } = usePillStyle();

  // Ensure we're mounted on the client side for portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);
  // const { settings, openDrawer } = useGraphSettings();
  const [settings, setSettings] = useState({
    chargeStrength: -150,    // Further reduced repulsion for tighter clustering
    linkDistance: 60,        // Even shorter links to keep nodes compact
    centerStrength: 0.8,     // Strong center force to pull nodes toward middle
    collisionRadius: 20,     // Smaller collision radius for tighter layout
    alphaDecay: 0.0228,
    velocityDecay: 0.5       // Higher damping for more stable positioning
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
        .force("charge", d3.forceManyBody().strength(settings.chargeStrength))
        .force("center", d3.forceCenter().strength(settings.centerStrength))
        .force("collision", d3.forceCollide().radius(settings.collisionRadius))
        .alphaDecay(settings.alphaDecay)
        .velocityDecay(settings.velocityDecay);

      // Update link distance
      const linkForce = simulation.force("link") as d3.ForceLink<GraphNode, GraphLink>;
      if (linkForce) {
        linkForce.distance(settings.linkDistance);
      }

      // Restart simulation with new settings
      simulation.alpha(0.3).restart();
    }
  };

  const handleResetSettings = () => {
    const defaultSettings = {
      chargeStrength: -150,    // Further reduced repulsion for tighter clustering
      linkDistance: 60,        // Even shorter links to keep nodes compact
      centerStrength: 0.8,     // Strong center force to pull nodes toward middle
      collisionRadius: 20,     // Smaller collision radius for tighter layout
      alphaDecay: 0.0228,
      velocityDecay: 0.5       // Higher damping for more stable positioning
    };
    handleSettingsChange(defaultSettings);
  };

  // Fetch user's pages and their connections (optimized with caching)
  useEffect(() => {
    if (!userId) return;

    const fetchUserGraph = async () => {
      try {
        setLoading(true);

        console.log('🔗 [USER_GRAPH] Fetching graph for user:', userId);

        // Get user's pages from cache
        const userPagesData = await graphDataCache.getUserPages(userId, 100);
        const userPages = userPagesData.pages || [];

        console.log('🔗 [USER_GRAPH] Found user pages:', userPages.length);

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

        // Create nodes for all user pages
        const graphNodes: GraphNode[] = userPages.map(page => ({
          id: page.id,
          title: page.title || 'Untitled',
          username: page.username,
          isCenter: false,
          level: 1,
          nodeType: 'page'
        }));

        // Remove duplicate links
        const uniqueLinks = allLinks.filter((link, index, self) => 
          index === self.findIndex(l => 
            (l.source === link.source && l.target === link.target) ||
            (l.source === link.target && l.target === link.source)
          )
        );

        console.log('🔗 [USER_GRAPH] Created graph:', {
          nodes: graphNodes.length,
          links: uniqueLinks.length
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
    const height = isFullscreen ? window.innerHeight : 500;
    
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
      // Allow pointer events for node clicks and background clicks in collapsed mode
      svg.style("pointer-events", "auto");

      // Add background click handler to open fullscreen when clicking non-node areas
      svg.on("click", (event) => {
        // Only trigger if clicking on the SVG background (not on nodes)
        if (event.target === svg.node()) {
          setIsFullscreen(true);
        }
      });
    }

    // Only enable zoom/pan in fullscreen mode
    if (isFullscreen) {
      svg.call(zoom);
    } else {
      // Disable zoom/pan in collapsed mode
      svg.on('.zoom', null);
    }

    // Create main group
    const g = svg.append("g");

    // Initialize node positions for better distribution
    nodes.forEach((node, i) => {
      if (node.x === undefined || node.y === undefined) {
        // Start nodes closer to center with smaller initial radius
        const angle = (i / nodes.length) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.15; // Much smaller initial radius
        node.x = width / 2 + Math.cos(angle) * radius;
        node.y = height / 2 + Math.sin(angle) * radius;
      }
    });

    // Create force simulation with settings
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(settings.linkDistance))
      .force("charge", d3.forceManyBody().strength(settings.chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(settings.centerStrength))
      .force("collision", d3.forceCollide().radius(settings.collisionRadius))
      .force("boundary", () => {
        // Keep nodes within container bounds with stronger constraints
        const padding = 40;
        nodes.forEach(node => {
          if (node.x !== undefined && node.y !== undefined) {
            // Apply stronger boundary forces to keep nodes in view
            if (node.x < padding) {
              node.vx = (node.vx || 0) + (padding - node.x) * 0.3;
            } else if (node.x > width - padding) {
              node.vx = (node.vx || 0) + (width - padding - node.x) * 0.3;
            }

            if (node.y < padding) {
              node.vy = (node.vy || 0) + (padding - node.y) * 0.3;
            } else if (node.y > height - padding) {
              node.vy = (node.vy || 0) + (height - padding - node.y) * 0.3;
            }
          }
        });
      })
      .alphaDecay(settings.alphaDecay)
      .velocityDecay(settings.velocityDecay);

    // Store simulation reference for settings updates
    simulationRef.current = simulation;

    // Create links
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
      });

    // Create nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .style("cursor", "pointer");

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
      .attr("r", 8)
      .attr("fill", "hsl(var(--primary) / 0.7)")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add labels
    node.append("text")
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + "..." : d.title)
      .attr("x", 0)
      .attr("y", -14)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "normal")
      .attr("fill", "hsl(var(--foreground))")
      .style("pointer-events", "none");

    // Add click handler for nodes in both fullscreen and collapsed modes
    node.on("click", (event, d) => {
      // Prevent event bubbling to background click handler
      event.stopPropagation();
      router.push(`/${d.id}`);
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

    // Auto-fit viewport when simulation settles (only for non-fullscreen)
    if (!isFullscreen) {
      simulation.on("end", () => {
        // Calculate bounding box of all nodes
        const nodePositions = nodes.filter(n => n.x !== undefined && n.y !== undefined);
        if (nodePositions.length === 0) return;

        const padding = 60;
        const minX = Math.min(...nodePositions.map(n => n.x!)) - padding;
        const maxX = Math.max(...nodePositions.map(n => n.x!)) + padding;
        const minY = Math.min(...nodePositions.map(n => n.y!)) - padding;
        const maxY = Math.max(...nodePositions.map(n => n.y!)) + padding;

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        // Calculate scale to fit content in viewport
        const scaleX = width / contentWidth;
        const scaleY = height / contentHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

        // Calculate translation to center the content
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const translateX = width / 2 - centerX * scale;
        const translateY = height / 2 - centerY * scale;

        // Apply transform smoothly
        g.transition()
          .duration(1000)
          .attr("transform", `translate(${translateX},${translateY}) scale(${scale})`);
      });
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, loading, isFullscreen, router, settings]);

  // Update simulation when settings change
  useEffect(() => {
    if (!simulationRef.current) return;

    const simulation = simulationRef.current;

    // Update forces with new settings
    simulation
      .force("charge", d3.forceManyBody().strength(settings.chargeStrength))
      .force("center", d3.forceCenter().strength(settings.centerStrength))
      .force("collision", d3.forceCollide().radius(settings.collisionRadius))
      .alphaDecay(settings.alphaDecay)
      .velocityDecay(settings.velocityDecay);

    // Update link distance
    const linkForce = simulation.force("link") as d3.ForceLink<GraphNode, GraphLink>;
    if (linkForce) {
      linkForce.distance(settings.linkDistance);
    }

    // Restart simulation with new settings
    simulation.alpha(0.3).restart();
  }, [settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading {username}'s page connections...</span>
        </div>
      </div>
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Page Connections Graph</h3>
          <p className="text-xs text-muted-foreground">
            {nodes.length} pages with {links.length} connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isViewSettingsOpen ? "default" : "outline"}
            size="sm"
            onClick={() => {
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
            onClick={() => {
              setIsViewSettingsOpen(false);
              setIsFullscreen(true);
            }}
            className="transition-all duration-200 hover:scale-105"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Graph container */}
      <SubscriptionGate featureName="graph" className="relative" isOwnContent={isOwnContent} allowInteraction={true}>
        <div
          ref={containerRef}
          className="bg-background border border-border rounded-lg h-[500px] transition-all duration-300"
        >
          <svg ref={svgRef} className="w-full h-full" />
        </div>
      </SubscriptionGate>

      {/* Fullscreen modal - rendered via portal to escape container constraints */}
      {mounted && isFullscreen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background animate-in fade-in-0 duration-300">
          {/* Header with controls */}
          <div className="absolute top-0 left-0 right-0 z-[10000] bg-background border-b border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Page Connections Graph</h3>
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
          <SubscriptionGate
            featureName="graph"
            className={`bg-background ${isViewSettingsOpen ? 'h-1/2 mt-16' : 'h-full pt-16'} transition-all duration-300`}
            isOwnContent={isOwnContent}
            allowInteraction={true}
          >
            <div className="w-full h-full">
              <svg ref={svgRef} className="w-full h-full" />
            </div>
          </SubscriptionGate>

          {/* Settings panel (bottom half when open) */}
          {isViewSettingsOpen && (
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-background border-t border-border overflow-y-auto">
              <GraphSettingsPanel
                settings={settings}
                onSettingsChange={handleSettingsChange}
                onReset={handleResetSettings}
              />
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
