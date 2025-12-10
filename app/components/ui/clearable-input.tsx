"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Input, InputProps } from "./input"
import { cn } from "../../lib/utils"

export interface ClearableInputProps extends Omit<InputProps, 'rightIcon'> {
  onClear?: () => void
}

const ClearableInput = React.forwardRef<HTMLInputElement, ClearableInputProps>(
  ({ className, value, onChange, onClear, leftIcon, ...props }, ref) => {
    // Create an internal ref if one is not provided
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Combine the forwarded ref with our internal ref
    const setRefs = (element: HTMLInputElement) => {
      // Update our internal ref
      if (inputRef.current !== element) {
        inputRef.current = element;
      }

      // Forward the ref
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    const handleClear = () => {
      if (onChange) {
        // Create a synthetic event to simulate input change
        const event = {
          target: { value: "" }
        } as React.ChangeEvent<HTMLInputElement>
        onChange(event)
      }

      // Call the onClear callback if provided
      if (onClear) {
        onClear()
      }

      // Focus the input after clearing
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }

    const hasValue = value && String(value).length > 0;

    // Create the clear button as the right icon when there's a value
    const clearButton = hasValue ? (
      <button
        type="button"
        onClick={handleClear}
        className="text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
        aria-label="Clear input"
      >
        <X className="h-4 w-4" />
      </button>
    ) : undefined;

    return (
      <Input
        className={cn("pr-10", className)} /* Right padding for clear button */
        value={value}
        onChange={onChange}
        ref={setRefs}
        leftIcon={leftIcon}
        rightIcon={clearButton}
        {...props}
      />
    )
  }
)

ClearableInput.displayName = "ClearableInput"

export { ClearableInput }