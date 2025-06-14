"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

import { cn } from "../../lib/utils"

// Enhanced Tabs component with automatic URL navigation support
interface TabsProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  /**
   * Enable URL-based navigation for tabs
   * - 'hash': Use hash-based navigation (#tab) for same-page contexts
   * - 'query': Use query parameter (?tab=value) for complex scenarios
   * - false: Disable URL navigation (default behavior)
   */
  urlNavigation?: 'hash' | 'query' | false;

  /**
   * Query parameter name for 'query' strategy (default: 'tab')
   */
  urlParam?: string;

  /**
   * Whether to replace history instead of pushing new entries (default: true)
   */
  replaceHistory?: boolean;
}

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({
  urlNavigation = false,
  urlParam = 'tab',
  replaceHistory = true,
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  defaultValue,
  children,
  ...props
}, ref) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Internal state for URL navigation
  const [internalValue, setInternalValue] = React.useState<string>(() => {
    if (!urlNavigation || typeof window === 'undefined') {
      return defaultValue || '';
    }

    // Parse initial value from URL
    let urlValue: string | null = null;

    if (urlNavigation === 'hash') {
      urlValue = window.location.hash.slice(1) || null;
    } else if (urlNavigation === 'query') {
      urlValue = searchParams?.get(urlParam) || null;
    }

    return urlValue || defaultValue || '';
  });

  // Determine if we're using controlled or uncontrolled mode
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  // Function to update URL based on strategy
  const updateUrl = React.useCallback((tabValue: string) => {
    if (!urlNavigation || typeof window === 'undefined') return;

    if (urlNavigation === 'hash') {
      const newHash = tabValue ? `#${tabValue}` : '';
      if (replaceHistory) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${newHash}`);
      } else {
        window.location.hash = newHash;
      }
    } else if (urlNavigation === 'query') {
      const url = new URL(window.location.href);
      if (tabValue) {
        url.searchParams.set(urlParam, tabValue);
      } else {
        url.searchParams.delete(urlParam);
      }

      if (replaceHistory) {
        window.history.replaceState(null, '', url.toString());
      } else {
        window.history.pushState(null, '', url.toString());
      }
    }
  }, [urlNavigation, urlParam, replaceHistory]);

  // Handle value changes
  const handleValueChange = React.useCallback((newValue: string) => {
    // Update internal state if uncontrolled
    if (!isControlled) {
      setInternalValue(newValue);
    }

    // Update URL if URL navigation is enabled
    if (urlNavigation) {
      updateUrl(newValue);
    }

    // Call the original onValueChange if provided
    if (controlledOnValueChange) {
      controlledOnValueChange(newValue);
    }
  }, [isControlled, urlNavigation, updateUrl, controlledOnValueChange]);

  // Listen for browser navigation (back/forward) for hash strategy
  React.useEffect(() => {
    if (urlNavigation === 'hash' && !isControlled) {
      const handleHashChange = () => {
        const newValue = window.location.hash.slice(1) || defaultValue || '';
        setInternalValue(newValue);
      };

      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, [urlNavigation, isControlled, defaultValue]);

  // Listen for URL parameter changes for query strategy
  React.useEffect(() => {
    if (urlNavigation === 'query' && !isControlled) {
      const urlValue = searchParams?.get(urlParam);
      if (urlValue && urlValue !== internalValue) {
        setInternalValue(urlValue);
      }
    }
  }, [urlNavigation, urlParam, searchParams, isControlled, internalValue]);

  return (
    <TabsPrimitive.Root
      ref={ref}
      value={currentValue}
      onValueChange={handleValueChange}
      {...props}
    >
      {children}
    </TabsPrimitive.Root>
  );
});

Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-foreground/70 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
