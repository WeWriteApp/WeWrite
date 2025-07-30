"use client";

import React from "react";
import { usePillStyle, PILL_STYLES } from "../../contexts/PillStyleContext";
import { Label } from "../ui/label";
import PillLink from "./PillLink";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

export default function PillStyleToggle() {
  const { pillStyle, changePillStyle } = usePillStyle();

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-muted-foreground mb-3 px-2">Pill Style</Label>
        <div className="space-y-2">
          {/* Radio button for Filled style */}
          <button
            onClick={() => changePillStyle(PILL_STYLES.FILLED)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors",
              "hover:bg-muted",
              pillStyle === PILL_STYLES.FILLED && "bg-muted"
            )}
          >
            <span>Filled</span>
            {pillStyle === PILL_STYLES.FILLED && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>

          {/* Radio button for Outline style */}
          <button
            onClick={() => changePillStyle(PILL_STYLES.OUTLINE)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors",
              "hover:bg-muted",
              pillStyle === PILL_STYLES.OUTLINE && "bg-muted"
            )}
          >
            <span>Outlined</span>
            {pillStyle === PILL_STYLES.OUTLINE && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>

          {/* Radio button for Text Only style */}
          <button
            onClick={() => changePillStyle(PILL_STYLES.TEXT_ONLY)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors",
              "hover:bg-muted",
              pillStyle === PILL_STYLES.TEXT_ONLY && "bg-muted"
            )}
          >
            <span>Text only</span>
            {pillStyle === PILL_STYLES.TEXT_ONLY && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>

          {/* Radio button for Underlined style */}
          <button
            onClick={() => changePillStyle(PILL_STYLES.UNDERLINED)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors",
              "hover:bg-muted",
              pillStyle === PILL_STYLES.UNDERLINED && "bg-muted"
            )}
          >
            <span>Underlined</span>
            {pillStyle === PILL_STYLES.UNDERLINED && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md">
        <PillLink href="#" isPublic={true}>Example Page</PillLink>
      </div>
    </div>
  );
}