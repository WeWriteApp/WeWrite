"use client";

import React from "react";
import { usePillStyle, PILL_STYLES } from "../../contexts/PillStyleContext";
import { Label } from "../ui/label";
import PillLink from "./PillLink";
import { cn } from "../../lib/utils";
import { useAccentColor } from "../../contexts/AccentColorContext";
import { hexToOklch } from "../../lib/oklch-utils";
import { Check } from "lucide-react";

export default function PillStyleToggle() {
  const { pillStyle, changePillStyle, getPillStyleClasses, isShinyUI } = usePillStyle();
  const { accentColor } = useAccentColor();

  // Get dynamic text color for filled pills based on accent lightness
  const getFilledTextColor = () => {
    const oklch = hexToOklch(accentColor);
    if (oklch && oklch.l >= 0.80) {
      return 'black'; // Use black text for light backgrounds (≥80% lightness)
    }
    return 'white'; // Use white text for dark backgrounds (<80% lightness)
  };

  // Simple preview component that uses Tailwind classes with systematic color naming
  const PillPreview = ({ style, label }) => {
    // Base classes that apply to all pill styles
    const baseClasses = "inline-flex items-center text-sm font-medium rounded-lg transition-all duration-150 ease-out cursor-pointer";

    // Get dynamic text color class for filled pills
    const getFilledTextColorClass = () => {
      const oklch = hexToOklch(accentColor);
      if (oklch && oklch.l >= 0.80) {
        return 'text-black'; // Use black text for light backgrounds (≥80% lightness)
      }
      return 'text-white'; // Use white text for dark backgrounds (<80% lightness)
    };

    let styleClasses = '';
    if (style === PILL_STYLES.FILLED) {
      const textColorClass = getFilledTextColorClass();
      // Add shiny classes when shiny UI mode is enabled
      const shinyClasses = isShinyUI ? 'shiny-shimmer-base shiny-glow-base pill-shiny-style' : '';
      styleClasses = `bg-accent-100 border border-accent-100 ${textColorClass} px-2 py-0.5 ${shinyClasses}`;
    } else if (style === PILL_STYLES.OUTLINE) {
      // Add shiny classes for outline when shiny UI mode is enabled
      const shinyClasses = isShinyUI ? 'shiny-shimmer-base pill-outline-shiny-style' : '';
      styleClasses = `bg-transparent text-accent-100 border border-accent-70 px-2 py-0.5 ${shinyClasses}`;
    } else if (style === PILL_STYLES.TEXT_ONLY) {
      styleClasses = `bg-transparent text-accent-100 border-none font-bold px-1`;
    } else if (style === PILL_STYLES.UNDERLINED) {
      styleClasses = `bg-transparent text-accent-100 border-none font-bold underline px-1`;
    }

    return (
      <span className={`${baseClasses} ${styleClasses}`}>
        {label}
      </span>
    );
  };

  // Link style options (4 options, no shiny - that's now a UI style)
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
            {/* Centered pill preview */}
            <PillPreview style={style} label={label} />
            <Check
              className={cn(
                "h-4 w-4 text-primary transition-all duration-200",
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