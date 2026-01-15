"use client";

import React from "react";
import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { usePillStyle, UI_STYLES, type UIStyle } from "../../contexts/PillStyleContext";
import { cn } from "../../lib/utils";

/**
 * UIStyleToggle - Toggle between Shiny and Flat UI styles
 *
 * Shiny: Buttons, chips, and other UI elements have shimmer effects and glows
 * Flat: Clean, minimal UI without extra visual effects
 */
export default function UIStyleToggle() {
  const { uiStyle, changeUIStyle } = usePillStyle();

  const uiOptions: { style: UIStyle; label: string; description: string; icon: React.ReactNode }[] = [
    {
      style: UI_STYLES.SHINY,
      label: 'Shiny',
      description: 'Shimmer effects and glows on buttons and chips',
      icon: <Icon name="Sparkles" size={20} />
    },
    {
      style: UI_STYLES.FLAT,
      label: 'Flat',
      description: 'Clean, minimal UI without extra effects',
      icon: <Icon name="Square" size={20} />
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {uiOptions.map(({ style, label, description, icon }) => (
        <button
          key={style}
          onClick={() => changeUIStyle(style)}
          data-ui-style={style}
          data-active={uiStyle === style}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-4 text-sm border rounded-lg transition-[background-color,transform,opacity] duration-200 nav-hover-state outline-none focus:outline-none focus:ring-0",
            uiStyle === style
              ? "nav-selected-state border-accent"
              : "border-theme-medium"
          )}
        >
          {icon}
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground text-center">{description}</span>
          <Check
            className={cn(
              "h-4 w-4 text-primary transition-all duration-200",
              uiStyle === style
                ? "opacity-100 scale-100"
                : "opacity-0 scale-75"
            )}
          />
        </button>
      ))}
    </div>
  );
}
