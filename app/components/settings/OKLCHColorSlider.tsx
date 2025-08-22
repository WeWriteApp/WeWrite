"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { hexToOklch, oklchToHex, OKLCHColor } from '../../lib/oklch-utils';
import { Label } from '../ui/label';
import ColorSlider from './ColorSlider';

interface ColorLimits {
  lightness?: { min: number; max: number };
  chroma?: { min: number; max: number };
  hue?: { min: number; max: number };
}

interface OKLCHColorSliderProps {
  value: string; // hex color (for compatibility with existing API)
  onChange: (color: string) => void; // returns hex (for compatibility)
  className?: string;
  limits?: ColorLimits; // Optional limits for each component
  hiddenSliders?: ('lightness' | 'chroma' | 'hue')[]; // Optional array of sliders to hide
}

export default function OKLCHColorSlider({
  value,
  onChange,
  className,
  limits,
  hiddenSliders = []
}: OKLCHColorSliderProps) {
  // Initialize with the actual value prop, not hardcoded defaults
  const [oklch, setOklch] = useState<OKLCHColor>(() => {
    const converted = hexToOklch(value);
    return converted || { l: 0.56, c: 0.66, h: 285 }; // Fallback only if conversion fails
  });
  const [lastExternalHex, setLastExternalHex] = useState<string>(value);

  // Only update OKLCH when external hex value changes significantly
  // This prevents feedback loops from our own onChange calls
  useEffect(() => {
    if (value !== lastExternalHex) {
      const converted = hexToOklch(value);
      if (converted) {
        // Only update if the change is significant (not from precision loss)
        const currentHex = oklchToHex(oklch);
        if (value.toLowerCase() !== currentHex.toLowerCase()) {
          // Preserve hue precision when chroma is very low
          if (converted.c < 0.01 && oklch.c < 0.01) {
            // When both old and new chroma are very low, preserve the existing hue
            converted.h = oklch.h;
          }
          setOklch(converted);
          setLastExternalHex(value);
        }
      }
    }
  }, [value, lastExternalHex]); // Removed oklch from dependencies to prevent feedback loops



  // Get effective limits with defaults
  const effectiveLimits = {
    lightness: limits?.lightness || { min: 0, max: 1 },
    chroma: limits?.chroma || { min: 0, max: 1 },
    hue: limits?.hue || { min: 0, max: 360 }
  };



  // Generate dynamic gradient backgrounds that reflect current slider values
  const gradients = useMemo(() => {
    // Lightness gradient: shows current hue/chroma at different lightness levels
    const lightnessSteps = [];
    const lMin = effectiveLimits.lightness.min;
    const lMax = effectiveLimits.lightness.max;
    for (let i = 0; i <= 20; i++) {
      const l = lMin + (lMax - lMin) * (i / 20);
      const color = oklchToHex({ l, c: oklch.c, h: oklch.h });
      lightnessSteps.push(color);
    }

    // Chroma gradient: shows current hue/lightness at different chroma levels
    const chromaSteps = [];
    const cMin = effectiveLimits.chroma.min;
    const cMax = effectiveLimits.chroma.max;
    for (let i = 0; i <= 20; i++) {
      const c = cMin + (cMax - cMin) * (i / 20);
      const color = oklchToHex({ l: oklch.l, c, h: oklch.h });
      chromaSteps.push(color);
    }

    // Hue gradient: shows current lightness/chroma at different hues
    const hueSteps = [];
    const hMin = effectiveLimits.hue.min;
    const hMax = effectiveLimits.hue.max;
    for (let i = 0; i <= 24; i++) {
      const h = hMin + (hMax - hMin) * (i / 24);
      const color = oklchToHex({ l: oklch.l, c: oklch.c, h });
      hueSteps.push(color);
    }

    return {
      lightness: `linear-gradient(to right, ${lightnessSteps.join(', ')})`,
      chroma: `linear-gradient(to right, ${chromaSteps.join(', ')})`,
      hue: `linear-gradient(to right, ${hueSteps.join(', ')})`
    };
  }, [oklch.l, oklch.c, oklch.h, effectiveLimits]); // Regenerate when any value changes

  // Handle individual slider changes - work purely in OKLCH space with limits
  const handleLightnessChange = (value: number[]) => {
    const normalizedValue = Math.max(effectiveLimits.lightness.min, Math.min(effectiveLimits.lightness.max, value[0] / 100));
    const newOklch = { ...oklch, l: normalizedValue };
    setOklch(newOklch);
    const hex = oklchToHex(newOklch);
    setLastExternalHex(hex); // Prevent useEffect feedback loop
    onChange(hex);
  };

  const handleChromaChange = (value: number[]) => {
    const normalizedValue = Math.max(effectiveLimits.chroma.min, Math.min(effectiveLimits.chroma.max, value[0] / 100));
    // Preserve the exact hue value when changing chroma to prevent drift
    const newOklch = { ...oklch, c: normalizedValue, h: oklch.h };
    setOklch(newOklch);
    const hex = oklchToHex(newOklch);
    setLastExternalHex(hex); // Prevent useEffect feedback loop
    onChange(hex);
  };

  const handleHueChange = (value: number[]) => {
    const normalizedValue = Math.max(effectiveLimits.hue.min, Math.min(effectiveLimits.hue.max, value[0]));
    const newOklch = { ...oklch, h: normalizedValue };
    setOklch(newOklch);
    const hex = oklchToHex(newOklch);
    setLastExternalHex(hex); // Prevent useEffect feedback loop
    onChange(hex);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Hue Slider - First for accent colors */}
      {!hiddenSliders.includes('hue') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Hue</Label>
            <span className="text-sm text-muted-foreground">{oklch.h.toFixed(0)}°</span>
          </div>
          <ColorSlider
            value={oklch.h}
            onChange={(value) => handleHueChange([value])}
            min={effectiveLimits.hue.min}
            max={effectiveLimits.hue.max}
            step={1}
            gradient={gradients.hue}
          />
        </div>
      )}

      {/* Lightness Slider */}
      {!hiddenSliders.includes('lightness') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Lightness</Label>
            <span className="text-sm text-muted-foreground">{(oklch.l * 100).toFixed(1)}%</span>
          </div>
          <ColorSlider
            value={oklch.l * 100}
            onChange={(value) => handleLightnessChange([value])}
            min={effectiveLimits.lightness.min * 100}
            max={effectiveLimits.lightness.max * 100}
            step={1}
            gradient={gradients.lightness}
          />
        </div>
      )}

      {/* Chroma Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Chroma</Label>
          <span className="text-sm text-muted-foreground">{(oklch.c * 100).toFixed(1)}%</span>
        </div>
        <ColorSlider
          value={oklch.c * 100}
          onChange={(value) => handleChromaChange([value])}
          min={effectiveLimits.chroma.min * 100}
          max={effectiveLimits.chroma.max * 100}
          step={0.5}
          gradient={gradients.chroma}
        />
      </div>
    </div>
  );
}
