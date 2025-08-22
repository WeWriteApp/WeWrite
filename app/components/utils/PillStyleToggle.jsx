"use client";

import React from "react";
import { usePillStyle, PILL_STYLES } from "../../contexts/PillStyleContext";
import { Label } from "../ui/label";
import PillLink from "./PillLink";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";
import { useAccentColor } from "../../contexts/AccentColorContext";
import { hexToOklch } from "../../lib/oklch-utils";

export default function PillStyleToggle() {
  const { pillStyle, changePillStyle, getPillStyleClasses } = usePillStyle();
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
      styleClasses = `bg-accent-100 border border-accent-100 ${textColorClass} px-2 py-0.5`;
    } else if (style === PILL_STYLES.OUTLINE) {
      styleClasses = `bg-transparent text-accent-100 border border-accent-70 px-2 py-0.5`;
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

  const pillOptions = [
    { style: PILL_STYLES.FILLED, label: 'Filled' },
    { style: PILL_STYLES.OUTLINE, label: 'Outlined' },
    { style: PILL_STYLES.TEXT_ONLY, label: 'Text only' },
    { style: PILL_STYLES.UNDERLINED, label: 'Underlined' }
  ];

  return (
    <div className="space-y-4">
      {/* Grid layout: 2x2 on small screens and up, stack on very small screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pillOptions.map(({ style, label }) => (
          <button
            key={style}
            onClick={() => changePillStyle(style)}
            data-pill-style={style}
            data-active={pillStyle === style}
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-4 text-sm rounded-lg transition-all duration-200 wewrite-interactive-card relative",
              pillStyle === style && "wewrite-active-state"
            )}
          >
            {/* Centered pill preview */}
            <PillPreview style={style} label={label} />

            {/* Check icon for selected state */}
            {pillStyle === style && (
              <Check className="h-4 w-4 text-primary absolute top-2 right-2" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}