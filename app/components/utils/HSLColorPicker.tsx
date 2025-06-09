"use client";

import React, { useState, useEffect } from 'react';
import { Slider } from "../ui/slider";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { useAccentColor } from "../../contexts/AccentColorContext";

interface HSLColorPickerProps {
  onApply: (hslColor: string) => void;
  initialColor?: string;
}

// Convert hex to HSL
const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
  // Remove the # if present
  hex = hex.replace(/^#/, '');

  // Parse the hex values
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
  } else {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
  }

  // Find min and max values
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h = Math.round(h * 60);
  }

  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return { h, s, l };
};

// Convert HSL to hex
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
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

  // Convert to hex
  const toHex = (c: number) => {
    const hex = Math.round((c + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export default function HSLColorPicker({ onApply, initialColor = '#0052CC' }: HSLColorPickerProps) {
  // Convert initial color to HSL
  const initialHSL = hexToHSL(initialColor);

  // Use refs instead of state to avoid re-renders
  const hueRef = React.useRef<number>(initialHSL.h);
  const saturationRef = React.useRef<number>(initialHSL.s);
  const luminanceRef = React.useRef<number>(initialHSL.l);

  // Refs for DOM elements
  const hueDotRef = React.useRef<HTMLDivElement>(null);
  const saturationDotRef = React.useRef<HTMLDivElement>(null);
  const luminanceDotRef = React.useRef<HTMLDivElement>(null);
  const hueBarRef = React.useRef<HTMLDivElement>(null);
  const saturationBarRef = React.useRef<HTMLDivElement>(null);
  const luminanceBarRef = React.useRef<HTMLDivElement>(null);

  // Display state (only for labels, doesn't affect performance)
  const [hueDisplay, setHueDisplay] = useState(initialHSL.h);
  const [saturationDisplay, setSaturationDisplay] = useState(initialHSL.s);
  const [luminanceDisplay, setLuminanceDisplay] = useState(initialHSL.l);

  // Enforce luminance constraints to ensure good contrast
  const MIN_LUMINANCE = 20; // Prevent colors that are too dark
  const MAX_LUMINANCE = 80; // Prevent colors that are too light

  // Debounce timer ref
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Update the color with debouncing
  const updateColor = React.useCallback(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set a new timer
    timerRef.current = setTimeout(() => {
      const hslColor = `hsl(${hueRef.current}, ${saturationRef.current}%, ${luminanceRef.current}%)`;
      onApply(hslColor);
    }, 300);
  }, [onApply]);

  // Update dot positions and colors
  const updateDots = React.useCallback(() => {
    if (hueDotRef.current && hueBarRef.current) {
      hueDotRef.current.style.left = `${(hueRef.current / 359) * 100}%`;
      hueDotRef.current.style.backgroundColor = `hsl(${hueRef.current}, 100%, 50%)`;
    }

    if (saturationDotRef.current && saturationBarRef.current) {
      saturationDotRef.current.style.left = `${saturationRef.current}%`;
      saturationDotRef.current.style.backgroundColor = `hsl(${hueRef.current}, ${saturationRef.current}%, ${luminanceRef.current}%)`;
      saturationBarRef.current.style.background = `linear-gradient(to right, hsl(${hueRef.current}, 0%, ${luminanceRef.current}%), hsl(${hueRef.current}, 100%, ${luminanceRef.current}%))`;
    }

    if (luminanceDotRef.current && luminanceBarRef.current) {
      luminanceDotRef.current.style.left = `${luminanceRef.current}%`;
      luminanceDotRef.current.style.backgroundColor = `hsl(${hueRef.current}, ${saturationRef.current}%, ${luminanceRef.current}%)`;
      luminanceBarRef.current.style.background = `linear-gradient(to right, hsl(${hueRef.current}, ${saturationRef.current}%, 0%), hsl(${hueRef.current}, ${saturationRef.current}%, 50%), hsl(${hueRef.current}, ${saturationRef.current}%, 100%))`;
    }

    // Update display values (doesn"t affect performance)
    setHueDisplay(hueRef.current);
    setSaturationDisplay(saturationRef.current);
    setLuminanceDisplay(luminanceRef.current);
  }, []);

  // Handle hue change
  const handleHueChange = React.useCallback((clientX: number) => {
    if (!hueBarRef.current) return;

    const rect = hueBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const newHue = Math.round((x / rect.width) * 359);
    hueRef.current = Math.max(0, Math.min(359, newHue));

    updateDots();
    updateColor();
  }, [updateDots, updateColor]);

  // Handle saturation change
  const handleSaturationChange = React.useCallback((clientX: number) => {
    if (!saturationBarRef.current) return;

    const rect = saturationBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const newSaturation = Math.round((x / rect.width) * 100);
    saturationRef.current = Math.max(0, Math.min(100, newSaturation));

    updateDots();
    updateColor();
  }, [updateDots, updateColor]);

  // Handle luminance change
  const handleLuminanceChange = React.useCallback((clientX: number) => {
    if (!luminanceBarRef.current) return;

    const rect = luminanceBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const rawLuminance = Math.round((x / rect.width) * 100);
    luminanceRef.current = Math.max(MIN_LUMINANCE, Math.min(MAX_LUMINANCE, rawLuminance));

    updateDots();
    updateColor();
  }, [updateDots, updateColor]);

  // Set up mouse and touch event handlers
  useEffect(() => {
    // Initialize dot positions
    updateDots();

    // Clean up function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [updateDots]);

  return (
    <div className="space-y-6">
      {/* Saturation color bar with dot */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs">Saturation: {saturationDisplay}%</Label>
        </div>
        <div
          ref={saturationBarRef}
          className="h-12 rounded-md w-full relative cursor-pointer"
          onMouseDown={(e) => {
            handleSaturationChange(e.clientX);

            const handleMouseMove = (e: MouseEvent) => {
              handleSaturationChange(e.clientX);
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleSaturationChange(e.touches[0].clientX);

            const handleTouchMove = (e: TouchEvent) => {
              handleSaturationChange(e.touches[0].clientX);
            };

            const handleTouchEnd = () => {
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
            };

            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
          }}
        >
          <div
            ref={saturationDotRef}
            className="absolute top-0 bottom-0 w-8 h-8 my-auto rounded-full border-2 border-white shadow-md transform -translate-x-1/2"
          />
        </div>
      </div>

      {/* Luminance color bar with dot */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs">Luminance: {luminanceDisplay}%</Label>
          <Label className="text-xs text-muted-foreground">(Limited for readability)</Label>
        </div>
        <div
          ref={luminanceBarRef}
          className="h-12 rounded-md w-full relative cursor-pointer"
          onMouseDown={(e) => {
            handleLuminanceChange(e.clientX);

            const handleMouseMove = (e: MouseEvent) => {
              handleLuminanceChange(e.clientX);
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleLuminanceChange(e.touches[0].clientX);

            const handleTouchMove = (e: TouchEvent) => {
              handleLuminanceChange(e.touches[0].clientX);
            };

            const handleTouchEnd = () => {
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
            };

            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
          }}
        >
          <div
            ref={luminanceDotRef}
            className="absolute top-0 bottom-0 w-8 h-8 my-auto rounded-full border-2 border-white shadow-md transform -translate-x-1/2"
          />
        </div>
      </div>

      {/* Hue color bar with dot */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs">Color: {hueDisplay}°</Label>
        </div>
        <div
          ref={hueBarRef}
          className="h-12 rounded-md w-full relative cursor-pointer"
          style={{
            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
          }}
          onMouseDown={(e) => {
            handleHueChange(e.clientX);

            const handleMouseMove = (e: MouseEvent) => {
              handleHueChange(e.clientX);
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleHueChange(e.touches[0].clientX);

            const handleTouchMove = (e: TouchEvent) => {
              handleHueChange(e.touches[0].clientX);
            };

            const handleTouchEnd = () => {
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
            };

            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
          }}
        >
          <div
            ref={hueDotRef}
            className="absolute top-0 bottom-0 w-8 h-8 my-auto rounded-full border-2 border-white shadow-md transform -translate-x-1/2"
          />
        </div>
      </div>
    </div>
  );
}
