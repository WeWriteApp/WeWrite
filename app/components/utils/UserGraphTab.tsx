"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { usePillStyle } from '../../contexts/PillStyleContext';
import { Loader2, Maximize2, X } from 'lucide-react';
import { Button } from '../ui/button';

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
}

/**
 * UserGraphTab Component
 * 
 * Shows a full graph of all interconnected pages for a specific user.
 * Does not include related pages - only shows actual link connections.
 * All pages are treated equally (no center node concept).
 */
export default function UserGraphTab({ userId, username }: UserGraphTabProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const router = useRouter();
  const { getPillStyleClasses } = usePillStyle();

  // Fetch user's pages and their connections
  useEffect(() => {
    if (!userId) return;

    const fetchUserGraph = async () => {
      try {
        setLoading(true);
        
        console.log('🔗 [USER_GRAPH] Fetching graph for user:', userId);

        // First, get all user's pages
        const pagesResponse = await fetch(`/api/my-pages?userId=${userId}&limit=100&sortBy=lastModified`);
        
        if (!pagesResponse.ok) {
          throw new Error(`Failed to fetch pages: ${pagesResponse.status}`);
        }

        const pagesData = await pagesResponse.json();
        const userPages = pagesData.pages || [];
        
        console.log('🔗 [USER_GRAPH] Found user pages:', userPages.length);

        if (userPages.length === 0) {
          setNodes([]);
          setLinks([]);
          setLoading(false);
          return;
        }

        // Get connections for all pages
        const allConnections = new Map();
        const allLinks: GraphLink[] = [];
        
        for (const page of userPages) {
          try {
            const connectionsResponse = await fetch(`/api/page-connections?pageId=${page.id}&includeSecondHop=false&limit=50`);
            
            if (connectionsResponse.ok) {
              const connectionsData = await connectionsResponse.json();
              
              // Store connections for this page
              allConnections.set(page.id, {
                incoming: connectionsData.incoming || [],
                outgoing: connectionsData.outgoing || []
              });

              // Create links for connections between user's pages
              const incoming = connectionsData.incoming || [];
              const outgoing = connectionsData.outgoing || [];

              // Add outgoing links (this page links TO other user pages)
              outgoing.forEach((targetPage: UserPage) => {
                if (userPages.some(p => p.id === targetPage.id)) {
                  // Check if bidirectional
                  const targetConnections = allConnections.get(targetPage.id);
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
                  // Only add if not already added as outgoing
                  const existingLink = allLinks.find(link => 
                    (link.source === sourcePage.id && link.target === page.id) ||
                    (link.source === page.id && link.target === sourcePage.id)
                  );
                  
                  if (!existingLink) {
                    allLinks.push({
                      source: sourcePage.id,
                      target: page.id,
                      type: 'incoming'
                    });
                  }
                }
              });
            }
          } catch (error) {
            console.error('Error fetching connections for page:', page.id, error);
          }
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

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Create main group
    const g = svg.append("g");

    // Create force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(35));

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

    // Add click handler
    node.on("click", (event, d) => {
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

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, loading, isFullscreen, router]);

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsFullscreen(true)}
          className="transition-all duration-200 hover:scale-105"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Graph container */}
      <div className="relative">
        <div
          ref={containerRef}
          className="bg-background border border-border rounded-lg h-[500px] transition-all duration-300"
        >
          <svg ref={svgRef} className="w-full h-full" />
        </div>
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-full h-full">
            <svg ref={svgRef} className="w-full h-full" />
          </div>
        </div>
      )}
    </div>
  );
}
