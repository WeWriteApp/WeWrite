"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Icon } from "@/components/ui/Icon"
import { cn } from "../../lib/utils"

// SIMPLE dropdown - no Radix UI, just basic show/hide
const DropdownContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement> | null;
  openDirection: OpenDirection;
}>({ open: false, setOpen: () => {}, triggerRef: null, openDirection: "bottom-right" });

/**
 * Open direction determines where the dropdown opens FROM and how it's anchored:
 * - "bottom-left": Opens downward, anchored to trigger's LEFT edge (dropdown's left = trigger's left)
 * - "bottom-right": Opens downward, anchored to trigger's RIGHT edge (dropdown's right = trigger's right)
 * - "top-left": Opens upward, anchored to trigger's LEFT edge
 * - "top-right": Opens upward, anchored to trigger's RIGHT edge
 *
 * Legacy "align" prop is mapped: align="start" -> "bottom-left", align="end" -> "bottom-right"
 */
type OpenDirection = "bottom-left" | "bottom-right" | "top-left" | "top-right";

const DropdownMenu = ({
  children,
  open: controlledOpen,
  onOpenChange
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement>(null);

  // Use controlled open if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  // Enhanced setOpen that calls onOpenChange callback
  const handleSetOpen = React.useCallback((newOpen: boolean) => {
    // Only update internal state if not controlled
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  }, [onOpenChange, controlledOpen]);

  // Close on outside click
  React.useEffect(() => {
    const handleClick = () => handleSetOpen(false);
    if (open) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [open, handleSetOpen]);

  return (
    <DropdownContext.Provider value={{ open, setOpen: handleSetOpen, triggerRef, openDirection: "bottom-right" }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
};

const DropdownMenuTrigger = ({ children, className, asChild, ...props }: any) => {
  const { open, setOpen, triggerRef } = React.useContext(DropdownContext);

  // If asChild is true, clone the child and add our click handler
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref: triggerRef,
      'data-dropdown-trigger': 'true',
      'aria-expanded': open,
      onClick: (e: any) => {
        e.stopPropagation();
        setOpen((prev: boolean) => !prev);
        // Call original onClick if it exists
        if (children.props.onClick) {
          children.props.onClick(e);
        }
      }
    });
  }

  // Otherwise render as a button (but remove asChild from DOM props)
  const { asChild: _, ...domProps } = props;
  return (
    <button
      ref={triggerRef}
      className={className}
      data-dropdown-trigger="true"
      aria-expanded={open}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(prev => !prev);
      }}
      {...domProps}
    >
      {children}
    </button>
  );
};

const DropdownMenuContent = ({
  children,
  className,
  align, // Legacy prop for backwards compatibility
  openDirection: openDirectionProp,
  sideOffset = 4,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end"; // Legacy - maps to openDirection
  openDirection?: OpenDirection;
  sideOffset?: number;
  [key: string]: any;
}) => {
  const { open, triggerRef } = React.useContext(DropdownContext);
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);
  const [isPositioned, setIsPositioned] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Resolve openDirection from legacy align prop or new openDirection prop
  const openDirection: OpenDirection = openDirectionProp ||
    (align === "start" ? "bottom-left" : "bottom-right");

  const isBottom = openDirection.startsWith("bottom");
  const isLeft = openDirection.endsWith("left");

  // Ensure we're mounted on client side
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle animation states
  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
      setIsPositioned(false);
    } else {
      // Start exit animation
      setIsAnimating(false);
      // Remove from DOM after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsPositioned(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Get trigger element position when dropdown opens
  React.useEffect(() => {
    if (shouldRender && open && triggerRef?.current) {
      const activeTrigger = triggerRef.current;

      const updatePosition = () => {
        setTriggerRect(activeTrigger.getBoundingClientRect());
      };

      updatePosition();

      // Update position on scroll/resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [shouldRender, open, triggerRef]);

  // Position and animate after content is rendered and measured
  React.useLayoutEffect(() => {
    if (shouldRender && contentRef.current && triggerRect && !isPositioned) {
      // Force a reflow to ensure the element is rendered
      contentRef.current.offsetHeight;

      // Now mark as positioned and start animation
      setIsPositioned(true);

      // Start animation in next frame
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    }
  }, [shouldRender, triggerRect, isPositioned]);

  if (!shouldRender || !triggerRect || !mounted) return null;

  // Calculate position based on openDirection
  const calculatePosition = () => {
    const gap = sideOffset;
    const viewportPadding = 8;

    let top: number;
    let left: number | undefined;
    let right: number | undefined;

    // Vertical positioning
    if (isBottom) {
      top = triggerRect.bottom + gap;
    } else {
      // For top positioning, we'll set top and let content grow upward
      // Use a reasonable estimate initially, will be positioned correctly
      top = triggerRect.top - gap;
    }

    // Horizontal positioning using left/right for stable anchoring
    if (isLeft) {
      // Left edge anchored to trigger's left edge
      left = Math.max(viewportPadding, triggerRect.left);
    } else {
      // Right edge anchored to trigger's right edge
      right = Math.max(viewportPadding, window.innerWidth - triggerRect.right);
    }

    return {
      position: 'fixed' as const,
      top: isBottom ? top : undefined,
      bottom: !isBottom ? (window.innerHeight - triggerRect.top + gap) : undefined,
      left,
      right,
      zIndex: 99999,
    };
  };

  const style = calculatePosition();

  // Count menu items for stagger calculation
  let itemCount = 0;
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const isMenuItem = child.type?.displayName === 'DropdownMenuItem' ||
                        child.props?.className?.includes?.('cursor-default') ||
                        child.props?.className?.includes?.('flex items-center');
      if (isMenuItem) itemCount++;
    }
  });

  // Add staggered animation delays to children
  // Items animate from trigger outward (first item closest to trigger animates first)
  let currentItemIndex = 0;
  const animatedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      const isMenuItem = child.type?.displayName === 'DropdownMenuItem' ||
                        child.props?.className?.includes?.('cursor-default') ||
                        child.props?.className?.includes?.('flex items-center');

      if (isMenuItem) {
        // For bottom menus: first item is closest to trigger (index 0 = no delay)
        // For top menus: last item is closest to trigger (reverse the order)
        const staggerIndex = isBottom ? currentItemIndex : (itemCount - 1 - currentItemIndex);
        const delay = staggerIndex * 25;
        currentItemIndex++;

        // Items slide in Y direction only - from trigger direction
        // Bottom menus: items start above (negative Y) and slide down
        // Top menus: items start below (positive Y) and slide up
        const startY = isBottom ? -8 : 8;

        return React.cloneElement(child, {
          style: {
            ...child.props.style,
            opacity: isAnimating ? 1 : 0,
            transform: isAnimating ? 'translateY(0)' : `translateY(${startY}px)`,
            transition: `opacity 150ms ease-out ${delay}ms, transform 150ms ease-out ${delay}ms`
          }
        });
      }
    }
    return child;
  });

  // Container animation - pure Y translation, no X movement
  const containerStyle = {
    ...style,
    opacity: isPositioned ? (isAnimating ? 1 : 0) : 0,
    transform: isPositioned
      ? (isAnimating ? 'translateY(0)' : `translateY(${isBottom ? -8 : 8}px)`)
      : 'translateY(0)',
    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    // Hide until positioned to prevent flash
    visibility: isPositioned ? 'visible' as const : 'hidden' as const,
  };

  const dropdownContent = (
    <div
      ref={contentRef}
      className={cn(
        // Use universal card system with floating variant and glassmorphism
        "wewrite-card wewrite-floating",
        "min-w-[12rem] overflow-hidden rounded-2xl shadow-2xl",
        "p-3",
        className
      )}
      style={containerStyle}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {animatedChildren}
    </div>
  );

  // Use portal to render outside of any stacking context
  return typeof document !== 'undefined'
    ? createPortal(dropdownContent, document.body)
    : dropdownContent;
};

const DropdownMenuItem = ({ children, className, onClick, ...props }: any) => {
  const { setOpen } = React.useContext(DropdownContext);
  return (
    <div
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        "transition-all duration-150 ease-out",
        "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] hover:shadow-sm",
        "active:scale-[0.98] active:transition-transform active:duration-75",
        className
      )}
      onClick={(e) => {
        if (onClick) {
          onClick(e);
          // Only close dropdown if the event wasn't prevented
          if (!e.defaultPrevented) {
            setOpen(false);
          }
        } else {
          // Default behavior: close dropdown
          setOpen(false);
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
};

// Add display name for component detection
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuSeparator = ({ className, ...props }: any) => (
  <div
    className={cn(
      "-mx-1 my-1 h-px bg-muted transition-opacity duration-150 ease-out",
      className
    )}
    {...props}
  />
);

const DropdownMenuLabel = ({ children, className, ...props }: any) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props}>
    {children}
  </div>
);

// Simple implementations for other components
const DropdownMenuGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const DropdownMenuSub = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuSubContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuSubTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuRadioGroup = ({
  children,
  value,
  onValueChange
}: {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}) => (
  <div data-value={value} data-onvaluechange={onValueChange?.toString()}>
    {children}
  </div>
);

const DropdownMenuRadioItem = ({
  children,
  value,
  onClick
}: {
  children: React.ReactNode;
  value?: string;
  onClick?: () => void;
}) => (
  <div
    className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground"
    onClick={onClick}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <div className="h-2 w-2 rounded-full bg-current" />
    </span>
    {children}
  </div>
);
const DropdownMenuCheckboxItem = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuShortcut = ({ children }: { children: React.ReactNode }) => <span>{children}</span>;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
