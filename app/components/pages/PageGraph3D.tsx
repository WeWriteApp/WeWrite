"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { useTheme } from '../../providers/ThemeProvider';
import { oklchToHex } from '../../lib/oklch-utils';

// Types for 3D graph
interface Graph3DNode {
  id: string;
  title: string;
  username?: string;
  isCenter: boolean;
  level: number;
  nodeType: 'center' | 'connected' | 'related';
  // 3D force graph will add x, y, z
  x?: number;
  y?: number;
  z?: number;
}

interface Graph3DLink {
  source: string | Graph3DNode;
  target: string | Graph3DNode;
  type: 'outgoing' | 'incoming' | 'bidirectional';
  sentiment?: 'agree' | 'disagree';
}

interface PageGraph3DProps {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  pageId: string;
  isFullscreen: boolean;
  height?: number;
  /** When true, graph auto-rotates and is non-interactive (preview mode) */
  isPreview?: boolean;
}

// Helper to add opacity to hex color
function withOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function PageGraph3D({
  nodes,
  links,
  pageId,
  isFullscreen,
  height = 400,
  isPreview = false,
}: PageGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const router = useRouter();
  const { getCurrentThemeColor } = useAccentColor();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  // In preview mode (non-fullscreen), disable interactions
  const isInteractive = isFullscreen || !isPreview;

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

      // Theme colors - use transparent background so card styles show through
      const bgColor = 'rgba(0,0,0,0)';
      const fgColor = isDarkMode ? '#f9fafb' : '#111827';
      const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';

      // Create graph data
      const graphData = {
        nodes: nodes.map(node => ({
          ...node,
          color: getNodeColor(node, accentHex, mutedColor, isDarkMode),
          size: getNodeSize(node),
        })),
        links: links.map(link => ({
          ...link,
          color: getLinkColor(link, accentHex, mutedColor, isDarkMode),
        })),
      };

      // Initialize 3D force graph with CSS2D renderer for labels
      // Enable alpha for transparent background
      const Graph = ForceGraph3D({
        extraRenderers: [new CSS2DRenderer()],
        rendererConfig: { alpha: true, antialias: true }
      })(container)
        .width(width)
        .height(graphHeight)
        .backgroundColor(bgColor)
        .graphData(graphData)
        // Custom node with sphere + CSS2D label
        .nodeThreeObject((node: any) => {
          // Determine opacity based on level (center is brightest, farther = fainter)
          const levelOpacities = [1, 0.85, 0.65, 0.5, 0.35]; // level 0, 1, 2, 3, 4+
          const nodeOpacity = node.nodeType === 'related' ? 0.3 : (levelOpacities[node.level] || 0.35);

          // Create sphere with size based on level
          const baseSphereSize = node.isCenter ? 12 : (node.level === 1 ? 10 : (node.level === 2 ? 8 : 6));
          const sphereGeometry = new THREE.SphereGeometry(baseSphereSize, 16, 16);
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
          const truncatedTitle = node.title.length > 20 ? node.title.substring(0, 17) + '...' : node.title;
          labelDiv.textContent = truncatedTitle;

          // Font size based on node level
          const fontSize = node.isCenter ? 14 : (node.level === 1 ? 12 : 11);
          labelDiv.style.cssText = `
            font-size: ${fontSize}px;
            font-weight: ${node.isCenter ? 700 : 600};
            font-family: Inter, system-ui, sans-serif;
            color: ${fgColor};
            opacity: ${nodeOpacity};
            background: ${isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)'};
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
          `;

          const label = new CSS2DObject(labelDiv);
          label.position.set(0, baseSphereSize + 5, 0);
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
        // Interactions - only enable in interactive mode
        .enableNodeDrag(isInteractive)
        .enableNavigationControls(isInteractive)
        .enablePointerInteraction(isInteractive)
        .onNodeClick((node: any) => {
          if (isInteractive && node.id !== pageId) {
            router.push(`/${node.id}`);
          }
        })
        .onNodeHover((node: any) => {
          container.style.cursor = isInteractive && node ? 'pointer' : 'default';
        });

      // Configure forces after graph initialization
      const chargeForce = Graph.d3Force('charge');
      if (chargeForce) {
        chargeForce.strength(-50); // Less repulsion for denser graph
      }

      const linkForce = Graph.d3Force('link');
      if (linkForce) {
        linkForce.distance(40);
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

      // Set camera position
      Graph.cameraPosition({ x: 0, y: 0, z: 200 });

      // Store reference
      graphRef.current = Graph;

      // Force transparent backgrounds on all library-created elements
      // The library may inject inline styles, so we override them directly
      const forceTransparentBg = () => {
        if (container) {
          const children = container.querySelectorAll('*');
          children.forEach(child => {
            if (child instanceof HTMLElement && child.tagName !== 'CANVAS') {
              child.style.background = 'transparent';
              child.style.backgroundColor = 'transparent';
            }
          });
        }
      };
      forceTransparentBg();
      // Also run after a small delay to catch any async elements
      setTimeout(forceTransparentBg, 100);

      // Focus on center node after a delay
      setTimeout(() => {
        const centerNode = nodes.find(n => n.isCenter);
        if (centerNode && graphRef.current) {
          const node = graphRef.current.graphData().nodes.find((n: any) => n.id === centerNode.id);
          if (node) {
            graphRef.current.cameraPosition(
              { x: node.x || 0, y: node.y || 0, z: 150 },
              node,
              1000
            );
          }
        }

        // Start auto-rotation in preview mode (non-interactive)
        if (!isInteractive && graphRef.current) {
          let angle = 0;
          const distance = 200;
          const rotationSpeed = 0.002; // Slow rotation

          const rotate = () => {
            if (!graphRef.current) return;

            angle += rotationSpeed;
            const x = distance * Math.sin(angle);
            const z = distance * Math.cos(angle);

            graphRef.current.cameraPosition({
              x,
              y: 50, // Slight overhead view
              z
            });

            animationFrameRef.current = requestAnimationFrame(rotate);
          };

          rotate();
        }
      }, 500);
    };

    initGraph();

    // Cleanup
    return () => {
      // Cancel auto-rotation animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [nodes, links, pageId, isFullscreen, height, accentHex, isDarkMode, router, isInteractive]);

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
      className="w-full relative [&>div]:!bg-transparent [&>canvas]:!bg-transparent"
      style={{ height: isFullscreen ? 'calc(100vh - 100px)' : height }}
    />
  );
}

// Helper functions for node/link styling
function getNodeColor(
  node: Graph3DNode,
  accentHex: string,
  mutedColor: string,
  isDarkMode: boolean
): string {
  if (node.isCenter) return accentHex;
  if (node.nodeType === 'connected') {
    const opacities = [1, 0.8, 0.6, 0.4];
    const opacity = opacities[node.level] || 0.4;
    return withOpacity(accentHex, opacity);
  }
  if (node.nodeType === 'related') {
    return withOpacity(mutedColor, 0.4);
  }
  return withOpacity(accentHex, 0.4);
}

function getNodeSize(node: Graph3DNode): number {
  if (node.isCenter) return 20;
  if (node.nodeType === 'connected') {
    const sizes = [20, 12, 8, 6];
    return sizes[node.level] || 6;
  }
  if (node.nodeType === 'related') return 4;
  return 6;
}

function getLinkColor(
  link: Graph3DLink,
  accentHex: string,
  mutedColor: string,
  isDarkMode: boolean
): string {
  if (link.sentiment === 'agree') return '#22c55e';
  if (link.sentiment === 'disagree') return '#ef4444';
  if (link.type === 'bidirectional') return withOpacity(accentHex, 0.9);
  if (link.type === 'outgoing') return accentHex;
  return withOpacity(mutedColor, 0.6);
}

// Export types
export type { Graph3DNode, Graph3DLink };
