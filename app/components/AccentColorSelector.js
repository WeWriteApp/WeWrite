"use client";

import React, { useState } from 'react';
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES } from '../contexts/AccentColorContext';
import { cn } from '../lib/utils';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function AccentColorSelector() {
  const { accentColor, customColor, changeAccentColor, setCustomColor } = useAccentColor();
  const [showCustomInput, setShowCustomInput] = useState(accentColor === ACCENT_COLORS.CUSTOM);
  
  const handleColorSelect = (color) => {
    changeAccentColor(color);
    setShowCustomInput(color === ACCENT_COLORS.CUSTOM);
  };
  
  const handleCustomColorChange = (e) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    changeAccentColor(ACCENT_COLORS.CUSTOM, newColor);
  };
  
  const colorOptions = [
    { name: 'Red', value: ACCENT_COLORS.RED, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.RED] },
    { name: 'Orange', value: ACCENT_COLORS.ORANGE, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.ORANGE] },
    { name: 'Yellow', value: ACCENT_COLORS.YELLOW, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.YELLOW] },
    { name: 'Green', value: ACCENT_COLORS.GREEN, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.GREEN] },
    { name: 'Blue', value: ACCENT_COLORS.BLUE, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.BLUE] },
    { name: 'Purple', value: ACCENT_COLORS.PURPLE, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.PURPLE] },
    { name: 'Custom', value: ACCENT_COLORS.CUSTOM, color: customColor }
  ];
  
  return (
    <div className="mb-8">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Accent Color</h3>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {colorOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleColorSelect(option.value)}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-md transition-colors",
              accentColor === option.value ? "ring-2 ring-primary" : "hover:bg-accent"
            )}
            style={{ 
              backgroundColor: option.value === ACCENT_COLORS.CUSTOM 
                ? 'transparent' 
                : `${option.color}20` // 20% opacity version of the color
            }}
          >
            <div 
              className="w-6 h-6 rounded-full mb-1"
              style={{ backgroundColor: option.color }}
            />
            <span className="text-xs">{option.name}</span>
          </button>
        ))}
      </div>
      
      {showCustomInput && (
        <div className="px-2 mt-2">
          <Label htmlFor="custom-color" className="text-xs mb-1 block">
            Custom Color (HSL or HEX)
          </Label>
          <Input
            id="custom-color"
            type="text"
            value={customColor}
            onChange={handleCustomColorChange}
            placeholder="hsl(217, 91%, 60%) or #3b82f6"
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}
