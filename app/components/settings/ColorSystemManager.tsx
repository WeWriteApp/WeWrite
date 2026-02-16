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
            className="w-10 h-10 rounded-md border border-border shadow-sm"
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
  const { accentColor, setAccentColor, getCurrentThemeColor } = useAccentColor();
  const { background, setBackground, lastUploadedImage } = useAppBackground();
  const { theme } = useTheme();
  const { hasActiveSubscription } = useSubscription();

  // State for color systems - initialize with actual context values
  const [accentOklch, setAccentOklch] = useState<OKLCHColor>(() => {
    const converted = hexToOklch(accentColor);
    return converted || { l: 0.56, c: 0.66, h: 230 };
  });
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
  const [expandedCard, setExpandedCard] = useState<'accent' | 'background' | null>(null);

  // Toggle functions for accordion behavior
  const toggleAccent = () => setExpandedCard(expandedCard === 'accent' ? null : 'accent');
  const toggleBackground = () => setExpandedCard(expandedCard === 'background' ? null : 'background');

  // Initialize from current accent color
  useEffect(() => {
    // Prefer theme-specific accent color for the swatch
    const themeColor = getCurrentThemeColor();
    if (themeColor) {
      setAccentOklch(themeColor);
      return;
    }

    const converted = hexToOklch(accentColor);
    if (converted) {
      setAccentOklch(converted);
    }
  }, [accentColor, getCurrentThemeColor]);

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

  // Handle accent color changes
  const handleAccentChange = (hex: string) => {
    const converted = hexToOklch(hex);
    if (converted) {
      setAccentOklch(converted);
      setAccentColor(hex);
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
      const newOklchStr = `${(backgroundWithAccentHue.l * 100).toFixed(2)}% ${backgroundWithAccentHue.c.toFixed(4)} ${backgroundWithAccentHue.h.toFixed(1)}`;

      // Get existing values if background is solid, otherwise use defaults
      const existingColor = background.type === 'solid' ? background.color : '#ffffff';
      const existingDarkColor = background.type === 'solid' ? background.darkColor : '#000000';
      const existingOklchLight = background.type === 'solid' ? background.oklchLight : '100.00% 0.0000 158.2';
      const existingOklchDark = background.type === 'solid' ? background.oklchDark : '0.00% 0.0000 0.0';

      setBackground({
        type: 'solid',
        color: isDark ? (existingColor || '#ffffff') : newHex,
        darkColor: isDark ? newHex : (existingDarkColor || '#000000'),
        oklchLight: isDark ? (existingOklchLight || '100.00% 0.0000 158.2') : newOklchStr,
        oklchDark: isDark ? newOklchStr : (existingOklchDark || '0.00% 0.0000 0.0')
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
