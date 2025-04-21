"use client";

import React, { useState, useEffect } from 'react';
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES, getTextColorForBackground, getColorName } from '../contexts/AccentColorContext';
import { cn } from '../lib/utils';
import { Label } from './ui/label';
import { Palette } from 'lucide-react';

export default function AccentColorSelector() {
  const { accentColor, customColors, colorNames, changeAccentColor, setCustomColor, getColorName } = useAccentColor();

  const handleColorSelect = (color: string) => {
    console.log('Color selected:', color);
    changeAccentColor(color);
  };

  // Force re-render when colorNames change
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Accent Color</Label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ACCENT_COLORS.map((color) => {
          const isSelected = accentColor === color;
          const colorValue = ACCENT_COLOR_VALUES[color];
          const textColor = getTextColorForBackground(colorValue);
          const name = getColorName(color);

          return (
            <button
              key={color}
              className={cn(
                "h-10 rounded-md transition-all duration-200 flex items-center justify-center",
                isSelected ? "ring-2 ring-offset-2 ring-offset-background ring-primary" : "hover:scale-105"
              )}
              style={{
                backgroundColor: colorValue,
                color: textColor,
              }}
              onClick={() => handleColorSelect(color)}
              title={name}
            >
              {isSelected && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <Label className="text-sm font-medium mb-2 block">Custom Colors</Label>
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(customColors).map((colorKey) => {
            const isSelected = accentColor === colorKey;
            const colorValue = customColors[colorKey];
            const textColor = getTextColorForBackground(colorValue);
            const name = colorNames[colorKey] || 'Custom';

            return (
              <button
                key={colorKey}
                className={cn(
                  "h-10 rounded-md transition-all duration-200 flex items-center justify-center",
                  isSelected ? "ring-2 ring-offset-2 ring-offset-background ring-primary" : "hover:scale-105"
                )}
                style={{
                  backgroundColor: colorValue,
                  color: textColor,
                }}
                onClick={() => handleColorSelect(colorKey)}
                title={name}
              >
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}

          {/* Add custom color button */}
          <button
            className="h-10 rounded-md border-dashed border-2 border-muted-foreground/30 flex items-center justify-center hover:border-muted-foreground/50 transition-colors"
            onClick={() => {
              // Generate a random color
              const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
              const newColorKey = `custom-${Date.now()}`;
              setCustomColor(newColorKey, randomColor);
              changeAccentColor(newColorKey);
            }}
            title="Add custom color"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-muted-foreground"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
