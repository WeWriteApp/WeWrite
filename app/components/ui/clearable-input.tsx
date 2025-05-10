"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Input, InputProps } from "./input"
import { cn } from "../../lib/utils"

export interface ClearableInputProps extends InputProps {
  onClear?: () => void
}

const ClearableInput = React.forwardRef<HTMLInputElement, ClearableInputProps>(
  ({ className, value, onChange, onClear, ...props }, ref) => {
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
    }

    return (
      <div className="relative w-full">
        <Input
          className={cn("pr-8", className)}
          value={value}
          onChange={onChange}
          ref={ref}
          {...props}
        />
        {value && String(value).length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear input"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }
)

ClearableInput.displayName = "ClearableInput"

export { ClearableInput }
