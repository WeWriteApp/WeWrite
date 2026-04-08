"use client";

import React from "react";
import { usePillStyle, PILL_STYLES } from "../../contexts/PillStyleContext";
import { cn } from "../../lib/utils";
import { Icon } from "@/components/ui/Icon";

export default function PillStyleToggle() {
  const { pillStyle, changePillStyle, getPillStyleClasses } = usePillStyle();

  // Link style options (4 options)
  const pillOptions = [
    { style: PILL_STYLES.FILLED, label: 'Filled' },
    { style: PILL_STYLES.OUTLINE, label: 'Outlined' },
    { style: PILL_STYLES.TEXT_ONLY, label: 'Text only' },
    { style: PILL_STYLES.UNDERLINED, label: 'Underlined' }
  ];

  return (
    <div className="space-y-4">
      {/* Grid layout: responsive grid for 4 link style options */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pillOptions.map(({ style, label }) => (
          <button
            key={style}
            onClick={() => changePillStyle(style)}
            data-pill-style={style}
            data-active={pillStyle === style}
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-4 text-sm border rounded-lg transition-[background-color,transform,opacity] duration-200 nav-hover-state outline-none focus:outline-none focus:ring-0",
              pillStyle === style
                ? "nav-selected-state border-accent"
                : "border-theme-medium"
            )}
          >
            {/* Use the actual pill style classes from context for accurate preview */}
            <span className={getPillStyleClasses(undefined, style)}>
              {label}
            </span>
            <Icon
              name="Check"
              size={16}
              className={cn(
                "text-primary transition-all duration-200",
                pillStyle === style
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-75"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}