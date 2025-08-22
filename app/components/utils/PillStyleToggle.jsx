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
    if (oklch && oklch.l > 0.70) {
      return 'black'; // Use black text for light backgrounds (>70% lightness)
    }
    return 'white'; // Use white text for dark backgrounds (≤70% lightness)
  };

  // Simple preview component that's completely isolated
  const PillPreview = ({ style, label }) => {
    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '0.875rem',
      fontWeight: '500',
      borderRadius: '0.5rem',
      padding: '0.125rem 0.5rem',
      cursor: 'pointer',
      transition: 'all 150ms ease-out'
    };

    let specificStyle = {};
    if (style === PILL_STYLES.FILLED) {
      specificStyle = {
        backgroundColor: 'oklch(var(--primary))',
        color: getFilledTextColor(),
        border: '1.5px solid oklch(var(--primary))'
      };
    } else if (style === PILL_STYLES.OUTLINE) {
      specificStyle = {
        backgroundColor: 'transparent',
        color: 'oklch(var(--primary))',
        border: '1.5px solid oklch(var(--primary))'
      };
    } else if (style === PILL_STYLES.TEXT_ONLY) {
      specificStyle = {
        backgroundColor: 'transparent',
        color: 'oklch(var(--primary))',
        border: 'none',
        fontWeight: 'bold',
        padding: '0 0.25rem'
      };
    } else if (style === PILL_STYLES.UNDERLINED) {
      specificStyle = {
        backgroundColor: 'transparent',
        color: 'oklch(var(--primary))',
        border: 'none',
        fontWeight: 'bold',
        textDecoration: 'underline',
        padding: '0 0.25rem'
      };
    }

    return (
      <span style={{ ...baseStyle, ...specificStyle }}>
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