"use client"

/**
 * IconButton - A convenience wrapper around Button for icon-only buttons
 * 
 * This component is now a thin wrapper around Button with size="icon" as the default.
 * All button variants and styling improvements automatically apply to IconButton.
 * 
 * Usage:
 *   <IconButton><Settings /></IconButton>
 *   <IconButton variant="ghost" size="icon-sm"><X /></IconButton>
 *   <IconButton variant="destructive"><Trash /></IconButton>
 */

import * as React from "react"
import { Button, ButtonProps, buttonVariants } from "./button"

export interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  size?: 'icon-sm' | 'icon' | 'icon-lg'
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "icon", ...props }, ref) => {
    return <Button ref={ref} size={size} {...props} />
  }
)
IconButton.displayName = "IconButton"

// Re-export buttonVariants for consistency
const iconButtonVariants = buttonVariants

export { IconButton, iconButtonVariants }