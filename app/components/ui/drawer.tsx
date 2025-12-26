import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { Icon } from "@/components/ui/Icon"
import { cn } from "../../lib/utils"

/**
 * Custom Drawer Root that adds:
 * - URL hash tracking (optional hashId prop)
 * - Analytics tracking (optional analyticsId prop)
 * - Body scroll locking when open
 */
interface DrawerProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  /** Hash ID to add to URL when drawer is open (e.g., "checkout" -> #checkout) */
  hashId?: string
  /** Analytics ID for tracking drawer open/close events */
  analyticsId?: string
}

const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(
  ({ hashId, analyticsId, open, onOpenChange, children, ...props }, ref) => {
    // Track previous hash to restore on close
    const previousHashRef = React.useRef<string>('')
    // Track if we've already checked the initial hash
    const hasCheckedInitialHash = React.useRef(false)
    // Track if we set the hash (to know if we need to clear it on close)
    const hasSetHashRef = React.useRef(false)

    // Check if URL hash matches on mount and open drawer if so
    React.useEffect(() => {
      if (typeof window === 'undefined' || !hashId || hasCheckedInitialHash.current) return

      hasCheckedInitialHash.current = true

      // Check if current URL has the matching hash
      const currentHash = window.location.hash.replace('#', '')
      if (currentHash === hashId && !open) {
        // URL has the hash but drawer is closed - open it
        onOpenChange?.(true)
      }
    }, [hashId, open, onOpenChange])

    // Handle URL hash and body scroll lock
    React.useEffect(() => {
      if (typeof window === 'undefined') return

      if (open) {
        // Store current hash before changing
        previousHashRef.current = window.location.hash

        // Set hash if provided
        if (hashId) {
          const newHash = `#${hashId}`
          // Use replaceState to avoid adding to history
          window.history.replaceState(null, '', newHash)
          hasSetHashRef.current = true
        }

        // Lock body scroll while preserving visual context
        // Instead of using position: fixed (which resets visual scroll position),
        // we use overflow: hidden on both html and body to prevent scrolling
        // while keeping the content visually in place
        const scrollY = window.scrollY
        document.body.setAttribute('data-drawer-open', 'true')
        document.body.setAttribute('data-scroll-y', String(scrollY))

        // Use overflow hidden on html to prevent scrolling while preserving visual position
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
        // Prevent touch scrolling on mobile by adding touch-action
        document.body.style.touchAction = 'none'
        // Add overscroll-behavior to prevent pull-to-refresh and bounce effects
        document.body.style.overscrollBehavior = 'none'

        // Track analytics - use page view for navigation tracking
        if (analyticsId) {
          try {
            const { getAnalyticsService } = require('../../utils/analytics-service')
            const analytics = getAnalyticsService()
            // Track as virtual page view so it appears in navigation reports
            const virtualPath = `${window.location.pathname}#${hashId || analyticsId}`
            analytics.trackPageView(virtualPath, `Drawer: ${analyticsId}`)
            // Also track as event for backwards compatibility
            analytics.trackEvent({
              category: 'drawer',
              action: `drawer_opened`,
              label: analyticsId
            })
          } catch (e) {
            // Analytics not available
          }
        }
      } else {
        // Only restore if we were actually locked (data-drawer-open attribute exists)
        const wasLocked = document.body.getAttribute('data-drawer-open') === 'true'
        if (!wasLocked) return // Don't do anything if drawer wasn't open

        // Restore/clear hash if we set it when opening
        if (hasSetHashRef.current && hashId) {
          // If previous hash was empty or just '#', restore to clean URL
          const cleanUrl = previousHashRef.current && previousHashRef.current !== '#'
            ? previousHashRef.current
            : window.location.pathname + window.location.search
          window.history.replaceState(null, '', cleanUrl)
          hasSetHashRef.current = false
        }

        // Unlock body scroll - restore all scroll-related styles
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
        document.body.style.touchAction = ''
        document.body.style.overscrollBehavior = ''
        document.body.removeAttribute('data-drawer-open')
        document.body.removeAttribute('data-scroll-y')

        // Note: No need to restore scroll position since we preserved it visually

        // Track analytics
        if (analyticsId) {
          try {
            const { getAnalyticsService } = require('../../utils/analytics-service')
            const analytics = getAnalyticsService()
            analytics.trackEvent({
              category: 'drawer',
              action: `drawer_closed`,
              label: analyticsId
            })
          } catch (e) {
            // Analytics not available
          }
        }
      }

      // Handle browser back button (popstate) to close drawer
      const handlePopState = () => {
        if (open && hashId && !window.location.hash.includes(hashId)) {
          onOpenChange?.(false)
        }
      }

      window.addEventListener('popstate', handlePopState)
      return () => {
        window.removeEventListener('popstate', handlePopState)
        // Only cleanup if we were actually locked
        const wasLocked = document.body.getAttribute('data-drawer-open') === 'true'
        if (!wasLocked) return

        // Cleanup scroll lock on unmount
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
        document.body.style.touchAction = ''
        document.body.style.overscrollBehavior = ''
        document.body.removeAttribute('data-drawer-open')
        document.body.removeAttribute('data-scroll-y')
      }
    }, [open, hashId, analyticsId, onOpenChange])

    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    )
  }
)
Drawer.displayName = "Drawer"

const DrawerTrigger = DialogPrimitive.Trigger

const DrawerClose = DialogPrimitive.Close

const DrawerPortal = DialogPrimitive.Portal

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[1100] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

const drawerVariants = cva(
  "fixed z-[1100]",
  {
    variants: {
      side: {
        bottom: "inset-x-0 bottom-0 rounded-t-3xl data-[state=open]:animate-[drawer-slide-up_0.5s_cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-[drawer-slide-down_0.3s_ease-out]",
      },
    },
    defaultVariants: {
      side: "bottom",
    },
  }
)

interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerVariants> {
  height?: string
  /** Show dark tinted overlay behind drawer */
  showOverlay?: boolean
  /** Add blur effect to overlay */
  blurOverlay?: boolean
  /** @deprecated Use showOverlay={false} instead */
  noOverlay?: boolean
  /**
   * Disable swipe-to-dismiss gesture.
   * Useful for content that requires drag interactions (e.g., 3D graph views).
   * When true, the drawer can only be closed via explicit close actions.
   */
  disableSwipeDismiss?: boolean
  /**
   * Accessible title for screen readers.
   * If not provided, a default "Drawer" title will be used.
   * This is required by Radix Dialog for accessibility.
   */
  accessibleTitle?: string
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ side = "bottom", className, children, height = "auto", showOverlay = true, blurOverlay = false, noOverlay = false, disableSwipeDismiss = false, accessibleTitle = "Drawer", ...props }, ref) => {
  // Handle legacy noOverlay prop
  const shouldShowOverlay = noOverlay ? false : showOverlay

  // Determine overlay classes based on options
  // Using 40% opacity for better visibility of background content
  const overlayClasses = cn(
    "fixed inset-0 z-[1100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    shouldShowOverlay && "bg-black/40",
    blurOverlay && "backdrop-blur-sm",
    // If blur but no dark overlay, add slight tint
    blurOverlay && !shouldShowOverlay && "bg-white/30 dark:bg-black/30"
  )
  // Drag-to-dismiss state: tracks touch interactions for native-like behavior
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragY, setDragY] = React.useState(0)
  const [startY, setStartY] = React.useState(0)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    // Skip if swipe-to-dismiss is disabled (e.g., for graph views that need drag interactions)
    if (disableSwipeDismiss) return

    // Don't handle touch events on input fields or interactive elements
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('input, textarea, button, [role="button"]')) {
      return
    }

    setIsDragging(true)
    setStartY(e.touches[0].clientY)
    setDragY(0)

    // Disable transitions during drag
    if (contentRef.current) {
      contentRef.current.style.transition = 'none'
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return

    // Don't handle touch events on input fields or interactive elements
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('input, textarea, button, [role="button"]')) {
      return
    }

    const currentY = e.touches[0].clientY
    const deltaY = Math.max(0, currentY - startY) // Only allow dragging down
    setDragY(deltaY)

    if (contentRef.current) {
      // Add resistance when dragging beyond threshold
      const resistance = deltaY > 100 ? 0.5 : 1
      const adjustedDelta = deltaY > 100 ? 100 + (deltaY - 100) * resistance : deltaY
      contentRef.current.style.transform = `translateY(${adjustedDelta}px)`
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging) return

    setIsDragging(false)

    // If dragged down more than 100px, close the drawer with animation
    if (dragY > 100) {
      // Animate to bottom before closing
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.3s ease-out'
        contentRef.current.style.transform = 'translateY(100%)'

        // Wait for animation to complete, then trigger close
        setTimeout(() => {
          const closeButton = contentRef.current?.querySelector('[data-drawer-close]') as HTMLButtonElement
          closeButton?.click()
        }, 300)
      }
    } else {
      // Snap back to original position with animation
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out'
        contentRef.current.style.transform = 'translateY(0px)'

        // Clear transition after animation
        setTimeout(() => {
          if (contentRef.current) {
            contentRef.current.style.transition = ''
          }
        }, 200)
      }
    }

    setDragY(0)
    setStartY(0)
  }

  return (
    <DrawerPortal>
      {(shouldShowOverlay || blurOverlay) && (
        <DialogPrimitive.Overlay className={overlayClasses} />
      )}
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          drawerVariants({ side }),
          // Frosted glass effect: mostly opaque white with subtle blur
          "flex flex-col p-0 shadow-2xl border-subtle",
          "bg-white/95 dark:bg-zinc-900/95",
          "backdrop-blur-xl",
          // Safe area support for bottom drawer
          "pb-safe",
          // Extend background below to cover bounce overshoot
          "after:absolute after:left-0 after:right-0 after:top-full after:h-32 after:bg-white/95 dark:after:bg-zinc-900/95",
          className
        )}
        style={{
          height,
          borderRadius: '1.5rem 1.5rem 0 0',
          borderBottom: 'none',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
        tabIndex={-1}
        {...props}
      >
        {/* Accessible title for screen readers - visually hidden */}
        <DialogPrimitive.Title className="sr-only">
          {accessibleTitle}
        </DialogPrimitive.Title>

        <div
          ref={contentRef}
          className="flex flex-col h-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag Handle - tighter spacing */}
          <div className="flex justify-center pt-3 pb-1 px-4 flex-shrink-0 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1.5 bg-muted-foreground/40 rounded-full transition-all duration-200 hover:bg-muted-foreground/60 hover:w-12" />
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 flex flex-col">
            {children}
          </div>

          {/* Hidden close button for programmatic closing */}
          <DialogPrimitive.Close asChild>
            <button data-drawer-close className="hidden" />
          </DialogPrimitive.Close>
        </div>
      </DialogPrimitive.Content>
    </DrawerPortal>
  )
})
DrawerContent.displayName = DialogPrimitive.Content.displayName

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Header with reduced top padding, increased bottom padding for breathing room
      "relative flex flex-col space-y-1 text-center px-4 pt-0 pb-4 flex-shrink-0",
      className
    )}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Footer with comfortable bottom padding for buttons
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-4 pt-3 pb-6 flex-shrink-0 border-t-subtle",
      className
    )}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DrawerTitle.displayName = DialogPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = DialogPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
