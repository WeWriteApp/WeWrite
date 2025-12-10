"use client";

import React from "react";
import { usePillStyle, UI_STYLES, type UIStyle } from "../../contexts/PillStyleContext";
import { cn } from "../../lib/utils";
import { Sparkles, Square, Check } from "lucide-react";

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
      icon: <Sparkles className="h-5 w-5" />
    },
    {
      style: UI_STYLES.FLAT,
      label: 'Flat',
      description: 'Clean, minimal UI without extra effects',
      icon: <Square className="h-5 w-5" />
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
            "flex flex-col items-center justify-center gap-2 p-4 text-sm border rounded-lg transition-all duration-200 nav-hover-state",
            uiStyle === style
              ? "nav-selected-state border-accent"
              : "border-theme-medium"
          )}
        >
          {icon}
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground text-center">{description}</span>
          {uiStyle === style && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
