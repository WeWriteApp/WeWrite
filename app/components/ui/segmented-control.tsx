"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "../../lib/utils"

// ============================================================================
// Context
// ============================================================================

interface SegmentedControlContextValue {
  value: string
  setValue: (value: string) => void
}

const SegmentedControlContext = React.createContext<SegmentedControlContextValue | null>(null)

function useSegmentedControl() {
  const context = React.useContext(SegmentedControlContext)
  if (!context) {
    throw new Error("SegmentedControl components must be used within a SegmentedControl")
  }
  return context
}

// ============================================================================
// SegmentedControl (Root)
// ============================================================================

interface SegmentedControlProps {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  children: React.ReactNode
  className?: string
  urlNavigation?: "hash" | "query" | "none"
  queryParam?: string
}

function SegmentedControl({
  value: controlledValue,
  onValueChange,
  defaultValue = "",
  children,
  className,
  urlNavigation = "none",
  queryParam = "tab",
}: SegmentedControlProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getInitialValue = React.useCallback(() => {
    if (urlNavigation === "hash" && typeof window !== "undefined") {
      return window.location.hash.slice(1) || defaultValue
    }
    if (urlNavigation === "query") {
      return searchParams.get(queryParam) || defaultValue
    }
    return defaultValue
  }, [urlNavigation, defaultValue, searchParams, queryParam])

  const [internalValue, setInternalValue] = React.useState(getInitialValue)
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  // Hash change listener
  React.useEffect(() => {
    if (urlNavigation === "hash" && !isControlled) {
      const handleHashChange = () => {
        const hash = window.location.hash.slice(1)
        if (hash) setInternalValue(hash)
      }
      window.addEventListener("hashchange", handleHashChange)
      return () => window.removeEventListener("hashchange", handleHashChange)
    }
  }, [urlNavigation, isControlled])

  const setValue = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setInternalValue(newValue)
      }
      if (urlNavigation === "hash") {
        window.location.hash = newValue
      } else if (urlNavigation === "query") {
        const params = new URLSearchParams(searchParams)
        params.set(queryParam, newValue)
        router.push(`?${params.toString()}`, { scroll: false })
      }
      onValueChange?.(newValue)
    },
    [isControlled, urlNavigation, searchParams, queryParam, router, onValueChange]
  )

  return (
    <SegmentedControlContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </SegmentedControlContext.Provider>
  )
}

// ============================================================================
// SegmentedControlList (Container with sliding indicator)
// ============================================================================

interface SegmentedControlListProps extends React.HTMLAttributes<HTMLDivElement> {}

const SegmentedControlList = React.forwardRef<HTMLDivElement, SegmentedControlListProps>(
  ({ className, children, ...props }, ref) => {
    const { value } = useSegmentedControl()

    // Extract values from children
    const items: string[] = []
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && typeof child.props.value === "string") {
        items.push(child.props.value)
      }
    })

    const count = items.length
    const activeIndex = Math.max(0, items.indexOf(value))

    return (
      <div
        ref={ref}
        className={cn(
          "relative grid h-10 w-full rounded-full p-1",
          "bg-neutral-alpha-10",
          className
        )}
        style={{
          gridTemplateColumns: `repeat(${count}, 1fr)`,
        }}
        {...props}
      >
        {/* Sliding pill indicator */}
        {count > 0 && (
          <div
            className="absolute top-1 bottom-1 rounded-full bg-white shadow-md transition-all duration-200 ease-out dark:bg-neutral-700"
            style={{
              width: `calc((100% - 8px) / ${count})`,
              left: `calc(4px + (100% - 8px) / ${count} * ${activeIndex})`,
            }}
          />
        )}
        {children}
      </div>
    )
  }
)
SegmentedControlList.displayName = "SegmentedControlList"

// ============================================================================
// SegmentedControlTrigger (Button)
// ============================================================================

interface SegmentedControlTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const SegmentedControlTrigger = React.forwardRef<HTMLButtonElement, SegmentedControlTriggerProps>(
  ({ className, value: triggerValue, children, onClick, ...props }, ref) => {
    const { value, setValue } = useSegmentedControl()
    const isActive = value === triggerValue

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        className={cn(
          "relative z-10 inline-flex items-center justify-center rounded-full px-3 py-1.5",
          "text-sm font-medium transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          className
        )}
        onClick={(e) => {
          setValue(triggerValue)
          onClick?.(e)
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)
SegmentedControlTrigger.displayName = "SegmentedControlTrigger"

// ============================================================================
// SegmentedControlContent (Panel)
// ============================================================================

interface SegmentedControlContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const SegmentedControlContent = React.forwardRef<HTMLDivElement, SegmentedControlContentProps>(
  ({ className, value: contentValue, ...props }, ref) => {
    const { value } = useSegmentedControl()

    if (value !== contentValue) return null

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
SegmentedControlContent.displayName = "SegmentedControlContent"

// ============================================================================
// Exports
// ============================================================================

export {
  SegmentedControl,
  SegmentedControlList,
  SegmentedControlTrigger,
  SegmentedControlContent,
}
