"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

// ============================================================================
// Context
// ============================================================================

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
  registerTrigger: (value: string, element: HTMLButtonElement | null) => void
  triggerRefs: Map<string, HTMLButtonElement>
}

const TabsContext = React.createContext<TabsContextValue>({
  value: '',
  setValue: () => {},
  registerTrigger: () => {},
  triggerRefs: new Map(),
})

// ============================================================================
// Tabs (Root)
// ============================================================================

interface TabsProps {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  children: React.ReactNode
  className?: string
  urlNavigation?: string // Support for legacy prop (ignored)
}

const Tabs = ({
  value: controlledValue,
  onValueChange,
  defaultValue = '',
  children,
  className,
}: TabsProps) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const triggerRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map())
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const setValue = React.useCallback((newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }, [isControlled, onValueChange])

  const registerTrigger = React.useCallback((tabValue: string, element: HTMLButtonElement | null) => {
    if (element) {
      triggerRefs.current.set(tabValue, element)
    } else {
      triggerRefs.current.delete(tabValue)
    }
  }, [])

  return (
    <TabsContext.Provider value={{ value, setValue, registerTrigger, triggerRefs: triggerRefs.current }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// ============================================================================
// TabsList (Container with sliding underline)
// ============================================================================

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { value, triggerRefs } = React.useContext(TabsContext)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [underlineStyle, setUnderlineStyle] = React.useState({ width: 0, left: 0 })

    // Function to update underline position
    const updateUnderline = React.useCallback(() => {
      const container = containerRef.current
      const activeTab = triggerRefs.get(value)

      if (container && activeTab) {
        const containerRect = container.getBoundingClientRect()
        const tabRect = activeTab.getBoundingClientRect()

        // Account for scroll position in scrollable containers
        setUnderlineStyle({
          width: tabRect.width,
          left: tabRect.left - containerRect.left + container.scrollLeft,
        })
      }
    }, [value, triggerRefs])

    // Update underline position when value changes
    React.useEffect(() => {
      // Small delay to ensure refs are registered
      const timeoutId = setTimeout(updateUnderline, 0)
      return () => clearTimeout(timeoutId)
    }, [updateUnderline])

    // Also update on mount, resize, and scroll
    React.useEffect(() => {
      const container = containerRef.current

      // Initial measurement
      updateUnderline()

      // Update on resize
      window.addEventListener('resize', updateUnderline)

      // Update on scroll (for horizontally scrollable tabs)
      container?.addEventListener('scroll', updateUnderline)

      return () => {
        window.removeEventListener('resize', updateUnderline)
        container?.removeEventListener('scroll', updateUnderline)
      }
    }, [updateUnderline])

    return (
      <div
        ref={(node) => {
          containerRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        className={cn(
          "relative inline-flex items-center border-b border-border",
          className
        )}
        {...props}
      >
        {children}
        {/* Sliding underline indicator */}
        <div
          className="absolute bottom-0 h-0.5 bg-primary transition-all duration-200 ease-out"
          style={{
            width: underlineStyle.width,
            left: underlineStyle.left,
            transform: 'translateY(1px)', // Sit on top of border
          }}
        />
      </div>
    )
  }
)
TabsList.displayName = "TabsList"

// ============================================================================
// TabsTrigger (Button)
// ============================================================================

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value: triggerValue, onClick, ...props }, ref) => {
    const { value, setValue, registerTrigger } = React.useContext(TabsContext)
    const isActive = value === triggerValue
    const buttonRef = React.useRef<HTMLButtonElement>(null)

    // Register this trigger's ref
    React.useEffect(() => {
      registerTrigger(triggerValue, buttonRef.current)
      return () => registerTrigger(triggerValue, null)
    }, [triggerValue, registerTrigger])

    return (
      <button
        ref={(node) => {
          buttonRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        type="button"
        role="tab"
        aria-selected={isActive}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
          className
        )}
        onClick={(e) => {
          setValue(triggerValue)
          onClick?.(e)
        }}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

// ============================================================================
// TabsContent (Panel)
// ============================================================================

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value: contentValue, ...props }, ref) => {
    const { value } = React.useContext(TabsContext)

    if (value !== contentValue) {
      return null
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn("mt-4", className)}
        {...props}
      />
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
