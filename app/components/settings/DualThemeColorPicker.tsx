"use client";

import React, { useState } from 'react';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../lib/utils';
import { Sun, Moon } from 'lucide-react';
import { Button } from '../ui/button';
import OKLCHColorSlider from './OKLCHColorSlider';
import { oklchToHex } from '../../lib/oklch-utils';

interface DualThemeColorPickerProps {
  className?: string;
}

export default function DualThemeColorPicker({ className }: DualThemeColorPickerProps) {
  const {
    lightColor,
    darkColor,
    setLightColor,
    setDarkColor,
  } = useAccentColor();
  const { theme, resolvedTheme } = useTheme();
  const [activeMode, setActiveMode] = useState<'light' | 'dark'>(resolvedTheme === 'dark' ? 'dark' : 'light');

  // Determine if we're in system mode (show toggle) or explicit mode (no toggle)
  const isSystemMode = theme === 'system';

  // The mode we're actually editing - either from toggle (system) or current theme (explicit)
  const editingMode = isSystemMode ? activeMode : (resolvedTheme === 'dark' ? 'dark' : 'light');

  const handleColorChange = (hex: string) => {
    const { hexToOklch } = require('../../lib/oklch-utils');
    const oklch = hexToOklch(hex);
    if (oklch) {
      if (editingMode === 'light') {
        setLightColor(oklch);
      } else {
        setDarkColor(oklch);
      }
    }
  };

  const currentColor = editingMode === 'light' ? lightColor : darkColor;
  const currentHex = oklchToHex(currentColor);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Theme Mode Selector - Only show when using system theme */}
      {isSystemMode && (
        <div className="flex gap-2">
          <Button
            variant={activeMode === 'light' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveMode('light')}
            className="flex items-center gap-2 flex-1"
          >
            <Sun className="h-4 w-4" />
            Light
          </Button>
          <Button
            variant={activeMode === 'dark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveMode('dark')}
            className="flex items-center gap-2 flex-1"
          >
            <Moon className="h-4 w-4" />
            Dark
          </Button>
        </div>
      )}

      {/* Color Sliders */}
      <OKLCHColorSlider
        value={currentHex}
        onChange={handleColorChange}
        limits={{
          lightness: editingMode === 'dark'
            ? { min: 0.50, max: 1.0 }
            : { min: 0.0, max: 0.70 },
          chroma: { min: 0, max: 0.37 },
          hue: { min: 0, max: 360 }
        }}
      />
    </div>
  );
}
