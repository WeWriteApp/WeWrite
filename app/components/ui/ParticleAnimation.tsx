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
}

interface ParticleAnimationProps {
  trigger: boolean;
  onComplete?: () => void;
  className?: string;
  particleCount?: number;
  duration?: number;
  color?: string;
}

export function ParticleAnimation({
  trigger,
  onComplete,
  className = '',
  particleCount = 8,
  duration = 1000,
  color = 'hsl(var(--primary))'
}: ParticleAnimationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!trigger) return;

    // Create particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2 + Math.random() * 2;
      
      newParticles.push({
        id: i,
        x: 50, // Start from center (%)
        y: 50, // Start from center (%)
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: duration,
        maxLife: duration,
        size: 2 + Math.random() * 2
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
        prevParticles.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          life: particle.maxLife * (1 - progress),
          vy: particle.vy + 0.1 // Add slight gravity
        }))
      );

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [trigger, particleCount, duration, onComplete]);

  if (!isAnimating || particles.length === 0) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: color,
            opacity: particle.life / particle.maxLife,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 ${particle.size * 2}px ${color}`,
          }}
        />
      ))}
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
