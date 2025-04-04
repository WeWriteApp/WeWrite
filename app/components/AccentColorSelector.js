"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES, getTextColorForBackground } from '../contexts/AccentColorContext';
import { cn } from '../lib/utils';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Palette } from 'lucide-react';

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

  const handleCustomColorApply = () => {
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
      <div className="space-y-1 mb-4">
        {colorOptions.map((option) => {
          // Calculate text color based on background color for better contrast
          const textColor = option.value !== ACCENT_COLORS.CUSTOM
            ? getTextColorForBackground(option.color)
            : 'currentColor';

          return (
            <button
              key={option.value}
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
          );
        })}
      </div>

      {showCustomInput && (
        <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
          <PopoverTrigger asChild>
            <div className="px-3 mt-3">
              <Label htmlFor="custom-color" className="text-sm font-medium mb-2 block text-muted-foreground">
                Custom Color
              </Label>
              <div className="flex items-center gap-3 p-3 bg-accent/30 rounded-lg hover:bg-accent/50 transition-colors">
                <div
                  className="w-10 h-10 rounded-md cursor-pointer border border-input shadow-sm flex items-center justify-center relative group"
                  style={{ backgroundColor: tempColor }}
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                    <Palette className="h-5 w-5 text-white drop-shadow-md" />
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <Input
                    id="custom-color"
                    type="text"
                    value={tempColor}
                    onChange={handleCustomColorChange}
                    onBlur={handleCustomColorApply}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCustomColorApply();
                        e.target.blur();
                      }
                    }}
                    placeholder="#1768FF or hsl(217, 91%, 60%)"
                    className="h-10 text-sm border-input/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Click the color swatch to open color picker</p>
                </div>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 border border-input shadow-md">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="color-picker" className="text-sm font-medium">
                  Pick a custom color
                </Label>
                <div
                  className="w-6 h-6 rounded-full border border-input flex items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setIsColorPickerOpen(false)}
                >
                  <span className="text-xs">×</span>
                </div>
              </div>

              <div className="relative bg-gradient-to-br from-white to-gray-200 dark:from-gray-700 dark:to-gray-900 p-4 rounded-lg">
                {/* Color preview */}
                <div
                  className="w-full h-16 rounded-md mb-3 shadow-inner border border-input"
                  style={{ backgroundColor: tempColor }}
                />

                {/* Color picker */}
                <div className="relative">
                  <input
                    ref={colorPickerRef}
                    id="color-picker"
                    type="color"
                    value={tempColor.startsWith('#') ? tempColor : '#3b82f6'}
                    onChange={handleColorPickerChange}
                    className="w-full h-40 cursor-pointer rounded-md"
                  />
                  <Palette className="absolute top-2 right-2 h-5 w-5 text-white drop-shadow-md pointer-events-none" />
                </div>

                {/* Color info */}
                <div className="mt-3 flex justify-between items-center bg-background/80 backdrop-blur-sm p-2 rounded-md border border-input">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-md border border-input shadow-sm"
                      style={{ backgroundColor: tempColor }}
                    />
                    <span className="text-sm font-mono">{tempColor}</span>
                  </div>

                  <button
                    className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                    onClick={() => {
                      handleCustomColorApply();
                      setIsColorPickerOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
