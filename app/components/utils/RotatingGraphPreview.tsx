"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { useTheme } from '../../providers/ThemeProvider';
import { oklchToHex } from '../../lib/oklch-utils';

/**
 * Graph node structure for the rotating preview
 */
export interface GraphPreviewNode {
  id: string;
  title: string;
  isOrphan?: boolean;
}

/**
 * Graph link structure for the rotating preview
 */
export interface GraphPreviewLink {
  source: string;
  target: string;
  type: 'outgoing' | 'incoming' | 'bidirectional';
}

interface RotatingGraphPreviewProps {
  nodes: GraphPreviewNode[];
  links: GraphPreviewLink[];
  height?: number;
  /**
   * Rotation speed in radians per frame. Default is 0.002.
   * Can be adjusted globally via user preferences in the future.
   */
  rotationSpeed?: number;
  /**
   * Whether to show labels on nodes
   */
  showLabels?: boolean;
  /**
   * CSS class name for the container
   */
  className?: string;
}

// Helper to add opacity to hex color
function withOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * RotatingGraphPreview Component
 *
 * A reusable, non-interactive 3D graph preview that auto-rotates.
 * Used for displaying page graphs in cards, previews, and other compact views.
 *
 * Features:
 * - Non-interactive (no clicks, hovers, or pointer events)
 * - Auto-rotation at configurable speed
 * - Transparent background to blend with container
 * - Matches the visual style of UserGraph3D and PageGraph3D
 */
export default function RotatingGraphPreview({
  nodes,
  links,
  height = 200,
  rotationSpeed = 0.002,
  showLabels = false,
  className = "",
}: RotatingGraphPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
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

    const initGraph = async () => {
      // Dynamic imports for client-side only
      // @ts-ignore
      const ForceGraph3DModule = await import('3d-force-graph');
      const ForceGraph3D = ForceGraph3DModule.default as any;
      const THREE = await import('three');

      // Clear previous graph
      if (graphRef.current) {
        graphRef.current._destructor?.();
        containerRef.current!.innerHTML = '';
      }

      const container = containerRef.current!;
      const width = container.clientWidth;

      // Theme colors
      const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';

      // Create graph data
      const graphData = {
        nodes: nodes.map(node => ({
          ...node,
          color: node.isOrphan ? mutedColor : accentHex,
          size: node.isOrphan ? 6 : 8,
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

      // Pre-create shared geometries
      const normalSphereGeometry = new THREE.SphereGeometry(8, 10, 10);
      const orphanSphereGeometry = new THREE.SphereGeometry(5, 8, 8);

      // Helper to create text sprite for labels
      const createTextSprite = (text: string, color: string) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return null;

        // Truncate long titles
        const displayText = text.length > 20 ? text.slice(0, 18) + '...' : text;

        canvas.width = 256;
        canvas.height = 64;

        context.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(displayText, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(40, 10, 1);

        return sprite;
      };

      // Initialize graph with transparent background
      const Graph = ForceGraph3D({
        rendererConfig: { alpha: true, antialias: true }
      })(container)
        .width(width)
        .height(height)
        .backgroundColor('rgba(0,0,0,0)')
        .graphData(graphData)
        // Nodes with optional labels
        .nodeThreeObject((node: any) => {
          const isOrphan = node.isOrphan;
          const sphereGeometry = isOrphan ? orphanSphereGeometry : normalSphereGeometry;
          const sphereMaterial = new THREE.MeshLambertMaterial({
            color: node.color,
            transparent: true,
            opacity: isOrphan ? 0.5 : 0.9,
          });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

          if (showLabels && node.title) {
            const group = new THREE.Group();
            group.add(sphere);

            const labelColor = isDarkMode ? '#e5e7eb' : '#374151';
            const label = createTextSprite(node.title, labelColor);
            if (label) {
              label.position.set(0, 14, 0);
              group.add(label);
            }

            return group;
          }

          return sphere;
        })
        .nodeThreeObjectExtend(false)
        // Link styling
        .linkColor((link: any) => link.color)
        .linkWidth((link: any) => link.type === 'bidirectional' ? 1.5 : 0.75)
        .linkOpacity(0.5)
        // Disable particles for performance in preview
        .linkDirectionalParticles(0)
        // Fast stabilization
        .d3AlphaDecay(0.1)
        .d3VelocityDecay(0.5)
        .warmupTicks(20)
        .cooldownTicks(30)
        // Disable interactions
        .enableNodeDrag(false)
        .enableNavigationControls(false)
        .enablePointerInteraction(false);

      // Configure forces for tighter clustering
      const chargeForce = Graph.d3Force('charge');
      if (chargeForce) {
        chargeForce.strength(-20);
      }
      const linkForce = Graph.d3Force('link');
      if (linkForce) {
        linkForce.distance(30);
      }

      // Set initial camera position
      const distance = Math.max(150, nodes.length * 10);
      Graph.cameraPosition({ x: 0, y: 0, z: distance });

      graphRef.current = Graph;

      // Force transparent backgrounds
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
      setTimeout(forceTransparentBg, 100);

      // Start auto-rotation
      let angle = 0;

      const rotate = () => {
        if (!graphRef.current) return;

        angle += rotationSpeed;
        const x = distance * Math.sin(angle);
        const z = distance * Math.cos(angle);

        graphRef.current.cameraPosition({
          x,
          y: 0,
          z,
        });

        animationFrameRef.current = requestAnimationFrame(rotate);
      };

      // Start rotation after graph settles
      setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(rotate);
      }, 500);
    };

    initGraph();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [nodes, links, height, accentHex, isDarkMode, rotationSpeed, showLabels]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        const width = containerRef.current.clientWidth;
        graphRef.current.width(width).height(height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  return (
    <div
      ref={containerRef}
      className={`w-full relative [&>div]:!bg-transparent [&>canvas]:!bg-transparent ${className}`}
      style={{
        height,
        pointerEvents: 'none', // Ensure clicks pass through to parent
      }}
    />
  );
}

// Export types
export type { RotatingGraphPreviewProps };
