'use client';

import { useState, useEffect, useRef } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import OKLCHColorSlider from './OKLCHColorSlider';
import DualThemeColorPicker from './DualThemeColorPicker';
import { BackgroundImageUpload } from './BackgroundImageUpload';
import ColorSlider from './ColorSlider';
import BackgroundOptionsCard from './BackgroundOptionsCard';
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
    <div className="wewrite-card wewrite-card-no-padding">
      <div
        className="cursor-pointer hover:bg-muted/50 transition-colors p-4"
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
          <div className="px-4 pb-4">
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
      {/* Accent Colors - Independent Light/Dark Mode */}
      <CollapsibleColorCard
        title="Accent Color"
        description="Set different accent colors for light and dark themes"
        color={oklchToHex(accentOklch)}
        isExpanded={expandedCard === 'accent'}
        onToggle={toggleAccent}
      >
        <DualThemeColorPicker />
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
        <BackgroundOptionsCard />
      </CollapsibleColorCard>
    </div>
  );
}
