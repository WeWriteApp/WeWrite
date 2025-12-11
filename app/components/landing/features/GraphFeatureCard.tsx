"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLandingColors, LIGHTNESS, CHROMA } from '../LandingColorContext';

/**
 * GraphFeatureCard Component
 *
 * Shows a 3D graph preview that rotates based on scroll position.
 * Click to open fullscreen interactive mode with X button to close.
 * Uses landing page scroll-animated accent color.
 */
export default function GraphFeatureCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const fullscreenGraphRef = useRef<any>(null);
  const nodesRef = useRef<any[]>([]);
  const [isInView, setIsInView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { hue, isDark } = useLandingColors();

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sample graph data - realistic pages about climate and sustainability
  const sampleNodes = [
    { id: '1', title: 'Climate Action', level: 0 },
    { id: '2', title: 'Renewable Energy', level: 1 },
    { id: '3', title: 'Carbon Footprint', level: 1 },
    { id: '4', title: 'Urban Planning', level: 1 },
    { id: '5', title: 'Solar Power', level: 2 },
    { id: '6', title: 'Wind Farms', level: 2 },
    { id: '7', title: 'Electric Vehicles', level: 2 },
    { id: '8', title: 'Public Transit', level: 2 },
    { id: '9', title: 'Green Buildings', level: 2 },
  ];

  const sampleLinks = [
    { source: '1', target: '2' },
    { source: '1', target: '3' },
    { source: '1', target: '4' },
    { source: '2', target: '5' },
    { source: '2', target: '6' },
    { source: '3', target: '7' },
    { source: '4', target: '8' },
    { source: '4', target: '9' },
    { source: '2', target: '3' },
    { source: '5', target: '6' },
    { source: '7', target: '8' },
  ];

  // Observe when card comes into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Initialize 3D force graph
  useEffect(() => {
    if (!containerRef.current || !isInView) return;

    const initGraph = async () => {
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
      const height = container.clientHeight;

      // Helper to convert OKLCH to hex
      const oklchToHexLocal = (l: number, c: number, h: number): string => {
        // Simple OKLCH to sRGB conversion (approximation)
        const hRad = h * Math.PI / 180;
        const a = c * Math.cos(hRad);
        const b = c * Math.sin(hRad);

        // OKLab to linear sRGB (approximate)
        const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

        const l3 = l_ * l_ * l_;
        const m3 = m_ * m_ * m_;
        const s3 = s_ * s_ * s_;

        let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

        // Linear to sRGB gamma
        const toSrgb = (x: number) => {
          if (x <= 0) return 0;
          if (x >= 1) return 255;
          return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1/2.4) - 0.055) * 255);
        };

        const rr = toSrgb(r).toString(16).padStart(2, '0');
        const gg = toSrgb(g).toString(16).padStart(2, '0');
        const bb = toSrgb(bl).toString(16).padStart(2, '0');

        return `#${rr}${gg}${bb}`;
      };

      // Get current accent hex from hue
      const currentAccentHex = oklchToHexLocal(LIGHTNESS, CHROMA, hue);

      // Helper to add opacity to hex color
      const withOpacity = (hex: string, opacity: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      };

      // Create graph data using accent color
      const graphData = {
        nodes: sampleNodes.map(node => ({
          ...node,
          color: currentAccentHex,
        })),
        links: sampleLinks.map(link => ({
          ...link,
          color: withOpacity(currentAccentHex, 0.5),
        })),
      };

      // Helper to create text sprite for labels - larger and more readable
      const createTextSprite = (text: string, color: string, fontSize: number, isCenter: boolean) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        const scale = 4; // Higher resolution
        canvas.width = 512 * scale;
        canvas.height = 128 * scale;

        context.scale(scale, scale);
        context.font = `${isCenter ? 'bold' : '600'} ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = color;
        context.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        // Larger scale for better readability
        sprite.scale.set(isCenter ? 50 : 40, isCenter ? 12.5 : 10, 1);
        return sprite;
      };

      // Initialize 3D force graph - non-interactive with transparent background
      const Graph = ForceGraph3D({
        rendererConfig: { alpha: true, antialias: true }
      })(container)
        .width(width)
        .height(height)
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .graphData(graphData)
        .nodeThreeObject((node: any) => {
          const group = new THREE.Group();
          const isCenter = node.level === 0;

          // Create sphere using accent color
          const size = isCenter ? 8 : node.level === 1 ? 5 : 4;
          const geometry = new THREE.SphereGeometry(size, 16, 16);
          const material = new THREE.MeshLambertMaterial({
            color: currentAccentHex,
            transparent: true,
            opacity: isCenter ? 1 : node.level === 1 ? 0.85 : 0.7,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.userData.nodeId = node.id; // Store for later color updates
          group.add(sphere);

          // Store reference to sphere for color updates
          node.__sphereMesh = sphere;

          // Create text label - larger font sizes for readability
          const textColor = isDark ? '#f3f4f6' : '#1f2937';
          const fontSize = isCenter ? 24 : node.level === 1 ? 18 : 16;
          const textSprite = createTextSprite(node.title, textColor, fontSize, isCenter);
          textSprite.position.y = size + 10;
          group.add(textSprite);

          return group;
        })
        .nodeThreeObjectExtend(false)
        .linkColor(() => withOpacity(currentAccentHex, 0.5))
        .linkWidth(1.5)
        .linkOpacity(0.6)
        .enableNodeDrag(false)
        .enableNavigationControls(false)
        .enablePointerInteraction(false)
        .d3AlphaDecay(0.05)
        .d3VelocityDecay(0.4)
        .warmupTicks(100)
        .cooldownTicks(0);

      // Configure forces for better spacing with labels
      const chargeForce = Graph.d3Force('charge');
      if (chargeForce) chargeForce.strength(-50);

      const linkForce = Graph.d3Force('link');
      if (linkForce) linkForce.distance(50);

      // Set initial camera position - further back to see labels
      Graph.cameraPosition({ x: 0, y: 0, z: 200 });

      // Store reference
      graphRef.current = Graph;

      // Auto-rotate
      let angle = 0;
      const distance = 200;
      const animate = () => {
        if (!graphRef.current) return;
        angle += 0.004;
        graphRef.current.cameraPosition({
          x: distance * Math.sin(angle),
          y: 0,
          z: distance * Math.cos(angle)
        });
        requestAnimationFrame(animate);
      };
      animate();
    };

    initGraph();

    return () => {
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [isInView, isDark]);

  // Update colors when hue changes (without rebuilding the whole graph)
  useEffect(() => {
    if (!graphRef.current) return;

    // Helper to convert OKLCH to hex
    const oklchToHexLocal = (l: number, c: number, h: number): string => {
      const hRad = h * Math.PI / 180;
      const a = c * Math.cos(hRad);
      const b = c * Math.sin(hRad);

      const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

      const l3 = l_ * l_ * l_;
      const m3 = m_ * m_ * m_;
      const s3 = s_ * s_ * s_;

      let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

      const toSrgb = (x: number) => {
        if (x <= 0) return 0;
        if (x >= 1) return 255;
        return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1/2.4) - 0.055) * 255);
      };

      const rr = toSrgb(r).toString(16).padStart(2, '0');
      const gg = toSrgb(g).toString(16).padStart(2, '0');
      const bb = toSrgb(bl).toString(16).padStart(2, '0');

      return `#${rr}${gg}${bb}`;
    };

    const currentAccentHex = oklchToHexLocal(LIGHTNESS, CHROMA, hue);

    // Update node colors
    const graphData = graphRef.current.graphData();
    if (graphData && graphData.nodes) {
      graphData.nodes.forEach((node: any) => {
        if (node.__sphereMesh && node.__sphereMesh.material) {
          node.__sphereMesh.material.color.set(currentAccentHex);
        }
      });
    }

    // Update link colors by refreshing the graph's link color function
    graphRef.current.linkColor(() => {
      const r = parseInt(currentAccentHex.slice(1, 3), 16);
      const g = parseInt(currentAccentHex.slice(3, 5), 16);
      const b = parseInt(currentAccentHex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.5)`;
    });
  }, [hue]);

  // Scroll-based rotation
  useEffect(() => {
    if (!graphRef.current || !isInView) return;

    let lastScrollY = window.scrollY;
    const distance = 200;

    const handleScroll = () => {
      if (!graphRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Calculate how far through the viewport the element is
      const elementCenter = rect.top + rect.height / 2;
      const viewportCenter = viewportHeight / 2;
      const scrollProgress = (viewportCenter - elementCenter) / viewportHeight;

      // Map scroll progress to rotation angle
      const baseAngle = scrollProgress * Math.PI * 2;

      graphRef.current.cameraPosition({
        x: distance * Math.sin(baseAngle),
        y: distance * 0.3 * Math.sin(baseAngle * 0.5),
        z: distance * Math.cos(baseAngle)
      });

      lastScrollY = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isInView]);

  // Handle escape key to close fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Initialize fullscreen graph
  useEffect(() => {
    if (!isFullscreen || !fullscreenContainerRef.current) return;

    const initFullscreenGraph = async () => {
      try {
        // @ts-ignore
        const ForceGraph3DModule = await import('3d-force-graph');
        const ForceGraph3D = ForceGraph3DModule.default as any;
        const THREE = await import('three');

        // Check if still mounted and fullscreen
        if (!isFullscreen || !fullscreenContainerRef.current) return;

      // Clear previous graph
      if (fullscreenGraphRef.current) {
        fullscreenGraphRef.current._destructor?.();
        fullscreenContainerRef.current!.innerHTML = '';
      }

      const container = fullscreenContainerRef.current!;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Helper to convert OKLCH to hex
      const oklchToHexLocal = (l: number, c: number, h: number): string => {
        const hRad = h * Math.PI / 180;
        const a = c * Math.cos(hRad);
        const b = c * Math.sin(hRad);

        const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

        const l3 = l_ * l_ * l_;
        const m3 = m_ * m_ * m_;
        const s3 = s_ * s_ * s_;

        let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

        const toSrgb = (x: number) => {
          if (x <= 0) return 0;
          if (x >= 1) return 255;
          return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1/2.4) - 0.055) * 255);
        };

        const rr = toSrgb(r).toString(16).padStart(2, '0');
        const gg = toSrgb(g).toString(16).padStart(2, '0');
        const bb = toSrgb(bl).toString(16).padStart(2, '0');

        return `#${rr}${gg}${bb}`;
      };

      const currentAccentHex = oklchToHexLocal(LIGHTNESS, CHROMA, hue);

      const withOpacity = (hex: string, opacity: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      };

      const graphData = {
        nodes: sampleNodes.map(node => ({
          ...node,
          color: currentAccentHex,
        })),
        links: sampleLinks.map(link => ({
          ...link,
          color: withOpacity(currentAccentHex, 0.5),
        })),
      };

      const createTextSprite = (text: string, color: string, fontSize: number, isCenter: boolean) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        const scale = 4;
        canvas.width = 512 * scale;
        canvas.height = 128 * scale;

        context.scale(scale, scale);
        context.font = `${isCenter ? 'bold' : '600'} ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = color;
        context.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(isCenter ? 50 : 40, isCenter ? 12.5 : 10, 1);
        return sprite;
      };

      // Initialize fullscreen 3D force graph - INTERACTIVE
      const Graph = ForceGraph3D({
        rendererConfig: { alpha: true, antialias: true }
      })(container)
        .width(width)
        .height(height)
        .backgroundColor(isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)')
        .showNavInfo(false)
        .graphData(graphData)
        .nodeThreeObject((node: any) => {
          const group = new THREE.Group();
          const isCenter = node.level === 0;

          const size = isCenter ? 8 : node.level === 1 ? 5 : 4;
          const geometry = new THREE.SphereGeometry(size, 16, 16);
          const material = new THREE.MeshLambertMaterial({
            color: currentAccentHex,
            transparent: true,
            opacity: isCenter ? 1 : node.level === 1 ? 0.85 : 0.7,
          });
          const sphere = new THREE.Mesh(geometry, material);
          group.add(sphere);

          const textColor = isDark ? '#f3f4f6' : '#1f2937';
          const fontSize = isCenter ? 24 : node.level === 1 ? 18 : 16;
          const textSprite = createTextSprite(node.title, textColor, fontSize, isCenter);
          textSprite.position.y = size + 10;
          group.add(textSprite);

          return group;
        })
        .nodeThreeObjectExtend(false)
        .linkColor(() => withOpacity(currentAccentHex, 0.5))
        .linkWidth(1.5)
        .linkOpacity(0.6)
        .enableNodeDrag(true)
        .enableNavigationControls(true)
        .enablePointerInteraction(true)
        .d3AlphaDecay(0.05)
        .d3VelocityDecay(0.4)
        .warmupTicks(100)
        .cooldownTicks(0);

      const chargeForce = Graph.d3Force('charge');
      if (chargeForce) chargeForce.strength(-50);

      const linkForce = Graph.d3Force('link');
      if (linkForce) linkForce.distance(50);

      Graph.cameraPosition({ x: 0, y: 0, z: 250 });

      fullscreenGraphRef.current = Graph;
      } catch (error) {
        console.error('Failed to load 3D graph:', error);
        setIsFullscreen(false);
      }
    };

    initFullscreenGraph();

    return () => {
      if (fullscreenGraphRef.current) {
        fullscreenGraphRef.current._destructor?.();
        fullscreenGraphRef.current = null;
      }
    };
  }, [isFullscreen, isDark, hue]);

  // Fullscreen modal
  const fullscreenModal = isFullscreen && mounted && (
    createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-background/95 backdrop-blur-sm"
          onClick={() => setIsFullscreen(false)}
        />

        {/* Graph container */}
        <div
          ref={fullscreenContainerRef}
          className="absolute inset-0"
        />

        {/* Close button */}
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg hover:bg-muted transition-colors"
          aria-label="Close fullscreen"
        >
          <X className="h-5 w-5" />
        </button>
      </div>,
      document.body
    )
  );

  return (
    <>
      <div
        ref={containerRef}
        className="relative h-full min-h-[200px] overflow-hidden cursor-pointer"
        style={{ touchAction: 'pan-y' }}
        onClick={() => setIsFullscreen(true)}
        title="Click to expand"
      />
      {fullscreenModal}
    </>
  );
}
