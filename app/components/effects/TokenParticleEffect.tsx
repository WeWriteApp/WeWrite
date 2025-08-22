"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useAccentColor } from '../../contexts/AccentColorContext';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface TokenParticleEffectProps {
  trigger: boolean;
  originElement: HTMLElement | null;
  onComplete?: () => void;
  particleCount?: number;
  duration?: number;
  maxDistance?: number;
}

/**
 * TokenParticleEffect - Creates a burst of particles from the accent color section
 * 
 * This component creates a celebratory particle effect when users add tokens,
 * emanating from the current page's token amount display area.
 */
export function TokenParticleEffect({
  trigger,
  originElement,
  onComplete,
  particleCount = 10,
  duration = 900,
  maxDistance = 60
}: TokenParticleEffectProps) {
  const { accentColor, customColors } = useAccentColor();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  // Get the current accent color value
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor] || '#8b5cf6'; // fallback to purple
    }

    // Get the CSS variable value for the current accent color
    if (typeof window !== 'undefined') {
      const computedStyle = getComputedStyle(document.documentElement);
      const primaryColor = computedStyle.getPropertyValue('--primary').trim();

      // Convert HSL to hex if needed
      if (primaryColor.startsWith('hsl')) {
        return hslToHex(primaryColor);
      }

      return primaryColor || '#8b5cf6';
    }

    return '#8b5cf6'; // fallback to purple instead of blue
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

  // Create particles at the origin element's position
  const createParticles = () => {
    if (!originElement || prefersReducedMotion) return [];

    const rect = originElement.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (!containerRect) return [];

    // Calculate origin position relative to the container
    const originX = rect.left + rect.width / 2 - containerRect.left;
    const originY = rect.top + rect.height / 2 - containerRect.top;

    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      // Random angle for burst effect with more spread
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.8;
      const speed = 0.8 + Math.random() * 0.7; // 0.8 to 1.5 (faster)
      const distance = maxDistance * (0.7 + Math.random() * 0.3); // 70% to 100% of max distance

      newParticles.push({
        id: i,
        x: originX + (Math.random() - 0.5) * 8, // Add slight randomness to origin
        y: originY + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4, // 3-7px (larger particles)
        opacity: 1,
        life: 0,
        maxLife: duration + Math.random() * 200 // Slight variation in lifetime
      });
    }
    
    return newParticles;
  };

  // Animation loop
  const animate = (currentTime: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = currentTime;
    }
    
    const elapsed = currentTime - startTimeRef.current;
    
    setParticles(prevParticles => {
      const updatedParticles = prevParticles.map(particle => {
        const progress = elapsed / particle.maxLife;
        
        if (progress >= 1) {
          return { ...particle, opacity: 0 };
        }
        
        // Ease-out animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        return {
          ...particle,
          x: particle.x + particle.vx * elapsed * 0.1,
          y: particle.y + particle.vy * elapsed * 0.1,
          opacity: 1 - easeOut,
          life: elapsed
        };
      });
      
      // Check if animation is complete
      const allComplete = updatedParticles.every(p => p.opacity <= 0);
      
      if (allComplete) {
        setIsAnimating(false);
        onComplete?.();
        return [];
      }
      
      return updatedParticles;
    });
    
    if (elapsed < duration) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setIsAnimating(false);
      setParticles([]);
      onComplete?.();
    }
  };

  // Trigger effect
  useEffect(() => {
    if (trigger && !isAnimating && !prefersReducedMotion) {
      const newParticles = createParticles();
      if (newParticles.length > 0) {
        setParticles(newParticles);
        setIsAnimating(true);
        startTimeRef.current = undefined;
        animationRef.current = requestAnimationFrame(animate);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [trigger]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  if (prefersReducedMotion || particles.length === 0) {
    return null;
  }

  const accentColorValue = getAccentColorValue();

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ position: 'fixed' }}
    >
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: particle.x - particle.size / 2,
            top: particle.y - particle.size / 2,
            width: particle.size,
            height: particle.size,
            backgroundColor: accentColorValue,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size * 3}px ${accentColorValue}60, 0 0 ${particle.size * 6}px ${accentColorValue}30`,
            transform: 'translate3d(0, 0, 0)', // Hardware acceleration
          }}
        />
      ))}
    </div>
  );
}
