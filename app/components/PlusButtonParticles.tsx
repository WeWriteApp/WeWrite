"use client";

import React, { useRef, useEffect } from 'react';

interface PlusButtonParticlesProps {
  isActive: boolean;
  onComplete: () => void;
  color?: string;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  life: number;
  maxLife: number;
}

const PlusButtonParticles: React.FC<PlusButtonParticlesProps> = ({ 
  isActive, 
  onComplete,
  color = '#3b82f6' // Default blue color
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!isActive) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match parent
    canvas.width = 40;
    canvas.height = 40;
    
    // Create particles
    const particles: Particle[] = [];
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 0.5 + Math.random() * 1.5;
      
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: 1 + Math.random() * 2,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        opacity: 0.8,
        life: 0,
        maxLife: 20 + Math.random() * 20
      });
    }
    
    let animationFrameId: number;
    let allParticlesDone = false;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let activeParts = 0;
      
      // Update and draw particles
      particles.forEach(particle => {
        // Update life
        particle.life++;
        
        if (particle.life <= particle.maxLife) {
          activeParts++;
          
          // Calculate opacity based on life
          particle.opacity = 1 - (particle.life / particle.maxLife);
          
          // Move particle
          particle.x += particle.speedX;
          particle.y += particle.speedY;
          
          // Draw particle
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = `${color}${Math.round(particle.opacity * 255).toString(16).padStart(2, '0')}`;
          ctx.fill();
        }
      });
      
      if (activeParts === 0 && !allParticlesDone) {
        allParticlesDone = true;
        onComplete();
        return;
      }
      
      if (!allParticlesDone) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, onComplete, color]);
  
  if (!isActive) return null;
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '40px', height: '40px' }}
    />
  );
};

export default PlusButtonParticles;
