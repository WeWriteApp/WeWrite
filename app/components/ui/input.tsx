"use client"

import * as React from "react"

import { cn } from "../../lib/utils"
import { usePillStyle, PILL_STYLES } from "../../contexts/PillStyleContext"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon to display on the left side of the input */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side of the input */
  rightIcon?: React.ReactNode;
  /** Additional className for the wrapper when icons are used */
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, wrapperClassName, value, defaultValue, ...props }, ref) => {
    // Track if input has value for icon coloring
    const [hasValue, setHasValue] = React.useState(() => {
      return !!(value || defaultValue);
    });

    // Get pill style to determine if shiny effect should be applied
    let pillStyle: string | undefined;
    try {
      const pillStyleContext = usePillStyle();
      pillStyle = pillStyleContext?.pillStyle;
    } catch {
      pillStyle = undefined;
    }
    const isShinyMode = pillStyle === PILL_STYLES.SHINY;
    const shinyClass = isShinyMode ? 'input-shiny-style' : '';

    // Update hasValue when controlled value changes
    React.useEffect(() => {
      if (value !== undefined) {
        setHasValue(!!value);
      }
    }, [value]);

    // If no icons, render simple input
    if (!leftIcon && !rightIcon) {
      return (
        <input
          type={type}
          className={cn(
            // Use global glassmorphic input style
            "wewrite-input",
            // Additional utility classes that don't conflict with glassmorphic styling
            "flex h-10 w-full text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium",
            shinyClass,
            className
          )}
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          {...props}
        />
      )
    }

    // With icons, wrap in a relative container
    // Extract width-related classes from className to apply to wrapper instead
    const classNameStr = className || '';
    const widthClasses = classNameStr.split(' ').filter(c =>
      c.startsWith('w-') || c.startsWith('max-w-') || c.startsWith('min-w-')
    ).join(' ');
    const otherClasses = classNameStr.split(' ').filter(c =>
      !c.startsWith('w-') && !c.startsWith('max-w-') && !c.startsWith('min-w-')
    ).join(' ');

    // Icon color classes - placeholder color when empty, text color when filled
    const iconColorClass = hasValue
      ? "text-foreground"
      : "text-muted-foreground/70";

    // Handle input changes to track hasValue for uncontrolled inputs
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        // Uncontrolled input
        setHasValue(!!e.target.value);
      }
      props.onChange?.(e);
    };

    return (
      <div className={cn("relative inline-flex", widthClasses, wrapperClassName)}>
        {leftIcon && (
          <div className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-10 transition-colors",
            iconColorClass
          )}>
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            // Use global glassmorphic input style
            "wewrite-input",
            // Additional utility classes that don't conflict with glassmorphic styling
            "flex h-10 w-full text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium",
            // Padding classes for icons
            leftIcon && "wewrite-input-left-icon",
            rightIcon && "wewrite-input-right-icon",
            shinyClass,
            otherClasses
          )}
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          {...props}
        />
        {rightIcon && (
          <div className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-10 transition-colors",
            iconColorClass
          )}>
            {rightIcon}
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }