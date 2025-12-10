"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, id, size = 'md', ...props }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    // Size variants
    const sizeClasses = {
      sm: "h-4 w-7",
      md: "h-6 w-11",
      lg: "h-7 w-14"
    };

    const thumbSizeClasses = {
      sm: "h-3 w-3",
      md: "h-5 w-5",
      lg: "h-6 w-6"
    };

    const thumbTranslateClasses = {
      sm: checked ? "translate-x-3" : "translate-x-0",
      md: checked ? "translate-x-5" : "translate-x-0",
      lg: checked ? "translate-x-7" : "translate-x-0"
    };

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        id={id}
        ref={ref}
        className={cn(
          // Base styles
          "peer inline-flex shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 ease-in-out",
          // Focus styles
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Disabled styles
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Size
          sizeClasses[size],
          // State-based colors
          checked
            ? "bg-primary shadow-inner"
            : "bg-alpha-10",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            // Base thumb styles
            "pointer-events-none block rounded-full shadow-md transition-transform duration-200 ease-in-out",
            // Thumb color - white in both states
            "bg-white",
            // Size
            thumbSizeClasses[size],
            // Transform based on state
            thumbTranslateClasses[size],
            // Add margin for proper positioning
            "ml-0.5"
          )}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch }