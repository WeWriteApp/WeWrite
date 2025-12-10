"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { useTheme } from '../../providers/ThemeProvider';
import { oklchToHex } from '../../lib/oklch-utils';

// Types for 3D graph
interface UserGraph3DNode {
  id: string;
  title: string;
  username?: string;
  isOrphan?: boolean; // True if node has no connections
  // 3D force graph will add x, y, z
  x?: number;
  y?: number;
  z?: number;
}

interface UserGraph3DLink {
  source: string | UserGraph3DNode;
  target: string | UserGraph3DNode;
  type: 'outgoing' | 'incoming' | 'bidirectional';
}

interface UserGraph3DProps {
  nodes: UserGraph3DNode[];
  links: UserGraph3DLink[];
  isFullscreen: boolean;
  height?: number;
}

// Helper to add opacity to hex color
function withOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function UserGraph3D({
  nodes,
  links,
  isFullscreen,
  height = 500,
}: UserGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const router = useRouter();
  const { getCurrentThemeColor } = useAccentColor();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  // Compute accent hex color from OKLCH
  const accentHex = useMemo(() => {
    const themeColor = getCurrentThemeColor();
    const hex = oklchToHex(themeColor);
    return hex || '#2563EB';
  }, [getCurrentThemeColor]);

  // Initialize 3D force graph
  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    // Dynamic import for client-side only
    const initGraph = async () => {
      // Dynamically import 3d-force-graph
      // @ts-ignore - 3d-force-graph types are complex
      const ForceGraph3DModule = await import('3d-force-graph');
      const ForceGraph3D = ForceGraph3DModule.default as any;

      // Import Three.js for bloom effect
      const THREE = await import('three');
      const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
      const { CSS2DRenderer, CSS2DObject } = await import('three/examples/jsm/renderers/CSS2DRenderer.js');

      // Define bloom layer (layer 1 for bloom, layer 0 is default)
      const BLOOM_LAYER = 1;

      // Clear previous graph
      if (graphRef.current) {
        graphRef.current._destructor?.();
        containerRef.current!.innerHTML = '';
      }

      const container = containerRef.current!;
      const width = container.clientWidth;
      const graphHeight = isFullscreen ? window.innerHeight - 100 : height;

      // Theme colors
      const bgColor = isDarkMode ? '#000000' : '#ffffff';
      const fgColor = isDarkMode ? '#f9fafb' : '#111827';
      const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';

      // Create graph data - orphan nodes get neutral color
      const graphData = {
        nodes: nodes.map(node => ({
          ...node,
          color: node.isOrphan ? mutedColor : accentHex,
          size: node.isOrphan ? 10 : 12,
        })),
        links: links.map(link => ({
          ...link,
          color: link.type === 'bidirectional'
            ? withOpacity(accentHex, 0.9)
            : link.type === 'outgoing'
              ? accentHex
              : withOpacity(mutedColor, 0.6),
        })),
      };

      // Initialize 3D force graph with CSS2D renderer for labels
      const Graph = ForceGraph3D({
        extraRenderers: [new CSS2DRenderer()]
      })(container)
        .width(width)
        .height(graphHeight)
        .backgroundColor(bgColor)
        .graphData(graphData)
        // Custom node with sphere only (labels are CSS2D)
        .nodeThreeObject((node: any) => {
          const isOrphan = node.isOrphan;
          const sphereSize = isOrphan ? 6 : 10;
          const nodeOpacity = isOrphan ? 0.5 : 0.9;

          // Create sphere
          const sphereGeometry = new THREE.SphereGeometry(sphereSize, 16, 16);
          const sphereMaterial = new THREE.MeshLambertMaterial({
            color: node.color,
            transparent: true,
            opacity: nodeOpacity,
          });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.layers.enable(BLOOM_LAYER);

          // Create CSS2D label
          const labelDiv = document.createElement('div');
          labelDiv.className = 'graph-node-label';
          labelDiv.textContent = node.title.length > 20 ? node.title.substring(0, 17) + '...' : node.title;
          labelDiv.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            font-family: Inter, system-ui, sans-serif;
            color: ${fgColor};
            opacity: ${isOrphan ? 0.5 : 0.9};
            background: ${isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)'};
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
          `;

          const label = new CSS2DObject(labelDiv);
          label.position.set(0, sphereSize + 5, 0);
          label.center.set(0.5, 1); // Center horizontally, anchor at bottom

          // Create group to hold both
          const group = new THREE.Group();
          group.add(sphere);
          group.add(label);

          return group;
        })
        .nodeThreeObjectExtend(false)
        // Link styling
        .linkColor((link: any) => link.color)
        .linkWidth((link: any) => link.type === 'bidirectional' ? 2 : 1)
        .linkOpacity(0.6)
        .linkDirectionalParticles((link: any) => link.type === 'outgoing' ? 2 : 0)
        .linkDirectionalParticleSpeed(0.005)
        .linkDirectionalParticleWidth(2)
        .linkDirectionalParticleColor(() => accentHex)
        // Forces
        .d3AlphaDecay(0.02)
        .d3VelocityDecay(0.3)
        .warmupTicks(50)
        .cooldownTicks(100)
        // Interactions
        .onNodeClick((node: any) => {
          router.push(`/${node.id}`);
        })
        .onNodeHover((node: any) => {
          container.style.cursor = node ? 'pointer' : 'default';
        });

      // Configure forces after graph initialization
      // Reduce charge force for denser clustering
      const chargeForce = Graph.d3Force('charge');
      if (chargeForce) {
        chargeForce.strength(-30); // Less repulsion = denser graph
      }

      // Modify link force for shorter distances
      const linkForce = Graph.d3Force('link');
      if (linkForce) {
        linkForce.distance(40); // Shorter links
      }

      // Add bloom effect in dark mode (selective - only affects objects on BLOOM_LAYER)
      if (isDarkMode) {
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, graphHeight),
          1.5, // strength
          0.4, // radius
          0.85  // threshold - higher threshold means only bright objects bloom
        );
        Graph.postProcessingComposer().addPass(bloomPass);

        // Set camera to see bloom layer
        Graph.camera().layers.enable(BLOOM_LAYER);
      }

      // Set camera position - closer to see nodes better
      Graph.cameraPosition({ x: 0, y: 0, z: 250 });

      // Store reference
      graphRef.current = Graph;
    };

    initGraph();

    // Cleanup
    return () => {
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [nodes, links, isFullscreen, height, accentHex, isDarkMode, router]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        const width = containerRef.current.clientWidth;
        const graphHeight = isFullscreen ? window.innerHeight - 100 : height;
        graphRef.current.width(width).height(graphHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen, height]);

  return (
    <div
      ref={containerRef}
      className="w-full relative"
      style={{ height: isFullscreen ? 'calc(100vh - 100px)' : height }}
    />
  );
}

// Export types
export type { UserGraph3DNode, UserGraph3DLink };
