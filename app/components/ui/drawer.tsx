import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

const Drawer = DialogPrimitive.Root

const DrawerTrigger = DialogPrimitive.Trigger

const DrawerClose = DialogPrimitive.Close

const DrawerPortal = DialogPrimitive.Portal

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

const drawerVariants = cva(
  "fixed z-50 bg-background border-border",
  {
    variants: {
      side: {
        bottom: "inset-x-0 -bottom-8 pb-8 rounded-t-3xl data-[state=open]:animate-[drawer-slide-up_0.5s_cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-[drawer-slide-down_0.3s_ease-out]",
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
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ side = "bottom", className, children, height = "85vh", ...props }, ref) => {
  // Drag-to-dismiss state: tracks touch interactions for native-like behavior
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragY, setDragY] = React.useState(0)
  const [startY, setStartY] = React.useState(0)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
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
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          drawerVariants({ side }),
          "flex flex-col p-0 shadow-2xl border-t border-border/20",
          className
        )}
        style={{ height }}
        {...props}
      >
        <div
          ref={contentRef}
          className="flex flex-col h-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag Handle */}
          <div className="flex justify-center py-3 px-4 flex-shrink-0 cursor-grab active:cursor-grabbing">
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
      "flex flex-col space-y-2 text-center sm:text-left px-4 pb-4 flex-shrink-0",
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
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-4 pb-8 flex-shrink-0", className)}
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
