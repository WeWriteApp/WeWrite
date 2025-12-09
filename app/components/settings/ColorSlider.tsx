"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';

interface ColorSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  gradient: string;
  className?: string;
}

export default function ColorSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  gradient,
  className
}: ColorSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const calculateValue = useCallback((clientX: number) => {
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newValue = min + percentage * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    onChange(Math.max(min, Math.min(max, steppedValue)));
  }, [min, max, step, onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    calculateValue(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    calculateValue(touch.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      calculateValue(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      calculateValue(touch.clientX);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, calculateValue]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-8 rounded-xl cursor-pointer border border-border shadow-sm touch-none select-none",
        isDragging && "cursor-grabbing",
        className
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ background: gradient }}
    >
      {/* Thumb - positioned relative to the track */}
      <div
        className={cn(
          "absolute top-1/2 w-6 h-6 bg-white rounded-full pointer-events-none",
          "transform -translate-x-1/2 -translate-y-1/2",
          isDragging ? "scale-110" : "hover:scale-105",
          "transition-transform duration-75"
        )}
        style={{
          left: `${percentage}%`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1), inset 0 0 0 2px white'
        }}
      />
    </div>
  );
}
