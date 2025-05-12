"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "../../lib/utils"

// Create a custom Switch component that wraps the Radix UI Switch
// This ensures we don't have nested button elements when used inside a Button
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => {
  // Create a custom handler for keyboard events to maintain accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      props.onCheckedChange?.(!props.checked);
    }
  };

  return (
    <div
      role="switch"
      tabIndex={0}
      aria-checked={props.checked}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        props.checked ? "data-state-checked" : "data-state-unchecked",
        className
      )}
      onClick={() => props.onCheckedChange?.(!props.checked)}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          props.checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </div>
  );
});

Switch.displayName = "Switch";

export { Switch }
