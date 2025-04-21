"use client";

import * as React from "react";
import { Palette, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { useAccentColor, ACCENT_COLORS, ACCENT_COLOR_VALUES } from "../contexts/AccentColorContext";
import { Button } from "./ui/button";

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
              "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors mb-1",
              "hover:bg-muted",
              accentColor === option.value && "bg-muted"
            )}
          >
            <div className="flex items-center">
              {/* Color indicator */}
              <div
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: option.color }}
              />

              {/* Text */}
              {!compact && (
                <span className="text-sm">{option.label}</span>
              )}
            </div>

            {accentColor === option.value && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default AccentColorSwitcher;
