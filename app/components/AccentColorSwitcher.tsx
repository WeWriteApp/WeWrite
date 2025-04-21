"use client";

import * as React from "react";
import { Palette } from "lucide-react";
import { cn } from "../lib/utils";
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES } from "../contexts/AccentColorContext";

interface AccentColorSwitcherProps {
  compact?: boolean;
}

export function AccentColorSwitcher({ compact = false }: AccentColorSwitcherProps) {
  const { accentColor, changeAccentColor } = useAccentColor();

  // Define a limited set of colors for the sidebar switcher
  const colorOptions = [
    { value: ACCENT_COLORS.BLUE, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.BLUE], label: "Blue" },
    { value: ACCENT_COLORS.PURPLE, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.PURPLE], label: "Purple" },
    { value: ACCENT_COLORS.RED, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.RED], label: "Red" },
    { value: ACCENT_COLORS.GREEN, color: ACCENT_COLOR_VALUES[ACCENT_COLORS.GREEN], label: "Green" }
  ];

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Accent Color</h3>
      <div className="space-y-1">
        {colorOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => changeAccentColor(option.value)}
            className={cn(
              "flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors mb-1",
              "hover:bg-accent hover:text-accent-foreground",
              accentColor === option.value && "bg-accent text-accent-foreground"
            )}
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full border mr-2">
              {accentColor === option.value && (
                <div className="w-3 h-3 rounded-full bg-primary" />
              )}
            </div>

            {/* Color indicator */}
            <div className="flex items-center mr-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: option.color }}
              />
            </div>

            {/* Text */}
            {!compact && (
              <span className="text-sm">{option.label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default AccentColorSwitcher;
