'use client';

import { useState, useEffect, useRef } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import OKLCHColorSlider from './OKLCHColorSlider';
import { BackgroundImageUpload } from './BackgroundImageUpload';
import ColorSlider from './ColorSlider';
import { useAccentColor } from '@/contexts/AccentColorContext';
import { useNeutralColor } from '@/contexts/NeutralColorContext';
import { useAppBackground, type ImageBackground } from '@/contexts/AppBackgroundContext';
import { useTheme } from '@/providers/ThemeProvider';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { hexToOklch, oklchToHex, type OKLCHColor } from '@/lib/oklch-utils';

interface ColorSystemManagerProps {
  className?: string;
}

interface CollapsibleColorCardProps {
  title: string;
  description: string;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleColorCard({
  title,
  description,
  color,
  isExpanded,
  onToggle,
  children
}: CollapsibleColorCardProps) {
  return (
    <div className="wewrite-card">
      <div
        className="cursor-pointer hover:bg-muted/50 transition-colors p-6"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div
            className="w-12 h-8 rounded-lg border border-border shadow-sm"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleContent>
          <div className="p-6 pt-0">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function ColorSystemManager({ className }: ColorSystemManagerProps) {
  const { accentColor, setAccentColor } = useAccentColor();
  const { neutralColor, setNeutralColor } = useNeutralColor();
  const { background, setBackground, lastUploadedImage, backgroundBlur, setBackgroundBlur } = useAppBackground();
  const { theme } = useTheme();
  const { hasActiveSubscription } = useSubscription();

  // State for all three color systems - initialize with actual context values
  const [accentOklch, setAccentOklch] = useState<OKLCHColor>(() => {
    const converted = hexToOklch(accentColor);
    return converted || { l: 0.56, c: 0.66, h: 230 };
  });
  const [neutralOklch, setNeutralOklch] = useState<OKLCHColor | null>(null); // Start as null to indicate not initialized
  const [backgroundOklch, setBackgroundOklch] = useState<OKLCHColor>(() => {
    if (background.type === 'solid') {
      // Use theme-appropriate color for initialization
      const isDark = theme === 'dark';
      const bgColor = isDark && background.darkColor ? background.darkColor : background.color;
      const converted = hexToOklch(bgColor);
      return converted || { l: isDark ? 0.0 : 0.98, c: 0.01, h: 230 };
    }
    return { l: theme === 'dark' ? 0.0 : 0.98, c: 0.01, h: 230 };
  });

  // State for collapsed/expanded cards (accordion behavior)
  const [expandedCard, setExpandedCard] = useState<'accent' | 'neutral' | 'background' | null>(null);

  // Ref to track previous accent hue to prevent infinite loops
  const prevAccentHueRef = useRef<number>(accentOklch.h);

  // Toggle functions for accordion behavior
  const toggleAccent = () => setExpandedCard(expandedCard === 'accent' ? null : 'accent');
  const toggleNeutral = () => setExpandedCard(expandedCard === 'neutral' ? null : 'neutral');
  const toggleBackground = () => setExpandedCard(expandedCard === 'background' ? null : 'background');

  // Initialize from current accent color
  useEffect(() => {
    const converted = hexToOklch(accentColor);
    if (converted) {
      setAccentOklch(converted);
    }
  }, [accentColor]);

  // Initialize from current neutral color - always update when neutralColor changes
  useEffect(() => {
    const converted = hexToOklch(neutralColor);
    if (converted && accentOklch) {
      // Force neutral to use accent hue for consistency
      const neutralWithAccentHue = { ...converted, h: accentOklch.h };
      setNeutralOklch(neutralWithAccentHue);
    } else if (converted) {
      // Fallback to original color if accent not yet loaded
      setNeutralOklch(converted);
    } else {
      // Fallback if conversion fails
      setNeutralOklch({ l: 0.50, c: 0.05, h: 230 });
    }
  }, [neutralColor, accentOklch]);

  // Update neutral color hue when accent color hue changes
  useEffect(() => {
    if (accentOklch && neutralOklch && accentOklch.h !== neutralOklch.h) {
      const neutralWithAccentHue = { ...neutralOklch, h: accentOklch.h };
      setNeutralOklch(neutralWithAccentHue);
      // Update the context to persist the change
      setNeutralColor(oklchToHex(neutralWithAccentHue));
    }
  }, [accentOklch?.h, neutralOklch, setNeutralColor]);

  // Initialize from current background color (theme-aware)
  useEffect(() => {
    if (background.type === 'solid') {
      // Use theme-appropriate color
      const isDark = theme === 'dark';
      const colorToUse = isDark && background.darkColor ? background.darkColor : background.color;
      const converted = hexToOklch(colorToUse);
      if (converted) {
        // Only update if the color is significantly different to prevent loops
        const currentHex = oklchToHex(backgroundOklch);
        if (colorToUse.toLowerCase() !== currentHex.toLowerCase()) {
          setBackgroundOklch(converted);
        }
      }
    }
  }, [background, theme]); // Removed backgroundOklch from dependencies to prevent loops

  // Theme change handling - removed problematic lightness flipping
  // The background context already handles theme-appropriate colors

  // Handle accent color changes
  const handleAccentChange = (hex: string) => {
    const converted = hexToOklch(hex);
    if (converted) {
      setAccentOklch(converted);
      setAccentColor(hex);
    }
  };

  // Auto-update neutral and background hues when accent hue changes
  useEffect(() => {
    // Only update if the accent hue actually changed and neutral is initialized
    if (prevAccentHueRef.current !== accentOklch.h && neutralOklch) {
      // Update neutral color to use new accent hue
      const updatedNeutral = { ...neutralOklch, h: accentOklch.h };
      setNeutralOklch(updatedNeutral);
      setNeutralColor(oklchToHex(updatedNeutral));

      // Only update background color if it's currently a solid color (don't override image backgrounds)
      if (background.type === 'solid') {
        const updatedBackground = { ...backgroundOklch, h: accentOklch.h };
        setBackgroundOklch(updatedBackground);

        // Update background with theme-appropriate colors
        const isDark = theme === 'dark';
        const newHex = oklchToHex(updatedBackground);

        setBackground({
          type: 'solid',
          color: isDark ? (background.color || '#ffffff') : newHex,
          darkColor: isDark ? newHex : (background.darkColor || '#000000'),
          oklchLight: isDark ? (background.oklchLight || '100.00% 0.0000 158.2') : `${(updatedBackground.l * 100).toFixed(2)}% ${updatedBackground.c.toFixed(4)} ${updatedBackground.h.toFixed(1)}`,
          oklchDark: isDark ? `${(updatedBackground.l * 100).toFixed(2)}% ${updatedBackground.c.toFixed(4)} ${updatedBackground.h.toFixed(1)}` : (background.oklchDark || '0.00% 0.0000 0.0')
        });
      }

      // Update the ref to the new hue
      prevAccentHueRef.current = accentOklch.h;
    }
  }, [accentOklch.h]); // Only depend on accent hue

  // Handle neutral color changes - inherit hue from accent color
  const handleNeutralChange = (hex: string) => {
    const converted = hexToOklch(hex);
    if (converted) {
      // Force neutral to use accent hue
      const neutralWithAccentHue = { ...converted, h: accentOklch.h };
      setNeutralOklch(neutralWithAccentHue);
      setNeutralColor(oklchToHex(neutralWithAccentHue)); // Update the neutral color context
    }
  };

  // Handle background color changes - inherit hue from accent color
  const handleBackgroundChange = (hex: string) => {
    const converted = hexToOklch(hex);
    if (converted) {
      // Force background to use accent hue
      const backgroundWithAccentHue = { ...converted, h: accentOklch.h };
      setBackgroundOklch(backgroundWithAccentHue);

      // Update the background context with theme-appropriate colors
      const isDark = theme === 'dark';
      const newHex = oklchToHex(backgroundWithAccentHue);

      setBackground({
        type: 'solid',
        color: isDark ? (background.color || '#ffffff') : newHex, // Preserve light color when in dark mode
        darkColor: isDark ? newHex : (background.darkColor || '#000000'), // Preserve dark color when in light mode
        oklchLight: isDark ? (background.oklchLight || '100.00% 0.0000 158.2') : `${(backgroundWithAccentHue.l * 100).toFixed(2)}% ${backgroundWithAccentHue.c.toFixed(4)} ${backgroundWithAccentHue.h.toFixed(1)}`,
        oklchDark: isDark ? `${(backgroundWithAccentHue.l * 100).toFixed(2)}% ${backgroundWithAccentHue.c.toFixed(4)} ${backgroundWithAccentHue.h.toFixed(1)}` : (background.oklchDark || '0.00% 0.0000 0.0')
      });
    }
  };

  // Function to switch back to uploaded image
  const switchToUploadedImage = async () => {
    if (lastUploadedImage) {
      const imageBackground: ImageBackground = {
        type: 'image',
        url: lastUploadedImage,
        opacity: 0.15
      };
      setBackground(imageBackground);

      // Save the preference to ensure it persists across sessions
      try {
        await fetch('/api/user/background-preference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            backgroundType: 'image',
            backgroundData: imageBackground
          })
        });
        console.log('[Background Switch] Background preference saved');
      } catch (error) {
        console.warn('[Background Switch] Failed to save background preference:', error);
      }
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Accent Colors */}
      <CollapsibleColorCard
        title="Accent Color"
        description="Used for interactive elements, buttons, links, and highlights"
        color={oklchToHex(accentOklch)}
        isExpanded={expandedCard === 'accent'}
        onToggle={toggleAccent}
      >
        <OKLCHColorSlider
          value={oklchToHex(accentOklch)}
          onChange={handleAccentChange}
          limits={{
            lightness: theme === 'dark'
              ? { min: 0.50, max: 1.0 }  // Dark mode: 50-100% for better readability
              : { min: 0.0, max: 0.50 }, // Light mode: 0-50% for better readability
            chroma: { min: 0, max: 0.37 },
            hue: { min: 0, max: 360 }
          }}
        />
      </CollapsibleColorCard>

      {/* Neutral Colors - Only render when initialized */}
      {neutralOklch && (
        <CollapsibleColorCard
          title="Neutral Color"
          description="Desaturated versions of your accent color for text, borders, and UI elements"
          color={oklchToHex(neutralOklch)}
          isExpanded={expandedCard === 'neutral'}
          onToggle={toggleNeutral}
        >
          <OKLCHColorSlider
            value={oklchToHex(neutralOklch)}
            onChange={handleNeutralChange}
            hiddenSliders={['lightness', 'hue']} // Hide hue - inherits from accent
            limits={{
              chroma: { min: 0, max: 0.15 }, // Limit neutral colors to 15% chroma
            }}
          />
        </CollapsibleColorCard>
      )}

      {/* Background */}
      <CollapsibleColorCard
        title="Background"
        description="Choose a color or upload a custom image"
        color={oklchToHex(backgroundOklch)}
        isExpanded={expandedCard === 'background'}
        onToggle={toggleBackground}
      >
        <div className="space-y-4">
          {/* Color Option */}
          <div>
            <label className="text-sm font-medium mb-2 block">Background Color</label>
            <OKLCHColorSlider
              value={oklchToHex(backgroundOklch)}
              onChange={handleBackgroundChange}
              hiddenSliders={['hue']} // Hide hue - inherits from accent
              limits={{
                lightness: theme === 'dark'
                  ? { min: 0.0, max: 0.20 }   // Dark mode: 0-20% (black to very dark grey)
                  : { min: 0.80, max: 1.0 },  // Light mode: 80-100% (very light grey to white)
                chroma: { min: 0.0, max: 0.05 }, // Very limited chroma for backgrounds
              }}
            />
          </div>

          {/* Image Upload Option */}
          <div>
            <label className="text-sm font-medium mb-2 block">Background Image</label>
            <div className="space-y-3">
              {hasActiveSubscription ? (
                <>
                  <BackgroundImageUpload />

                  {/* Overlay Opacity Slider - only show when using image background */}
                  {background.type === 'image' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Overlay Opacity</label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((background.opacity || 0.15) * 100)}%
                        </span>
                      </div>
                      <ColorSlider
                        value={(background.opacity || 0.15) * 100}
                        onChange={(value) => {
                          const newOpacity = value / 100;
                          const updatedBackground: ImageBackground = {
                            ...background,
                            opacity: newOpacity
                          };
                          setBackground(updatedBackground);

                          // Immediately update the overlay for instant feedback
                          const root = document.documentElement;
                          const isDark = theme === 'dark';
                          const overlayColor = isDark ? '0.00% 0.0000 0.0' : '98.22% 0.0061 255.5';
                          root.style.setProperty('--background-overlay', `oklch(${overlayColor} / ${newOpacity})`);
                        }}
                        min={0}
                        max={100}
                        step={5}
                        gradient={`linear-gradient(to right, transparent, ${oklchToHex(backgroundOklch)})`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Adjust how much the background color overlays the image
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="wewrite-card bg-muted/30 border-dashed border-2 border-muted-foreground/20">
                  <div className="p-6 text-center space-y-3">
                    <div className="text-muted-foreground">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="font-medium text-foreground">Custom Background Images</h3>
                    <p className="text-sm text-muted-foreground">
                      Unlock custom background images by starting your subscription
                    </p>
                    <Button
                      onClick={() => window.location.href = '/settings/subscription'}
                      className="mt-4"
                    >
                      Start Subscription
                    </Button>
                  </div>
                </div>
              )}

              {/* Background Blur Slider - show for both image and solid backgrounds */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Background Blur</label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(backgroundBlur * 100)}%
                  </span>
                </div>
                <ColorSlider
                  value={backgroundBlur * 100}
                  onChange={(value) => setBackgroundBlur(value / 100)}
                  min={0}
                  max={100}
                  step={5}
                  gradient="linear-gradient(to right, transparent, rgba(255, 255, 255, 0.5))"
                />
                <p className="text-xs text-muted-foreground">
                  Add blur effect to the background (0-20px blur)
                </p>
              </div>

              {/* Switch back to uploaded image button - only show if we have an uploaded image and are currently using solid color */}
              {hasActiveSubscription && lastUploadedImage && background.type === 'solid' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={switchToUploadedImage}
                  className="w-full"
                >
                  Switch to Uploaded Image
                </Button>
              )}
            </div>
          </div>
        </div>
      </CollapsibleColorCard>
    </div>
  );
}
