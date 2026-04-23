'use client';

import { useState, useEffect } from 'react';

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import OKLCHColorSlider from './OKLCHColorSlider';
import DualThemeColorPicker from './DualThemeColorPicker';
import ColorSlider from './ColorSlider';
import { useAccentColor } from '@/contexts/AccentColorContext';
import { useTheme } from '@/providers/ThemeProvider';
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
  const { theme } = useTheme();

  // State for color systems - initialize with actual context values
  const [accentOklch, setAccentOklch] = useState<OKLCHColor>(() => {
    const converted = hexToOklch(accentColor);
    return converted || { l: 0.56, c: 0.66, h: 230 };
  });

  // State for collapsed/expanded cards (accordion behavior)
  const [expandedCard, setExpandedCard] = useState<'accent' | null>(null);

  // Toggle functions for accordion behavior
  const toggleAccent = () => setExpandedCard(expandedCard === 'accent' ? null : 'accent');

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

  // Handle accent color changes
  const handleAccentChange = (hex: string) => {
    const converted = hexToOklch(hex);
    if (converted) {
      setAccentOklch(converted);
      setAccentColor(hex);
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
    </div>
  );
}
