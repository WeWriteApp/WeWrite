"use client";

import React from 'react';
import { useAppBackground } from '../../contexts/AppBackgroundContext';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../lib/utils';
import { Label } from '../ui/label';
import ColorSlider from './ColorSlider';

interface CardOpacityControlProps {
  className?: string;
}

export default function CardOpacityControl({ className }: CardOpacityControlProps) {
  const { cardOpacity, setCardOpacity, cardBlur, setCardBlur } = useAppBackground();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  // Create appropriate gradient based on theme - pure grayscale
  const opacityGradient = isDark
    ? 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.5))' // Dark: transparent to 50% white
    : 'linear-gradient(to right, transparent, rgba(255, 255, 255, 1))'; // Light: transparent to opaque white

  return (
    <div className={cn("space-y-6", className)}>
      {/* Card Opacity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Card Opacity</Label>
          <span className="text-sm text-muted-foreground">{Math.round(cardOpacity * 100)}%</span>
        </div>

        <ColorSlider
          value={cardOpacity * 100}  // Unified: Always use 0-1.0 to 0-100 mapping
          onChange={(value) => setCardOpacity(value / 100)}  // Unified: Always scale back to 0-1.0 range
          min={0}
          max={100}
          step={5}
          gradient={opacityGradient}
        />
      </div>

      {/* Card Blur */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Card Blur</Label>
          <span className="text-sm text-muted-foreground">{Math.round(cardBlur * 100)}%</span>
        </div>

        <ColorSlider
          value={cardBlur * 100}  // 0-1.0 to 0-100 mapping
          onChange={(value) => setCardBlur(value / 100)}  // Scale back to 0-1.0 range
          min={0}
          max={100}
          step={5}
          gradient="linear-gradient(to right, transparent, rgba(255, 255, 255, 0.3))"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Adjust card transparency and blur. In dark mode, cards brighten the background for better visibility. In light mode, cards overlay with white for clarity.
      </p>
    </div>
  );
}
