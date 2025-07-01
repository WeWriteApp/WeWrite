"use client"

import * as React from "react"
import { Button } from "./button"
import type { ButtonProps } from "./button"
import { cn } from "../../lib/utils"

interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean
  loadingText?: string
}

/**
 * LoadingButton - A button that shows a loading spinner when in loading state
 *
 * @param isLoading Whether the button is in loading state
 * @param loadingText Text to display when button is loading
 * @param children Button content when not loading
 * @param className Additional classes
 * @param ...props Other button props
 */
export function LoadingButton({
  isLoading = false,
  loadingText,
  children,
  className,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      className={cn(className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="loader loader-sm"></div>
          {loadingText || children}
        </div>
      ) : (
        children
      )}
    </Button>
  )
}