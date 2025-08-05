"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronRight, Circle } from "lucide-react"
import { cn } from "../../lib/utils"

// SIMPLE dropdown - no Radix UI, just basic show/hide
const DropdownContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);

  // Close on outside click
  React.useEffect(() => {
    const handleClick = () => setOpen(false);
    if (open) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
};

const DropdownMenuTrigger = ({ children, className, asChild, ...props }: any) => {
  const { setOpen } = React.useContext(DropdownContext);

  // If asChild is true, clone the child and add our click handler
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      'data-dropdown-trigger': 'true',
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
      className={className}
      data-dropdown-trigger="true"
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

const DropdownMenuContent = ({ children, className, align = "end", ...props }: any) => {
  const { open } = React.useContext(DropdownContext);
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);

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
    if (shouldRender) {
      // Find the trigger element
      const trigger = document.querySelector('[data-dropdown-trigger="true"]') as HTMLElement;
      if (trigger) {
        const updatePosition = () => {
          setTriggerRect(trigger.getBoundingClientRect());
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
    }
  }, [shouldRender]);

  if (!shouldRender || !triggerRect || !mounted) return null;

  // Calculate position based on alignment
  const calculatePosition = () => {
    const gap = 4;
    let left: number;
    let transformOrigin: string;

    if (align === "start") {
      // Align to left edge of trigger
      left = triggerRect.left;
      transformOrigin = "top left";
    } else {
      // Default: align to right edge of trigger (end)
      left = triggerRect.right - 200; // Assume dropdown width ~200px
      transformOrigin = "top right";
    }

    return {
      position: 'fixed' as const,
      top: triggerRect.bottom + gap,
      left: Math.max(8, Math.min(left, window.innerWidth - 208)), // Keep within viewport
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
      className={cn(
        "min-w-[8rem] overflow-hidden rounded-xl border-theme-strong bg-card text-card-foreground shadow-lg",
        "dark:bg-card/95 dark:backdrop-blur-sm",
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
  return createPortal(dropdownContent, document.body);
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
        onClick?.(e);
        setOpen(false);
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