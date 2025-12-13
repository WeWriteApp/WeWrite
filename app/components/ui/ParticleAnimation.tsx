"use client";

import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  distance: number; // Track distance from origin
}

interface ParticleAnimationProps {
  trigger: boolean;
  onComplete?: () => void;
  className?: string;
  particleCount?: number;
  duration?: number;
  color?: string;
  /** Distance threshold before particles become visible (in % units) */
  fadeInDistance?: number;
}

export function ParticleAnimation({
  trigger,
  onComplete,
  className = '',
  particleCount = 8,
  duration = 1000,
  color = 'hsl(var(--primary))',
  fadeInDistance = 30 // Particles fade in after traveling this far from center
}: ParticleAnimationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!trigger) return;

    // Create particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 3 + Math.random() * 3;

      newParticles.push({
        id: i,
        x: 50, // Start from center (%)
        y: 50, // Start from center (%)
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: duration,
        maxLife: duration,
        size: 2 + Math.random() * 2,
        distance: 0
      });
    }

    setParticles(newParticles);
    setIsAnimating(true);

    // Animate particles
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        setParticles([]);
        setIsAnimating(false);
        onComplete?.();
        return;
      }

      setParticles(prevParticles =>
        prevParticles.map(particle => {
          const newX = particle.x + particle.vx;
          const newY = particle.y + particle.vy;
          // Calculate distance from center (50, 50)
          const dx = newX - 50;
          const dy = newY - 50;
          const distance = Math.sqrt(dx * dx + dy * dy);

          return {
            ...particle,
            x: newX,
            y: newY,
            life: particle.maxLife * (1 - progress),
            vy: particle.vy + 0.15, // Add slight gravity
            distance
          };
        })
      );

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [trigger, particleCount, duration, onComplete]);

  if (!isAnimating || particles.length === 0) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)} style={{ overflow: 'visible' }}>
      {particles.map(particle => {
        // Calculate opacity: fade in based on distance, then fade out based on life
        const fadeInProgress = Math.min(1, particle.distance / fadeInDistance);
        const lifeOpacity = particle.life / particle.maxLife;
        const opacity = fadeInProgress * lifeOpacity;

        return (
          <div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: color,
              opacity,
              transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 ${particle.size * 2}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
}

interface PulseAnimationProps {
  trigger: boolean;
  onComplete?: () => void;
  className?: string;
  duration?: number;
  intensity?: number;
}

export function PulseAnimation({
  trigger,
  onComplete,
  className = '',
  duration = 600,
  intensity = 1.1
}: PulseAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!trigger) return;

    setIsAnimating(true);
    
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [trigger, duration, onComplete]);

  return (
    <div
      className={cn(
        "absolute inset-0 transition-transform duration-300 ease-out",
        isAnimating && "animate-pulse-scale",
        className
      )}
      style={{
        transform: isAnimating ? `scale(${intensity})` : 'scale(1)',
      }}
    />
  );
}
