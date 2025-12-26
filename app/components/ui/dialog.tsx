"use client"

import * as React from "react"
import { Icon } from '@/components/ui/Icon';
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

/**
 * Custom Dialog Root that adds:
 * - URL hash tracking (optional hashId prop) - uses #dialog-{hashId} format
 * - Analytics tracking (optional analyticsId prop)
 */
interface DialogProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  /** Hash ID to add to URL when dialog is open (e.g., "link-editor" -> #dialog-link-editor) */
  hashId?: string
  /** Analytics ID for tracking dialog open/close events */
  analyticsId?: string
}

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ hashId, analyticsId, open, onOpenChange, children, ...props }, ref) => {
    // Track previous hash to restore on close
    const previousHashRef = React.useRef<string>('')
    // Track if we've already checked the initial hash
    const hasCheckedInitialHash = React.useRef(false)

    // Generate full hash with dialog- prefix to distinguish from drawer hashes
    const fullHashId = hashId ? `dialog-${hashId}` : undefined

    // Check if URL hash matches on mount and open dialog if so
    React.useEffect(() => {
      if (typeof window === 'undefined' || !fullHashId || hasCheckedInitialHash.current) return

      hasCheckedInitialHash.current = true

      // Check if current URL has the matching hash
      const currentHash = window.location.hash.replace('#', '')
      if (currentHash === fullHashId && !open) {
        // URL has the hash but dialog is closed - open it
        onOpenChange?.(true)
      }
    }, [fullHashId, open, onOpenChange])

    // Track if we set the hash (to know if we need to clear it on close)
    const hasSetHashRef = React.useRef(false)

    // Handle URL hash and analytics
    React.useEffect(() => {
      if (typeof window === 'undefined') return

      if (open) {
        // Store current hash before changing (without the # symbol for cleaner comparison)
        previousHashRef.current = window.location.hash

        // Set hash if provided
        if (fullHashId) {
          const newHash = `#${fullHashId}`
          // Use replaceState to avoid adding to history
          window.history.replaceState(null, '', newHash)
          hasSetHashRef.current = true
        }

        // Track analytics
        if (analyticsId) {
          try {
            const { getAnalyticsService } = require('../../utils/analytics-service')
            const analytics = getAnalyticsService()
            analytics.trackEvent({
              category: 'dialog',
              action: `dialog_opened`,
              label: analyticsId
            })
          } catch (e) {
            // Analytics not available
          }
        }
      } else if (hasSetHashRef.current && fullHashId) {
        // Only restore/clear hash if we actually set it when opening
        // If previous hash was empty or just '#', restore to clean URL
        const cleanUrl = previousHashRef.current && previousHashRef.current !== '#'
          ? previousHashRef.current
          : window.location.pathname + window.location.search
        window.history.replaceState(null, '', cleanUrl)
        hasSetHashRef.current = false

        // Track analytics
        if (analyticsId) {
          try {
            const { getAnalyticsService } = require('../../utils/analytics-service')
            const analytics = getAnalyticsService()
            analytics.trackEvent({
              category: 'dialog',
              action: `dialog_closed`,
              label: analyticsId
            })
          } catch (e) {
            // Analytics not available
          }
        }
      }

      // Handle browser back button (popstate) to close dialog
      const handlePopState = () => {
        if (open && fullHashId && !window.location.hash.includes(fullHashId)) {
          onOpenChange?.(false)
        }
      }

      window.addEventListener('popstate', handlePopState)
      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    }, [open, fullHashId, analyticsId, onOpenChange])

    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    )
  }
)
Dialog.displayName = 'Dialog'

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[1100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      // Dark overlay to match drawer
      "bg-black/50",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Show dark tinted overlay behind dialog */
  showOverlay?: boolean
  /** Add blur effect to overlay */
  blurOverlay?: boolean
  /** Show X close button in top right corner */
  showCloseButton?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showOverlay = true, blurOverlay = false, showCloseButton = false, ...props }, ref) => {
  // Determine overlay classes based on options
  const overlayClasses = cn(
    "fixed inset-0 z-[1100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    showOverlay && "bg-black/50",
    blurOverlay && "backdrop-blur-sm",
    // If blur but no dark overlay, add slight tint
    blurOverlay && !showOverlay && "bg-white/30 dark:bg-black/30"
  )

  return (
  <DialogPortal>
    {(showOverlay || blurOverlay) && (
      <DialogPrimitive.Overlay className={overlayClasses} />
    )}
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Position centered using inset + margin auto (avoids transform conflicts)
        "fixed inset-0 z-[1100] flex flex-col w-[85%] max-w-lg m-auto h-fit rounded-2xl",
        // Subtle slide up + fade animation
        "transition-all duration-200 ease-out",
        "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
        // Frosted glass effect: mostly opaque white with subtle blur
        "border border-border shadow-lg",
        "bg-white/95 dark:bg-zinc-900/95",
        "backdrop-blur-xl",
        className
      )}
      {...props}
    >
      {showCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10">
          <Icon name="X" size={16} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center shrink-0 p-6 pb-4",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

/**
 * DialogBody - Scrollable content area between header and footer
 * Use this to wrap your main content when you need header/footer to stay fixed
 */
const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 overflow-y-auto px-6",
      className
    )}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 shrink-0 p-6 pt-4 border-t border-border/60",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-center w-full",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground text-center w-full", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}