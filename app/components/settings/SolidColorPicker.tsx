"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAppBackground, SolidBackground, ImageBackground } from '../../contexts/AppBackgroundContext';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface SolidColorPickerProps {
  className?: string;
}

// Note: This component works with hex colors, but the AppBackgroundContext
// automatically converts them to OKLCH for better color consistency

export default function SolidColorPicker({ className }: SolidColorPickerProps) {
  const { background, setBackground, defaultSolidBackgrounds } = useAppBackground();
  const { theme } = useTheme();
  const [customColor, setCustomColor] = useState('#f8fafc');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const currentSolidColor = background.type === 'solid' ? background.color : '#f8fafc';

  const handlePresetSelect = (bg: SolidBackground) => {
    setBackground(bg);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    const newBackground: SolidBackground = { type: 'solid', color };
    setBackground(newBackground);
  };

  const handleImageUpload = () => {
    if (imageUrl.trim()) {
      const newBackground: ImageBackground = { type: 'image', url: imageUrl.trim() };
      setBackground(newBackground);
    }
  };

  const isColorSelected = (bg: SolidBackground) => {
    if (background.type !== 'solid') return false;
    const isDark = theme === 'dark';
    const expectedColor = isDark && bg.darkColor ? bg.darkColor : bg.color;
    return background.color.toLowerCase() === expectedColor.toLowerCase();
  };

  const getDisplayColor = (bg: SolidBackground) => {
    const isDark = theme === 'dark';
    return isDark && bg.darkColor ? bg.darkColor : bg.color;
  };

  return (
    <div className={cn("space-y-6", className)}>

      {/* Preset Colors Grid */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Preset Colors</Label>
        <div className="grid grid-cols-4 gap-3">
          {defaultSolidBackgrounds.map((bg, index) => (
            <button
              key={index}
              onClick={() => handlePresetSelect(bg)}
              className={cn(
                "relative w-full h-12 rounded-lg border-2 transition-all duration-200",
                "hover:scale-105 hover:shadow-md",
                isColorSelected(bg)
                  ? "border-primary shadow-lg"
                  : "border-neutral-20 hover:border-neutral-30"
              )}
              style={{ backgroundColor: getDisplayColor(bg) }}
              aria-label={`Select background color`}
            >
              {isColorSelected(bg) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/90 rounded-full p-1">
                    <Icon name="Check" size={16} className="text-primary" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Image Background */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Image Background</Label>
        <div className="space-y-3">
          <div className="flex gap-3">
            <Input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1"
            />
            <Button
              onClick={handleImageUpload}
              disabled={!imageUrl.trim()}
              className="gap-2"
            >
              <Icon name="Upload" size={16} />
              Set Image
            </Button>
          </div>
          {background.type === 'image' && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Icon name="Image" size={20} className=" text-primary" />
              <div>
                <p className="text-sm font-medium">Image Background Active</p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">
                  {background.url}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Color Picker */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Custom Color</Label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCustomPicker(!showCustomPicker)}
            className="gap-2"
          >
            <Icon name="Palette" size={16} />
            {showCustomPicker ? 'Hide' : 'Show'} Picker
          </Button>
        </div>

        {showCustomPicker && (
          <div className="space-y-3">
            {/* Color Input */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="color"
                  value={customColor}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="h-12 w-full cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <Input
                  type="text"
                  value={customColor}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                      setCustomColor(value);
                      if (value.length === 7) {
                        handleCustomColorChange(value);
                      }
                    }
                  }}
                  placeholder="#f8fafc"
                  className="h-12"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Selection Info */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          {background.type === 'solid' ? (
            <>
              <div
                className="w-6 h-6 rounded-md border border-border"
                style={{ backgroundColor: getDisplayColor(background) }}
              />
              <div>
                <p className="text-sm font-medium">Solid Color Background</p>
                <p className="text-xs text-muted-foreground">
                  {getDisplayColor(background)}
                </p>
              </div>
            </>
          ) : background.type === 'image' ? (
            <>
              <Icon name="Image" size={24} className=" text-primary" />
              <div>
                <p className="text-sm font-medium">Image Background</p>
                <p className="text-xs text-muted-foreground">
                  Active
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-6 h-6 rounded-md border border-border bg-muted" />
              <div>
                <p className="text-sm font-medium">Default Background</p>
                <p className="text-xs text-muted-foreground">
                  System default
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
