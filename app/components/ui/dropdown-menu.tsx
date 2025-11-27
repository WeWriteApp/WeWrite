"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronRight, Circle } from "lucide-react"
import { cn } from "../../lib/utils"

// SIMPLE dropdown - no Radix UI, just basic show/hide
const DropdownContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement> | null;
}>({ open: false, setOpen: () => {}, triggerRef: null });

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
    <DropdownContext.Provider value={{ open, setOpen: handleSetOpen, triggerRef }}>
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

const DropdownMenuContent = ({ children, className, align = "end", sideOffset = 4, ...props }: any) => {
  const { open, triggerRef } = React.useContext(DropdownContext);
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Ensure we're mounted on client side
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle animation states
  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Start enter animation after render - use double RAF for better reliability
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      // Start exit animation
      setIsAnimating(false);
      // Remove from DOM after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 200); // Slightly longer to ensure animation completes
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

  if (!shouldRender || !triggerRect || !mounted) return null;

  // Calculate position based on alignment
  const calculatePosition = () => {
    const gap = sideOffset;
    const viewportPadding = 8; // Padding from viewport edges
    let left: number;
    let transformOrigin: string;

    if (align === "start") {
      // Align to left edge of trigger
      left = triggerRect.left;
      transformOrigin = "top left";
      // Ensure dropdown doesn't go off left edge
      left = Math.max(viewportPadding, left);
    } else {
      // Default: align to right edge of trigger (end)
      // For earnings dropdown, we want the RIGHT edge of the dropdown to align with the RIGHT edge of the trigger

      // Try to get actual dropdown width if element exists
      let dropdownWidth = 280; // Default estimate
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          dropdownWidth = rect.width;
        }
      }

      // Position so the right edge of dropdown aligns with right edge of trigger
      left = triggerRect.right - dropdownWidth;
      transformOrigin = "top right";

      // Ensure dropdown doesn't go off left edge of viewport
      left = Math.max(viewportPadding, left);

      // If the dropdown would still go off the right edge, adjust
      if (left + dropdownWidth > window.innerWidth - viewportPadding) {
        left = window.innerWidth - dropdownWidth - viewportPadding;
      }
    }

    return {
      position: 'fixed' as const,
      top: triggerRect.bottom + gap,
      left,
      zIndex: 99999,
      transformOrigin
    };
  };

  const style = calculatePosition();

  // Animation classes based on state and alignment
  const getAnimationClasses = () => {
    const baseClasses = "transition-all duration-150 ease-out";
    const transformOrigin = align === 'start' ? 'origin-top-left' : 'origin-top-right';

    if (isAnimating) {
      // Enter animation - slide down and fade in
      return `${baseClasses} ${transformOrigin} opacity-100 scale-100 translate-y-0`;
    } else {
      // Exit animation - slide up and fade out
      return `${baseClasses} ${transformOrigin} opacity-0 scale-95 -translate-y-2`;
    }
  };

  // Add staggered animation delays to children
  const animatedChildren = React.Children.map(children, (child, index) => {
    if (React.isValidElement(child)) {
      // Check if it's a menu item by looking for the className pattern
      const isMenuItem = child.props?.className?.includes?.('cursor-default') ||
                        child.type?.displayName === 'DropdownMenuItem' ||
                        child.props?.className?.includes?.('flex items-center');

      if (isMenuItem) {
        const delay = index * 30; // Slightly longer delay for better effect
        return React.cloneElement(child, {
          style: {
            ...child.props.style,
            opacity: isAnimating ? 1 : 0,
            transform: isAnimating ? 'translateY(0)' : 'translateY(-6px)',
            transition: `opacity 150ms ease-out ${delay}ms, transform 150ms ease-out ${delay}ms`
          }
        });
      }
    }
    return child;
  });

  const dropdownContent = (
    <div
      ref={contentRef}
      className={cn(
        // Use universal card system with floating variant
        "wewrite-card wewrite-floating",
        "min-w-[8rem] overflow-hidden rounded-2xl",
        /* Shadow removed - user prefers no shadows */
        "p-2",
        getAnimationClasses(),
        className
      )}
      style={style}
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
