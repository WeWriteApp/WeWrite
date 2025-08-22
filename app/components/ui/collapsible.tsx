"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

// Simple collapsible implementation without Radix UI
interface CollapsibleContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextType | undefined>(undefined);

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Collapsible = ({ open: controlledOpen, onOpenChange, children }: CollapsibleProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      {children}
    </CollapsibleContext.Provider>
  );
};

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  CollapsibleTriggerProps
>(({ className, onClick, asChild = false, children, ...props }, ref) => {
  const context = React.useContext(CollapsibleContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    context?.setOpen(!context.open);
    onClick?.(e);
  };

  // If asChild is true, clone the child and add our click handler
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e: any) => {
        handleClick(e);
        // Call original onClick if it exists
        if (children.props.onClick) {
          children.props.onClick(e);
        }
      },
      ref
    });
  }

  // Otherwise render as a button (but remove asChild from DOM props)
  const { asChild: _, ...domProps } = props;
  return (
    <button
      ref={ref}
      className={className}
      onClick={handleClick}
      {...domProps}
    >
      {children}
    </button>
  );
});
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(CollapsibleContext);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    if (context?.open) {
      // Opening animation
      setIsAnimating(true);
      element.style.height = '0px';
      element.style.opacity = '0';

      // Force reflow
      element.offsetHeight;

      // Animate to full height
      element.style.transition = 'height 0.2s ease-out, opacity 0.2s ease-out';
      element.style.height = element.scrollHeight + 'px';
      element.style.opacity = '1';

      const handleTransitionEnd = () => {
        element.style.height = 'auto';
        setIsAnimating(false);
        element.removeEventListener('transitionend', handleTransitionEnd);
      };

      element.addEventListener('transitionend', handleTransitionEnd);
    } else {
      // Closing animation
      setIsAnimating(true);
      element.style.height = element.scrollHeight + 'px';
      element.style.opacity = '1';

      // Force reflow
      element.offsetHeight;

      // Animate to zero height
      element.style.transition = 'height 0.2s ease-out, opacity 0.2s ease-out';
      element.style.height = '0px';
      element.style.opacity = '0';

      const handleTransitionEnd = () => {
        setIsAnimating(false);
        element.removeEventListener('transitionend', handleTransitionEnd);
      };

      element.addEventListener('transitionend', handleTransitionEnd);
    }
  }, [context?.open]);

  // Don't render if closed and not animating
  if (!context?.open && !isAnimating) {
    return null;
  }

  return (
    <div
      ref={(node) => {
        contentRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn("overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
});
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent }