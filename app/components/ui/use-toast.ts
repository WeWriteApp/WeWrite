import { toast as sonnerToast, ExternalToast } from "sonner"
import { copyToClipboard } from "../../utils/clipboard"

type ToastOptions = ExternalToast & {
  enableCopy?: boolean
  copyText?: string
}

// Legacy API support - old format: { title, description, variant }
type LegacyToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success" | "info" | "warning"
  enableCopy?: boolean
  copyText?: string
  action?: any
}

/**
 * Toast notification wrapper around Sonner
 *
 * Usage (new API - recommended):
 *   toast.success("Saved!")
 *   toast.error("Failed", { description: "Please try again" })
 *
 * Usage (legacy API - still supported):
 *   toast({ title: "Saved!", variant: "success" })
 *   toast({ title: "Failed", description: "Please try again", variant: "destructive" })
 */
export function toast(messageOrProps: string | LegacyToastProps, options?: ToastOptions) {
  // Handle legacy object-based API
  if (typeof messageOrProps === "object") {
    const { title, description, variant, enableCopy, copyText, action, ...rest } = messageOrProps
    const message = title || ""

    // Map variant to the appropriate toast method
    if (variant === "destructive") {
      if (enableCopy && copyText) {
        return sonnerToast.error(message, {
          description,
          action: {
            label: "Copy",
            onClick: async () => {
              const success = await copyToClipboard(copyText)
              if (success) {
                sonnerToast.success("Copied to clipboard")
              }
            }
          },
          ...rest
        })
      }
      return sonnerToast.error(message, { description, action, ...rest })
    }
    if (variant === "success") {
      return sonnerToast.success(message, { description, action, ...rest })
    }
    if (variant === "info") {
      return sonnerToast.info(message, { description, action, ...rest })
    }
    if (variant === "warning") {
      return sonnerToast.warning(message, { description, action, ...rest })
    }

    // Default variant
    return sonnerToast(message, { description, action, ...rest })
  }

  // New string-based API
  return sonnerToast(messageOrProps, options)
}

toast.success = (message: string, options?: ToastOptions) => {
  return sonnerToast.success(message, options)
}

toast.error = (message: string, options?: ToastOptions) => {
  const { enableCopy, copyText, ...rest } = options || {}

  if (enableCopy && copyText) {
    return sonnerToast.error(message, {
      ...rest,
      action: {
        label: "Copy",
        onClick: async () => {
          const success = await copyToClipboard(copyText)
          if (success) {
            sonnerToast.success("Copied to clipboard")
          }
        }
      }
    })
  }

  return sonnerToast.error(message, rest)
}

toast.info = (message: string, options?: ToastOptions) => {
  return sonnerToast.info(message, options)
}

toast.warning = (message: string, options?: ToastOptions) => {
  return sonnerToast.warning(message, options)
}

toast.loading = (message: string, options?: ToastOptions) => {
  return sonnerToast.loading(message, options)
}

toast.dismiss = (toastId?: string | number) => {
  return sonnerToast.dismiss(toastId)
}

toast.promise = sonnerToast.promise

// Legacy hook for compatibility - just returns the toast function
export function useToast() {
  return { toast }
}
