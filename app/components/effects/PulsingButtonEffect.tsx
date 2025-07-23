"use client";

import React, { useEffect, useState } from 'react';
import { useAccentColor } from '../../contexts/AccentColorContext';

interface PulsingButtonEffectProps {
  targetElement: HTMLElement | null;
  isActive: boolean;
  className?: string;
}

/**
 * PulsingButtonEffect - Creates a subtle pulsing animation around a button
 * 
 * This component creates a gentle, continuous pulse effect around the plus button
 * for logged-out users to encourage interaction.
 */
export function PulsingButtonEffect({
  targetElement,
  isActive,
  className = ''
}: PulsingButtonEffectProps) {
  const { accentColor, customColors } = useAccentColor();
  const [elementRect, setElementRect] = useState<DOMRect | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  // Get the current accent color value
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor] || '#3b82f6'; // fallback to blue
    }
    
    // Get the CSS variable value for the current accent color
    if (typeof window !== 'undefined') {
      const computedStyle = getComputedStyle(document.documentElement);
      const primaryColor = computedStyle.getPropertyValue('--primary').trim();
      
      // Convert HSL to hex if needed
      if (primaryColor.startsWith('hsl')) {
        return hslToHex(primaryColor);
      }
      
      return primaryColor || '#3b82f6';
    }
    
    return '#3b82f6'; // fallback
  };

  // Convert HSL to hex color
  const hslToHex = (hsl: string): string => {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return '#3b82f6';
    
    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Update element position
  useEffect(() => {
    setIsClient(true);
    
    if (!targetElement || !isActive) {
      setElementRect(null);
      return;
    }

    const updatePosition = () => {
      const rect = targetElement.getBoundingClientRect();
      setElementRect(rect);
    };

    // Initial position
    updatePosition();

    // Update on scroll and resize
    const handleUpdate = () => {
      if (isActive) {
        updatePosition();
      }
    };

    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [targetElement, isActive]);

  // Don't render if not active, no element, reduced motion, or not client-side
  if (!isClient || !isActive || !targetElement || !elementRect || prefersReducedMotion) {
    return null;
  }

  const accentColorValue = getAccentColorValue();

  return (
    <div
      className={`fixed pointer-events-none z-40 ${className}`}
      style={{
        left: elementRect.left - 8, // 8px padding around button
        top: elementRect.top - 8,
        width: elementRect.width + 16,
        height: elementRect.height + 16,
      }}
    >
      {/* Outer pulse ring */}
      <div
        className="absolute inset-0 rounded-full animate-pulse-ring-outer"
        style={{
          background: `radial-gradient(circle, transparent 60%, ${accentColorValue}15 70%, transparent 80%)`,
          animationDuration: '2s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        }}
      />
      
      {/* Inner pulse ring */}
      <div
        className="absolute inset-2 rounded-full animate-pulse-ring-inner"
        style={{
          background: `radial-gradient(circle, transparent 50%, ${accentColorValue}25 65%, transparent 75%)`,
          animationDuration: '1.5s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          animationDelay: '0.3s',
        }}
      />
    </div>
  );
}

// Add the CSS animations to the global styles
export const pulsingButtonStyles = `
  @keyframes pulse-ring-outer {
    0% {
      transform: scale(0.8);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.4;
    }
    100% {
      transform: scale(1.3);
      opacity: 0;
    }
  }

  @keyframes pulse-ring-inner {
    0% {
      transform: scale(0.9);
      opacity: 0.6;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.3;
    }
    100% {
      transform: scale(1.2);
      opacity: 0;
    }
  }

  .animate-pulse-ring-outer {
    animation: pulse-ring-outer 2s ease-in-out infinite;
  }

  .animate-pulse-ring-inner {
    animation: pulse-ring-inner 1.5s ease-in-out infinite 0.3s;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .animate-pulse-ring-outer,
    .animate-pulse-ring-inner {
      animation: none;
    }
  }
`;
