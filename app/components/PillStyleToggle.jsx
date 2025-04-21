"use client";

import React from "react";
import { usePillStyle, PILL_STYLES } from "../contexts/PillStyleContext";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { PillLink } from "./PillLink";

export default function PillStyleToggle() {
  const { pillStyle, changePillStyle } = usePillStyle();
  
  const handleToggle = (checked) => {
    changePillStyle(checked ? PILL_STYLES.OUTLINE : PILL_STYLES.FILLED);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Pill Style</Label>
          <p className="text-xs text-muted-foreground">
            Choose between filled or outline style for pill links
          </p>
        </div>
        <Switch
          checked={pillStyle === PILL_STYLES.OUTLINE}
          onCheckedChange={handleToggle}
          aria-label="Toggle pill style"
        />
      </div>
      
      {/* Preview */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md">
        <PillLink href="#" isPublic={true}>Example Page</PillLink>
        <PillLink href="#" isPublic={false}>Private Page</PillLink>
        <PillLink href="#" isPublic={true} variant="secondary">Secondary</PillLink>
      </div>
    </div>
  );
}
