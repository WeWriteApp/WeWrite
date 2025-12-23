import * as React from "react"

import { cn } from "../../lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Whether the textarea is in an error state */
  error?: boolean;
  /** Whether the textarea is in a warning state */
  warning?: boolean;
  /** Error message to display below the textarea */
  errorText?: string;
  /** Warning message to display below the textarea */
  warningText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, warning, errorText, warningText, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          className={cn(
            // Use global glassmorphic input style
            "wewrite-input",
            // Additional utility classes for textarea-specific behavior
            "flex min-h-[80px] w-full text-sm",
            error && "wewrite-input-error",
            warning && "wewrite-input-warning",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && errorText && (
          <p className="mt-1 text-sm text-destructive">{errorText}</p>
        )}
        {warning && warningText && (
          <p className="mt-1 text-sm text-warning">{warningText}</p>
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }