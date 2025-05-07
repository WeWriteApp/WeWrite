"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster({
  position = "top-right",
  theme = "system",
  richColors = true,
  closeButton = true,
  ...props
}: {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center"
  theme?: "light" | "dark" | "system"
  richColors?: boolean
  closeButton?: boolean
  [key: string]: any
}) {
  return (
    <SonnerToaster
      position={position}
      theme={theme}
      richColors={richColors}
      closeButton={closeButton}
      {...props}
    />
  )
}

export { Toaster }
