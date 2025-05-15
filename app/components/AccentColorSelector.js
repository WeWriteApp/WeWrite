"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES, getTextColorForBackground, getColorName } from '../contexts/AccentColorContext';
import { cn } from '../lib/utils';
import { Label } from './ui/label';
import { Palette } from 'lucide-react';

export default function AccentColorSelector() {
  const { accentColor, customColors, colorNames, changeAccentColor, setCustomColor, getColorName } = useAccentColor();

  const handleColorSelect = (color) => {
    console.log('Color selected:', color);
    changeAccentColor(color);
  };

  // Force re-render when colorNames change
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // This will trigger a re-render when colorNames change
    forceUpdate({});
    console.log('Color names updated:', colorNames);
  }, [colorNames]);

  const handleColorPickerChange = (customSlot) => (e) => {
    const hexColor = e.target.value;
    console.log('Color picker changed:', hexColor, 'for slot:', customSlot);

    // First update the custom color which will also update the name
    setCustomColor(customSlot, hexColor);

    // Then change the accent color to use this custom color
    // We don't pass the color value here to avoid overriding the name
    setTimeout(() => {
      changeAccentColor(customSlot);
    }, 0);
  };

  // Use useMemo to recalculate colorOptions when dependencies change
  const colorOptions = React.useMemo(() => [
    { name: 'Blue', value: ACCENT_COLORS.BLUE, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.BLUE] },
    { name: 'Red', value: ACCENT_COLORS.RED, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.RED] },
    { name: 'Green', value: ACCENT_COLORS.GREEN, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.GREEN] },
    {
      name: colorNames[ACCENT_COLORS.CUSTOM1] || 'Custom 1',
      value: ACCENT_COLORS.CUSTOM1,
      color: customColors[ACCENT_COLORS.CUSTOM1]
    },
    {
      name: colorNames[ACCENT_COLORS.CUSTOM2] || 'Custom 2',
      value: ACCENT_COLORS.CUSTOM2,
      color: customColors[ACCENT_COLORS.CUSTOM2]
    },
    {
      name: colorNames[ACCENT_COLORS.CUSTOM3] || 'Custom 3',
      value: ACCENT_COLORS.CUSTOM3,
      color: customColors[ACCENT_COLORS.CUSTOM3]
    }
  ], [colorNames, customColors]);

  return (
    <div className="mb-8">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Accent Color</h3>
      <div className="space-y-1 mb-4">
        {colorOptions.map((option) => {
          // Calculate text color based on background color for better contrast
          const textColor = option.value.startsWith('custom')
            ? 'currentColor'
            : getTextColorForBackground(option.color);

          return (
            <div key={option.value} className="flex items-center">
              <button
                onClick={() => handleColorSelect(option.value)}
                className={cn(
                  "flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  accentColor === option.value && "bg-accent text-accent-foreground"
                )}
              >
                <div className="flex items-center justify-center w-5 h-5 rounded-full border mr-2">
                  {accentColor === option.value && (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  )}
                </div>

                {/* Color indicator */}
                <div
                  className="w-4 h-4 rounded-full mr-2"
                  style={{ backgroundColor: option.color }}
                >
                  {option.value.startsWith('custom') && (
                    <Palette className="h-4 w-4 text-white" />
                  )}
                </div>

                {/* Text */}
                <span className="text-sm">
                  {option.name}
                </span>
              </button>

              {/* Edit button for custom color */}
              {option.value.startsWith('custom') && (
                <label htmlFor={`color-picker-${option.value}`} className="cursor-pointer p-2 hover:bg-accent rounded-full transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                    <path d="m15 5 4 4"></path>
                  </svg>
                  <input
                    id={`color-picker-${option.value}`}
                    type="color"
                    value={option.color.startsWith('#') ? option.color : '#3b82f6'}
                    onChange={handleColorPickerChange(option.value)}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
