"use client";

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../providers/ThemeProvider';

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
  const sliderRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateValue(e);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    updateValueFromTouch(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      updateValue(e);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging) {
      e.preventDefault(); // Prevent scrolling
      updateValueFromTouch(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const updateValue = (e: MouseEvent | React.MouseEvent) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const newValue = min + percentage * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    onChange(Math.max(min, Math.min(max, steppedValue)));
  };

  const updateValueFromTouch = (e: TouchEvent | React.TouchEvent) => {
    if (!sliderRef.current) return;

    const touch = e.touches[0] || e.changedTouches[0];
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));

    const newValue = min + percentage * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    onChange(Math.max(min, Math.min(max, steppedValue)));
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("relative px-3", className)}>
      <div
        ref={sliderRef}
        className="relative h-8 rounded-xl cursor-pointer border border-border shadow-sm touch-manipulation overflow-hidden"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ background: gradient }}
      >
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors duration-200 rounded-xl" />
      </div>

      {/* Thumb - positioned outside the slider container to prevent clipping */}
      <div
        className={cn(
          "absolute top-1/2 w-6 h-6 bg-white shadow-lg rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 z-10 hover:scale-110 active:scale-95",
          "border-2 border-white"
        )}
        style={{
          left: `calc(${percentage}% + 12px)`, // Add padding offset
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      />
    </div>
  );
}
