"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "../../lib/utils"

// Segmented Control Context
const SegmentedControlContext = React.createContext<{
  value: string;
  setValue: (value: string) => void;
}>({ value: '', setValue: () => {} });

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
    <SegmentedControlContext.Provider value={{ value, setValue }}>
      <div className={className}>
        {children}
      </div>
    </SegmentedControlContext.Provider>
  );
};

const SegmentedControlList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Base segmented control styling - iOS-like appearance
        "relative inline-flex items-center rounded-lg p-1",
        // Light mode
        "bg-gray-100 dark:bg-gray-800",
        // Ensure proper spacing and sizing
        "h-10 w-full",
        className
      )}
      {...props}
    />
  )
);
SegmentedControlList.displayName = "SegmentedControlList";

const SegmentedControlTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value: triggerValue, onClick, children, ...props }, ref) => {
  const { value, setValue } = React.useContext(SegmentedControlContext);
  const isActive = value === triggerValue;

  return (
    <button
      ref={ref}
      className={cn(
        // Base button styling
        "relative flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out",
        // Focus states
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        // Disabled states
        "disabled:pointer-events-none disabled:opacity-50",
        // Active state - looks like selected segment
        isActive
          ? "bg-background text-foreground shadow-sm border-theme-strong"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
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
