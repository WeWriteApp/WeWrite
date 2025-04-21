"use client";

import React, { useState } from 'react';
import { useAccentColor } from '../contexts/AccentColorContext';
import { Button } from './ui/button';
import { Palette } from 'lucide-react';
import { Label } from './ui/label';

export default function CustomColorPicker() {
  const { changeAccentColor, setCustomColor } = useAccentColor();
  const [color, setColor] = useState('#0052CC'); // Default blue
  
  const handleColorChange = (e) => {
    setColor(e.target.value);
  };
  
  const handleApplyColor = () => {
    const customColorKey = 'custom1';
    setCustomColor(customColorKey, color);
    changeAccentColor(customColorKey);
  };
  
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Custom Color</Label>
      </div>
      
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={handleColorChange}
          className="w-10 h-10 rounded cursor-pointer"
        />
        <div className="flex-1">
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
        <Button onClick={handleApplyColor} size="sm">
          Apply
        </Button>
      </div>
    </div>
  );
}
