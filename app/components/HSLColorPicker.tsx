"use client";

import React, { useState, useEffect } from 'react';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { useAccentColor } from '../contexts/AccentColorContext';

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
  
  // State for HSL values
  const [hue, setHue] = useState(initialHSL.h);
  const [saturation, setSaturation] = useState(initialHSL.s);
  const [luminance, setLuminance] = useState(initialHSL.l);
  
  // Enforce luminance constraints to ensure good contrast
  const MIN_LUMINANCE = 20; // Prevent colors that are too dark
  const MAX_LUMINANCE = 80; // Prevent colors that are too light
  
  // Current color in HSL format
  const currentHSLColor = `hsl(${hue}, ${saturation}%, ${luminance}%)`;
  
  // Current color in hex format (for display and compatibility)
  const currentHexColor = hslToHex(hue, saturation, luminance);
  
  // Handle slider changes with constraints
  const handleLuminanceChange = (value: number[]) => {
    const newLuminance = Math.max(MIN_LUMINANCE, Math.min(MAX_LUMINANCE, value[0]));
    setLuminance(newLuminance);
  };
  
  // Apply the color
  const handleApply = () => {
    onApply(currentHSLColor);
  };
  
  return (
    <div className="space-y-4">
      {/* Color preview */}
      <div 
        className="h-12 w-full rounded-md border"
        style={{ backgroundColor: currentHSLColor }}
      />
      
      {/* Hue slider */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs">Hue: {hue}°</Label>
        </div>
        <div 
          className="h-4 rounded-md w-full" 
          style={{ 
            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
          }}
        >
          <Slider
            value={[hue]}
            min={0}
            max={359}
            step={1}
            onValueChange={(value) => setHue(value[0])}
            className="mt-[-8px]"
          />
        </div>
      </div>
      
      {/* Saturation slider */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs">Saturation: {saturation}%</Label>
        </div>
        <div 
          className="h-4 rounded-md w-full" 
          style={{ 
            background: `linear-gradient(to right, hsl(${hue}, 0%, ${luminance}%), hsl(${hue}, 100%, ${luminance}%))`
          }}
        >
          <Slider
            value={[saturation]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => setSaturation(value[0])}
            className="mt-[-8px]"
          />
        </div>
      </div>
      
      {/* Luminance slider with constraints */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-xs">Luminance: {luminance}%</Label>
          <Label className="text-xs text-muted-foreground">(Limited to {MIN_LUMINANCE}-{MAX_LUMINANCE}% for readability)</Label>
        </div>
        <div 
          className="h-4 rounded-md w-full" 
          style={{ 
            background: `linear-gradient(to right, hsl(${hue}, ${saturation}%, 0%), hsl(${hue}, ${saturation}%, 50%), hsl(${hue}, ${saturation}%, 100%))`
          }}
        >
          <Slider
            value={[luminance]}
            min={MIN_LUMINANCE}
            max={MAX_LUMINANCE}
            step={1}
            onValueChange={(value) => handleLuminanceChange(value)}
            className="mt-[-8px]"
          />
        </div>
      </div>
      
      {/* Hex color display */}
      <div className="flex items-center gap-2">
        <Label className="text-xs">Hex:</Label>
        <code className="bg-muted px-2 py-1 rounded text-xs">{currentHexColor}</code>
      </div>
      
      {/* Apply button */}
      <Button onClick={handleApply} size="sm" className="w-full">
        Apply Custom Color
      </Button>
    </div>
  );
}
