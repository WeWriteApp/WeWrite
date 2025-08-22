"use client";

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface RainbowColorSliderProps {
  value: string; // hex color (converted to OKLCH by AccentColorContext)
  onChange: (color: string) => void;
  className?: string;
}

export default function RainbowColorSlider({
  value,
  onChange,
  className
}: RainbowColorSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [hue, setHue] = useState(285); // Default purple hue

  // Convert hex to hue
  const hexToHue = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    if (diff === 0) return 0;

    let hue = 0;
    if (max === r) {
      hue = ((g - b) / diff) % 6;
    } else if (max === g) {
      hue = (b - r) / diff + 2;
    } else {
      hue = (r - g) / diff + 4;
    }

    hue = Math.round(hue * 60);
    return hue < 0 ? hue + 360 : hue;
  };

  // Convert hue to hex
  const hueToHex = (h: number): string => {
    const s = 85; // High saturation
    const l = 50; // Medium lightness

    const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l / 100 - c / 2;

    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Initialize hue from value
  useEffect(() => {
    if (value) {
      setHue(hexToHue(value));
    }
  }, [value]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateColor(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      updateColor(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateColor = (e: MouseEvent | React.MouseEvent) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newHue = Math.round(percentage * 360);

    setHue(newHue);
    const newColor = hueToHex(newHue);
    onChange(newColor);
  };

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const thumbPosition = (hue / 360) * 100;

  // ONLY return the slider - no extra elements
  return (
    <div className={cn("relative px-4", className)}>
      <div
        ref={sliderRef}
        className="relative h-8 rounded-lg cursor-pointer select-none border border-border overflow-hidden"
        style={{
          background: 'linear-gradient(to right, #ff0000 0%, #ffff00 16.66%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.66%, #ff00ff 83.33%, #ff0000 100%)'
        }}
        onMouseDown={handleMouseDown}
      />

      {/* Slider Thumb - positioned outside container to prevent clipping */}
      <div
        className={cn(
          "absolute top-1/2 w-8 h-8 -mt-4 -ml-4 rounded-full border-2 border-white shadow-lg transition-transform duration-150 z-10",
          isDragging ? "scale-110" : "hover:scale-105"
        )}
        style={{
          left: `calc(${thumbPosition}% + 16px)`, // Add padding offset
          backgroundColor: hueToHex(hue),
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      />
    </div>
  );
}