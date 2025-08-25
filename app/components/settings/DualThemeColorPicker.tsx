"use client";

import React, { useState } from 'react';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../lib/utils';
import { Sun, Moon, Palette } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import OKLCHColorSlider from './OKLCHColorSlider';
import { OKLCHColor, oklchToHex } from '../../lib/oklch-utils';

interface DualThemeColorPickerProps {
  className?: string;
}

export default function DualThemeColorPicker({ className }: DualThemeColorPickerProps) {
  const { 
    lightColor, 
    darkColor, 
    setLightColor, 
    setDarkColor, 
    getCurrentThemeColor,
    setCurrentThemeColor 
  } = useAccentColor();
  const { theme, resolvedTheme } = useTheme();
  const [activeMode, setActiveMode] = useState<'light' | 'dark'>(resolvedTheme === 'dark' ? 'dark' : 'light');

  const handleColorChange = (hex: string) => {
    // The OKLCHColorSlider returns hex, but we need to convert it to OKLCH
    // and store it in the appropriate mode
    const { hexToOklch } = require('../../lib/oklch-utils');
    const oklch = hexToOklch(hex);
    if (oklch) {
      if (activeMode === 'light') {
        setLightColor(oklch);
      } else {
        setDarkColor(oklch);
      }
    }
  };

  const currentColor = activeMode === 'light' ? lightColor : darkColor;
  const currentHex = oklchToHex(currentColor);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Theme Mode Selector */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Color Mode</Label>
        <div className="flex gap-2">
          <Button
            variant={activeMode === 'light' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveMode('light')}
            className="flex items-center gap-2"
          >
            <Sun className="h-4 w-4" />
            Light Mode
          </Button>
          <Button
            variant={activeMode === 'dark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveMode('dark')}
            className="flex items-center gap-2"
          >
            <Moon className="h-4 w-4" />
            Dark Mode
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Set different accent colors for light and dark themes
        </p>
      </div>

      {/* Color Preview */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {activeMode === 'light' ? 'Light Mode' : 'Dark Mode'} Color Preview
        </Label>
        <div className="flex items-center gap-3">
          <div 
            className="w-16 h-16 rounded-lg border-2 border-border shadow-sm"
            style={{ backgroundColor: currentHex }}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">{currentHex.toUpperCase()}</p>
            <p className="text-xs text-muted-foreground">
              H: {currentColor.h.toFixed(0)}° L: {(currentColor.l * 100).toFixed(0)}% C: {(currentColor.c * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Color Sliders */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">
          Adjust {activeMode === 'light' ? 'Light Mode' : 'Dark Mode'} Color
        </Label>
        <OKLCHColorSlider
          value={currentHex}
          onChange={handleColorChange}
          limits={{
            lightness: activeMode === 'dark'
              ? { min: 0.50, max: 1.0 }  // Dark mode: 50-100% for better readability
              : { min: 0.0, max: 0.70 }, // Light mode: 0-70% for better readability
            chroma: { min: 0, max: 0.37 },
            hue: { min: 0, max: 360 }
          }}
        />
      </div>

      {/* Both Colors Preview */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Both Themes Preview</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <span className="text-sm">Light Mode</span>
            </div>
            <div 
              className="w-full h-12 rounded-lg border-2 border-border shadow-sm"
              style={{ backgroundColor: oklchToHex(lightColor) }}
            />
            <p className="text-xs text-muted-foreground text-center">
              {oklchToHex(lightColor).toUpperCase()}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <span className="text-sm">Dark Mode</span>
            </div>
            <div 
              className="w-full h-12 rounded-lg border-2 border-border shadow-sm"
              style={{ backgroundColor: oklchToHex(darkColor) }}
            />
            <p className="text-xs text-muted-foreground text-center">
              {oklchToHex(darkColor).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Current Theme Indicator */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <Palette className="h-4 w-4" />
          <span>Currently using: </span>
          <strong>{resolvedTheme === 'dark' ? 'Dark' : 'Light'} Mode</strong>
          <div 
            className="w-4 h-4 rounded border border-border ml-auto"
            style={{ backgroundColor: oklchToHex(getCurrentThemeColor()) }}
          />
        </div>
      </div>
    </div>
  );
}
