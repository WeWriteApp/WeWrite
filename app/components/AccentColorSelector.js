"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES } from '../contexts/AccentColorContext';
import { cn } from '../lib/utils';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export default function AccentColorSelector() {
  const { accentColor, customColor, changeAccentColor, setCustomColor } = useAccentColor();
  const [showCustomInput, setShowCustomInput] = useState(accentColor === ACCENT_COLORS.CUSTOM);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [tempColor, setTempColor] = useState(customColor);
  const colorPickerRef = useRef(null);

  // Initialize color picker when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Set initial color value
      if (colorPickerRef.current) {
        colorPickerRef.current.value = customColor.startsWith('#')
          ? customColor
          : rgbToHex(customColor);
      }
    }
  }, [customColor]);

  // Convert RGB/HSL to hex for the color input
  const rgbToHex = (color) => {
    // If it's already a hex color, return it
    if (color.startsWith('#')) return color;

    // Create a temporary element to convert the color
    const tempEl = document.createElement('div');
    tempEl.style.color = color;
    document.body.appendChild(tempEl);
    const computedColor = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);

    // Convert RGB to hex
    const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [_, r, g, b] = rgbMatch;
      return `#${Number(r).toString(16).padStart(2, '0')}${Number(g).toString(16).padStart(2, '0')}${Number(b).toString(16).padStart(2, '0')}`;
    }

    return '#3b82f6'; // Default to blue if conversion fails
  };

  const handleColorSelect = (color) => {
    console.log('Color selected:', color);
    changeAccentColor(color);
    setShowCustomInput(color === ACCENT_COLORS.CUSTOM);
    if (color === ACCENT_COLORS.CUSTOM) {
      setIsColorPickerOpen(true);
    }
  };

  const handleCustomColorChange = (e) => {
    const newColor = e.target.value;
    setTempColor(newColor);
  };

  const handleCustomColorApply = (e) => {
    console.log('Applying custom color:', tempColor);
    setCustomColor(tempColor);
    changeAccentColor(ACCENT_COLORS.CUSTOM, tempColor);
  };

  const handleColorPickerChange = (e) => {
    const hexColor = e.target.value;
    console.log('Color picker changed:', hexColor);
    setTempColor(hexColor);
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
      <div className="grid grid-cols-2 gap-2 mb-3">
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
        <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
          <PopoverTrigger asChild>
            <div className="px-2 mt-2">
              <Label htmlFor="custom-color" className="text-xs mb-1 block">
                Custom Color (click to open color picker)
              </Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-md cursor-pointer border border-input"
                  style={{ backgroundColor: tempColor }}
                />
                <Input
                  id="custom-color"
                  type="text"
                  value={tempColor}
                  onChange={handleCustomColorChange}
                  onBlur={handleCustomColorApply}
                  placeholder="hsl(217, 91%, 60%) or #3b82f6"
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="color-picker" className="text-xs">
                Pick a color
              </Label>
              <input
                ref={colorPickerRef}
                id="color-picker"
                type="color"
                value={tempColor.startsWith('#') ? tempColor : '#3b82f6'}
                onChange={handleColorPickerChange}
                className="w-32 h-32 cursor-pointer"
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
