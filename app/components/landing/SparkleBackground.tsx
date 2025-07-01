"use client";

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  delay: number;
}

/**
 * SparkleBackground Component
 * 
 * Creates subtle animated sparkle particles that move upward from the bottom of the screen.
 * All particles are present on page load (no spawning) and animation is performance-optimized.
 * Uses subtle opacity/size to maintain focus on main content.
 */
export default function SparkleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    const initParticles = () => {
      const particleCount = Math.min(50, Math.floor(window.innerWidth / 30)); // Responsive particle count
      particlesRef.current = [];

      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height, // Start particles throughout the screen
          size: Math.random() * 2 + 1, // Small size (1-3px)
          opacity: Math.random() * 0.3 + 0.1, // Subtle opacity (0.1-0.4)
          speed: Math.random() * 0.5 + 0.2, // Slow movement (0.2-0.7px per frame)
          delay: Math.random() * 1000 // Random delay for staggered animation
        });
      }
    };

    initParticles();

    // Animation loop
    let startTime = Date.now();
    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach((particle) => {
        // Only animate after delay
        if (elapsed > particle.delay) {
          // Move particle upward
          particle.y -= particle.speed;

          // Reset particle when it goes off screen
          if (particle.y < -10) {
            particle.y = canvas.height + 10;
            particle.x = Math.random() * canvas.width;
          }

          // Draw particle as a subtle star/sparkle
          ctx.save();
          ctx.globalAlpha = particle.opacity;
          ctx.fillStyle = '#ffffff';
          
          // Draw a simple cross/star shape
          const size = particle.size;
          ctx.fillRect(particle.x - size/2, particle.y - size/4, size, size/2);
          ctx.fillRect(particle.x - size/4, particle.y - size/2, size/2, size);
          
          ctx.restore();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 1,
        opacity: 0.6, // Overall subtle opacity
      }}
      aria-hidden="true"
    />
  );
}