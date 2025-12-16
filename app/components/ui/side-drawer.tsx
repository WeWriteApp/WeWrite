import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

/**
 * SideDrawer - A side panel component that slides in from left or right
 *
 * Features:
 * - Sticky header and footer support
 * - Scrollable body content
 * - Body scroll locking when open
 * - URL hash tracking (optional)
 * - Frosted glass effect
 */

interface SideDrawerProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  /** Hash ID to add to URL when drawer is open (e.g., "preview" -> #preview) */
  hashId?: string
}

const SideDrawer = React.forwardRef<HTMLDivElement, SideDrawerProps>(
  ({ hashId, open, onOpenChange, children, ...props }, ref) => {
    const previousHashRef = React.useRef<string>('')
    const hasCheckedInitialHash = React.useRef(false)

    // Check if URL hash matches on mount and open drawer if so
    React.useEffect(() => {
      if (typeof window === 'undefined' || !hashId || hasCheckedInitialHash.current) return

      hasCheckedInitialHash.current = true

      const currentHash = window.location.hash.replace('#', '')
      if (currentHash === hashId && !open) {
        onOpenChange?.(true)
      }
    }, [hashId, open, onOpenChange])

    // Handle URL hash and body scroll lock
    React.useEffect(() => {
      if (typeof window === 'undefined') return

      if (open) {
        previousHashRef.current = window.location.hash

        if (hashId) {
          const newHash = `#${hashId}`
          window.history.replaceState(null, '', newHash)
        }

        // Lock body scroll
        const scrollY = window.scrollY
        document.documentElement.style.overflow = 'hidden'
        document.body.style.position = 'fixed'
        document.body.style.top = `-${scrollY}px`
        document.body.style.left = '0'
        document.body.style.right = '0'
        document.body.style.width = '100%'
        document.body.style.overflow = 'hidden'
        document.body.setAttribute('data-side-drawer-open', 'true')
        document.body.setAttribute('data-scroll-y', String(scrollY))
      } else {
        const wasLocked = document.body.getAttribute('data-side-drawer-open') === 'true'
        if (!wasLocked) return

        if (hashId) {
          const newUrl = previousHashRef.current || window.location.pathname + window.location.search
          window.history.replaceState(null, '', newUrl)
        }

        const storedScrollY = document.body.getAttribute('data-scroll-y')
        const scrollY = storedScrollY ? parseInt(storedScrollY, 10) : 0

        // Unlock body scroll
        document.documentElement.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        document.body.removeAttribute('data-side-drawer-open')
        document.body.removeAttribute('data-scroll-y')

        window.scrollTo(0, scrollY)
      }

      const handlePopState = () => {
        if (open && hashId && !window.location.hash.includes(hashId)) {
          onOpenChange?.(false)
        }
      }

      window.addEventListener('popstate', handlePopState)
      return () => {
        window.removeEventListener('popstate', handlePopState)
        const wasLocked = document.body.getAttribute('data-side-drawer-open') === 'true'
        if (!wasLocked) return

        const storedScrollY = document.body.getAttribute('data-scroll-y')
        const scrollY = storedScrollY ? parseInt(storedScrollY, 10) : 0

        document.documentElement.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        document.body.removeAttribute('data-side-drawer-open')
        document.body.removeAttribute('data-scroll-y')

        window.scrollTo(0, scrollY)
      }
    }, [open, hashId, onOpenChange])

    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    )
  }
)
SideDrawer.displayName = "SideDrawer"

const SideDrawerTrigger = DialogPrimitive.Trigger

const SideDrawerClose = DialogPrimitive.Close

const SideDrawerPortal = DialogPrimitive.Portal

const SideDrawerOverlay = React.forwardRef<
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
SideDrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

const sideDrawerVariants = cva(
  "fixed z-[1100] flex flex-col",
  {
    variants: {
      side: {
        left: "inset-y-0 left-0 h-full border-r data-[state=open]:animate-[slide-in-from-left_0.3s_ease-out] data-[state=closed]:animate-[slide-out-to-left_0.2s_ease-in]",
        right: "inset-y-0 right-0 h-full border-l data-[state=open]:animate-[slide-in-from-right_0.3s_ease-out] data-[state=closed]:animate-[slide-out-to-right_0.2s_ease-in]",
      },
      size: {
        sm: "w-[320px] max-w-[90vw]",
        md: "w-[400px] max-w-[90vw]",
        lg: "w-[500px] max-w-[90vw]",
        xl: "w-[600px] max-w-[90vw]",
        "2xl": "w-[700px] max-w-[90vw]",
      },
    },
    defaultVariants: {
      side: "right",
      size: "md",
    },
  }
)

interface SideDrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sideDrawerVariants> {
  /** Show overlay behind drawer */
  showOverlay?: boolean
}

const SideDrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SideDrawerContentProps
>(({ side = "right", size = "md", className, children, showOverlay = true, ...props }, ref) => {
  return (
    <SideDrawerPortal>
      {showOverlay && <SideDrawerOverlay />}
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          sideDrawerVariants({ side, size }),
          // Frosted glass effect
          "bg-white/95 dark:bg-zinc-900/95",
          "backdrop-blur-xl",
          "shadow-2xl",
          "border-border",
          className
        )}
        {...props}
      >
        <div className="flex flex-col h-full">
          {children}
        </div>
      </DialogPrimitive.Content>
    </SideDrawerPortal>
  )
})
SideDrawerContent.displayName = DialogPrimitive.Content.displayName

interface SideDrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Make header sticky at top when content scrolls */
  sticky?: boolean
  /** Show close button in header */
  showClose?: boolean
  /** Callback when close button clicked */
  onClose?: () => void
}

const SideDrawerHeader = ({
  className,
  sticky = true,
  showClose = true,
  onClose,
  children,
  ...props
}: SideDrawerHeaderProps) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 px-6 py-4 border-b border-border",
      sticky && "sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl z-10",
      className
    )}
    {...props}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">{children}</div>
      {showClose && (
        <DialogPrimitive.Close
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground ml-4"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </div>
  </div>
)
SideDrawerHeader.displayName = "SideDrawerHeader"

interface SideDrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

const SideDrawerBody = ({
  className,
  children,
  ...props
}: SideDrawerBodyProps) => (
  <div
    className={cn(
      "flex-1 overflow-y-auto px-6 py-4",
      className
    )}
    {...props}
  >
    {children}
  </div>
)
SideDrawerBody.displayName = "SideDrawerBody"

interface SideDrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Make footer sticky at bottom when content scrolls */
  sticky?: boolean
}

const SideDrawerFooter = ({
  className,
  sticky = true,
  ...props
}: SideDrawerFooterProps) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 py-4 border-t border-border",
      sticky && "sticky bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl z-10",
      className
    )}
    {...props}
  />
)
SideDrawerFooter.displayName = "SideDrawerFooter"

const SideDrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
SideDrawerTitle.displayName = DialogPrimitive.Title.displayName

const SideDrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SideDrawerDescription.displayName = DialogPrimitive.Description.displayName

export {
  SideDrawer,
  SideDrawerPortal,
  SideDrawerOverlay,
  SideDrawerTrigger,
  SideDrawerClose,
  SideDrawerContent,
  SideDrawerHeader,
  SideDrawerBody,
  SideDrawerFooter,
  SideDrawerTitle,
  SideDrawerDescription,
}
