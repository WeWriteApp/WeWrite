"use client";

import { useEffect, useRef } from "react";

interface GradientBlobBackgroundProps {
  className?: string;
}

export function GradientBlobBackground({ className = "" }: GradientBlobBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set canvas dimensions to match parent
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    
    // Blob settings
    const blobCount = 4; 
    const blobs: Blob[] = [];
    
    // Create blobs with different colors (burgundy red from image 2)
    const colors = [
      { r: 145, g: 20, b: 40 },   // Deep burgundy
      { r: 160, g: 30, b: 50 },   // Medium burgundy
      { r: 175, g: 40, b: 60 },   // Lighter burgundy
      { r: 130, g: 15, b: 35 }    // Dark burgundy
    ];
    
    for (let i = 0; i < blobCount; i++) {
      blobs.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 180 + 120, 
        speedX: (Math.random() - 0.5) * 0.6,
        speedY: (Math.random() - 0.5) * 0.6,
        color: colors[i % colors.length],
        opacity: 0.4 
      });
    }
    
    // Use offscreen canvas for better performance
    let offscreenCanvas: HTMLCanvasElement | null = null;
    let offscreenCtx: CanvasRenderingContext2D | null = null;
    
    const createOffscreenCanvas = () => {
      offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = canvas.width;
      offscreenCanvas.height = canvas.height;
      offscreenCtx = offscreenCanvas.getContext('2d', { alpha: true });
    };
    
    createOffscreenCanvas();
    
    // Animation loop
    let animationFrameId: number;
    let lastTime = 0;
    
    const animate = (timestamp: number) => {
      if (!offscreenCanvas || !offscreenCtx || !ctx) return;
      
      // Throttle updates for performance
      const elapsed = timestamp - lastTime;
      if (elapsed > 16) { 
        lastTime = timestamp;
        
        // Clear the offscreen canvas
        offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw blobs
        blobs.forEach(blob => {
          // Move blob
          blob.x += blob.speedX;
          blob.y += blob.speedY;
          
          // Bounce off edges
          if (blob.x < -blob.radius || blob.x > canvas.width + blob.radius) {
            blob.speedX *= -1;
          }
          if (blob.y < -blob.radius || blob.y > canvas.height + blob.radius) {
            blob.speedY *= -1;
          }
          
          // Draw blob with gradient
          const gradient = offscreenCtx.createRadialGradient(
            blob.x, blob.y, 0,
            blob.x, blob.y, blob.radius
          );
          
          gradient.addColorStop(0, `rgba(${blob.color.r}, ${blob.color.g}, ${blob.color.b}, ${blob.opacity})`);
          gradient.addColorStop(1, `rgba(${blob.color.r}, ${blob.color.g}, ${blob.color.b}, 0)`);
          
          offscreenCtx.beginPath();
          offscreenCtx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
          offscreenCtx.fillStyle = gradient;
          offscreenCtx.fill();
        });
        
        // Apply to main canvas with composite operation and blur
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.filter = 'blur(60px)';
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(offscreenCanvas, 0, 0);
        ctx.filter = 'none';
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate(0);
    
    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
      offscreenCanvas = null;
      offscreenCtx = null;
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

interface Blob {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  color: { r: number, g: number, b: number };
  opacity: number;
}