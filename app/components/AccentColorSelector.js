"use client";

import React, { useState } from 'react';
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES, getTextColorForBackground } from '../contexts/AccentColorContext';
import { cn } from '../lib/utils';
import { Label } from './ui/label';
import { Palette } from 'lucide-react';

export default function AccentColorSelector() {
  const { accentColor, customColor, changeAccentColor, setCustomColor } = useAccentColor();
  const [showCustomInput, setShowCustomInput] = useState(accentColor === ACCENT_COLORS.CUSTOM);

  const handleColorSelect = (color) => {
    console.log('Color selected:', color);
    changeAccentColor(color);
    setShowCustomInput(color === ACCENT_COLORS.CUSTOM);
  };

  const handleColorPickerChange = (e) => {
    const hexColor = e.target.value;
    console.log('Color picker changed:', hexColor);
    setCustomColor(hexColor);
    changeAccentColor(ACCENT_COLORS.CUSTOM, hexColor);
  };

  const colorOptions = [
    { name: 'Blue', value: ACCENT_COLORS.BLUE, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.BLUE] },
    { name: 'Red', value: ACCENT_COLORS.RED, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.RED] },
    { name: 'Green', value: ACCENT_COLORS.GREEN, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.GREEN] },
    { name: 'Custom', value: ACCENT_COLORS.CUSTOM, color: customColor }
  ];

  return (
    <div className="mb-8">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Accent Color</h3>
      <div className="space-y-1 mb-4">
        {colorOptions.map((option) => {
          // Calculate text color based on background color for better contrast
          const textColor = option.value !== ACCENT_COLORS.CUSTOM
            ? getTextColorForBackground(option.color)
            : 'currentColor';

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
                  {option.value === ACCENT_COLORS.CUSTOM && (
                    <Palette className="h-4 w-4 text-white" />
                  )}
                </div>

                {/* Text */}
                <span className="text-sm">
                  {option.name}
                </span>
              </button>

              {/* Edit button for custom color */}
              {option.value === ACCENT_COLORS.CUSTOM && (
                <label htmlFor="native-color-picker" className="cursor-pointer p-2 hover:bg-accent rounded-full transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                    <path d="m15 5 4 4"></path>
                  </svg>
                  <input
                    id="native-color-picker"
                    type="color"
                    value={customColor.startsWith('#') ? customColor : '#3b82f6'}
                    onChange={handleColorPickerChange}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom color section removed - now using browser's native color picker */}
    </div>
  );
}
