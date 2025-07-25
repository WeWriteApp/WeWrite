"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES } from "../../contexts/AccentColorContext";

interface AccentColorSwitcherProps {
  compact?: boolean;
}

export function AccentColorSwitcher({ compact = false }: AccentColorSwitcherProps) {
  const { accentColor, setAccentColor } = useAccentColor();

  // Define color options for the appearance settings
  const colorOptions = [
    { value: ACCENT_COLORS.BLUE, color: ACCENT_COLOR_VALUES.blue, label: "Blue" },
    { value: ACCENT_COLORS.PURPLE, color: ACCENT_COLOR_VALUES.purple, label: "Purple" },
    { value: ACCENT_COLORS.RED, color: ACCENT_COLOR_VALUES.red, label: "Red" },
    { value: ACCENT_COLORS.GREEN, color: ACCENT_COLOR_VALUES.green, label: "Green" },
    { value: ACCENT_COLORS.AMBER, color: ACCENT_COLOR_VALUES.amber, label: "Amber" },
    { value: ACCENT_COLORS.SKY, color: ACCENT_COLOR_VALUES.sky, label: "Sky" }
  ];

  return (
    <div className="grid grid-cols-6 gap-3">
      {colorOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => setAccentColor(option.value)}
          className={cn(
            "relative w-12 h-12 rounded-lg transition-all duration-200 hover:scale-105",
            "border-2 border-transparent",
            accentColor === option.value && "border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground"
          )}
          style={{ backgroundColor: option.color }}
          title={option.label}
        >
          {accentColor === option.value && (
            <Check className="h-5 w-5 text-white absolute inset-0 m-auto" />
          )}
        </button>
      ))}
    </div>
  );
}

export default AccentColorSwitcher;