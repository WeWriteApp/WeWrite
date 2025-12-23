"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"
import { usePillStyle } from "../../contexts/PillStyleContext"

// Segmented Control Context
const SegmentedControlContext = React.createContext<{
  value: string;
  setValue: (value: string) => void;
  registerTrigger: (value: string, element: HTMLButtonElement | null) => void;
  triggerRefs: Map<string, HTMLButtonElement>;
  activeIndex: number;
  triggerCount: number;
}>({
  value: '',
  setValue: () => {},
  registerTrigger: () => {},
  triggerRefs: new Map(),
  activeIndex: 0,
  triggerCount: 0
});

interface SegmentedControlProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
  urlNavigation?: 'hash' | 'query' | 'none';
  queryParam?: string; // For query navigation
}

const SegmentedControl = ({
  value: controlledValue,
  onValueChange,
  defaultValue,
  children,
  className,
  urlNavigation = 'none',
  queryParam = 'tab'
}: SegmentedControlProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [triggerRefs] = React.useState(() => new Map<string, HTMLButtonElement>());
  const [triggerValues, setTriggerValues] = React.useState<string[]>([]);

  // Get initial value from URL if using URL navigation
  const getInitialValue = () => {
    if (urlNavigation === 'hash' && typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      return hash || defaultValue || '';
    }
    if (urlNavigation === 'query') {
      return searchParams.get(queryParam) || defaultValue || '';
    }
    return defaultValue || '';
  };

  const [internalValue, setInternalValue] = React.useState(getInitialValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  // Track active index for sliding background
  const activeIndex = triggerValues.indexOf(value);

  // Register trigger for position calculation
  const registerTrigger = React.useCallback((triggerValue: string, element: HTMLButtonElement | null) => {
    if (element) {
      triggerRefs.set(triggerValue, element);
      setTriggerValues(prev => {
        if (!prev.includes(triggerValue)) {
          return [...prev, triggerValue];
        }
        return prev;
      });
    }
  }, [triggerRefs]);

  // Listen for hash changes
  React.useEffect(() => {
    if (urlNavigation === 'hash' && !isControlled) {
      const handleHashChange = () => {
        const hash = window.location.hash.slice(1);
        if (hash) {
          setInternalValue(hash);
        }
      };

      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, [urlNavigation, isControlled]);

  const setValue = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }

    // Update URL if using URL navigation
    if (urlNavigation === 'hash') {
      window.location.hash = newValue;
    } else if (urlNavigation === 'query') {
      const params = new URLSearchParams(searchParams);
      params.set(queryParam, newValue);
      router.push(`?${params.toString()}`, { scroll: false });
    }

    onValueChange?.(newValue);
  };

  return (
    <SegmentedControlContext.Provider value={{
      value,
      setValue,
      registerTrigger,
      triggerRefs,
      activeIndex,
      triggerCount: triggerValues.length
    }}>
      <div className={className}>
        {children}
      </div>
    </SegmentedControlContext.Provider>
  );
};

const SegmentedControlList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { value, triggerRefs, activeIndex, triggerCount } = React.useContext(SegmentedControlContext);
    const { isShinyUI } = usePillStyle();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [sliderStyle, setSliderStyle] = React.useState<{ left: number; width: number } | null>(null);

    // Calculate slider position based on active trigger
    React.useEffect(() => {
      const activeElement = triggerRefs.get(value);
      const container = containerRef.current;

      if (activeElement && container) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeElement.getBoundingClientRect();

        setSliderStyle({
          left: activeRect.left - containerRect.left,
          width: activeRect.width
        });
      }
    }, [value, triggerRefs, triggerCount]);

    return (
      <div
        ref={(node) => {
          // Handle both refs
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={cn(
          // Base segmented control styling - iOS-like appearance
          "relative inline-flex items-center rounded-full p-1",
          // Use muted background for the track
          "bg-muted",
          // Ensure proper spacing and sizing
          "h-10 w-full",
          className
        )}
        {...props}
      >
        {/* Sliding background indicator */}
        {sliderStyle && (
          <motion.div
            className={cn(
              "absolute top-1 bottom-1 rounded-full",
              // Use card-like background for the active segment
              "bg-background shadow-sm border border-border/50",
              // Shiny effect when enabled
              isShinyUI && "shiny-shimmer-base shiny-glow-base"
            )}
            style={{ zIndex: 1 }}
            initial={false}
            animate={{
              left: sliderStyle.left,
              width: sliderStyle.width
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 35
            }}
          />
        )}
        {children}
      </div>
    );
  }
);
SegmentedControlList.displayName = "SegmentedControlList";

const SegmentedControlTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value: triggerValue, onClick, children, ...props }, ref) => {
  const { value, setValue, registerTrigger } = React.useContext(SegmentedControlContext);
  const isActive = value === triggerValue;
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Register this trigger with the context
  React.useEffect(() => {
    registerTrigger(triggerValue, buttonRef.current);
  }, [triggerValue, registerTrigger]);

  return (
    <button
      ref={(node) => {
        // Handle both refs
        (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className={cn(
        // Base button styling - z-10 to be above the slider
        "relative z-10 flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ease-in-out",
        // Focus states
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        // Disabled states
        "disabled:pointer-events-none disabled:opacity-50",
        // Active state - foreground text, inactive uses muted
        isActive
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={(e) => {
        setValue(triggerValue);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
SegmentedControlTrigger.displayName = "SegmentedControlTrigger";

const SegmentedControlContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value: contentValue, ...props }, ref) => {
  const { value } = React.useContext(SegmentedControlContext);

  if (value !== contentValue) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  );
});
SegmentedControlContent.displayName = "SegmentedControlContent";

export { SegmentedControl, SegmentedControlList, SegmentedControlTrigger, SegmentedControlContent }
