"use client";

import { cn } from "@/lib/utils";

/**
 * Skeleton component for loading states
 * 
 * @param {Object} props - Component props
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} - Skeleton component
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/**
 * ShimmerEffect component for enhanced loading states
 * Adds a shimmer animation to loading skeletons
 * 
 * @param {Object} props - Component props
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Child elements
 * @returns {JSX.Element} - ShimmerEffect component
 */
export function ShimmerEffect({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted rounded-md",
        className
      )}
      {...props}
    >
      {children}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

/**
 * UserListSkeleton component for user lists
 * 
 * @param {Object} props - Component props
 * @param {number} props.count - Number of skeleton items to render
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} - UserListSkeleton component
 */
export function UserListSkeleton({ count = 5, className, ...props }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array(count)
        .fill(0)
        .map((_, i) => (
          <div 
            key={i} 
            className="flex items-center space-x-4 animate-in fade-in-0"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <ShimmerEffect className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <ShimmerEffect className="h-4 w-[250px]" />
              <ShimmerEffect className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
    </div>
  );
}
