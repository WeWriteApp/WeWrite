"use client";

import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '@/components/ui/Icon';

export type LoadingVariant = 'spinner' | 'dots' | 'pulse' | 'skeleton';
export type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingStateProps {
  /** The loading message to display */
  message?: string;
  /** Visual variant of the loading indicator */
  variant?: LoadingVariant;
  /** Size of the loading indicator */
  size?: LoadingSize;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show inside a card container */
  showCard?: boolean;
  /** Minimum height for the container */
  minHeight?: string;
}

/**
 * LoadingState Component
 *
 * A standardized loading state component with multiple visual variants.
 * Use this for consistent loading states across the app.
 */
export function LoadingState({
  message,
  variant = 'spinner',
  size = 'md',
  className,
  showCard = false,
  minHeight = 'h-64'
}: LoadingStateProps) {
  const sizeClasses = {
    sm: {
      spinner: 16,
      spinnerContainer: 'h-4 w-4',
      text: 'text-sm',
      gap: 'gap-2',
      dots: 'h-1.5 w-1.5',
      pulse: 'h-8 w-8'
    },
    md: {
      spinner: 20,
      spinnerContainer: 'h-5 w-5',
      text: 'text-sm',
      gap: 'gap-3',
      dots: 'h-2 w-2',
      pulse: 'h-12 w-12'
    },
    lg: {
      spinner: 24,
      spinnerContainer: 'h-6 w-6',
      text: 'text-base',
      gap: 'gap-4',
      dots: 'h-2.5 w-2.5',
      pulse: 'h-16 w-16'
    }
  };

  const sizes = sizeClasses[size];

  const renderIndicator = () => {
    switch (variant) {
      case 'spinner':
        return (
          <div className="relative">
            {/* Outer glow ring */}
            <div className={cn(
              sizes.spinnerContainer,
              "absolute inset-0 rounded-full bg-accent-30 blur-md animate-pulse"
            )} />
            {/* Spinner */}
            <Icon name="Loader" className="text-accent-80 relative" />
          </div>
        );

      case 'dots':
        return (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  sizes.dots,
                  "rounded-full bg-accent-60 animate-bounce"
                )}
                style={{
                  animationDelay: `${i * 150}ms`,
                  animationDuration: '600ms'
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div className="relative flex items-center justify-center">
            {/* Outer pulse ring */}
            <div className={cn(
              sizes.pulse,
              "absolute rounded-full bg-accent-20 animate-ping"
            )} />
            {/* Middle ring */}
            <div className={cn(
              sizes.pulse,
              "absolute rounded-full bg-accent-30 animate-pulse"
            )} />
            {/* Inner solid circle */}
            <div className={cn(
              "rounded-full bg-accent-60",
              size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
            )} />
          </div>
        );

      case 'skeleton':
        return (
          <div className="w-full max-w-sm space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
          </div>
        );

      default:
        return null;
    }
  };

  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center",
      sizes.gap,
      minHeight,
      className
    )}>
      {renderIndicator()}
      {message && (
        <span className={cn(
          "text-muted-foreground font-medium",
          sizes.text
        )}>
          {message}
        </span>
      )}
    </div>
  );

  if (showCard) {
    return (
      <div className="wewrite-card">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * LoadingSpinner - Simple inline spinner
 *
 * Use for button loading states or inline indicators.
 */
export function LoadingSpinner({
  className,
  size = 'md'
}: {
  className?: string;
  size?: LoadingSize;
}) {
  const sizes = {
    sm: 12,
    md: 16,
    lg: 20
  };

  return (
    <Icon name="Loader" size={sizes[size]} className={className} />
  );
}

/**
 * LoadingDots - Three bouncing dots
 *
 * Use for inline "typing" or processing indicators.
 */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
          style={{
            animationDelay: `${i * 150}ms`,
            animationDuration: '600ms'
          }}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonLine - Single skeleton loading line
 */
export function SkeletonLine({
  className,
  width = 'w-full'
}: {
  className?: string;
  width?: string;
}) {
  return (
    <div className={cn(
      "h-4 bg-muted rounded animate-pulse",
      width,
      className
    )} />
  );
}

/**
 * SkeletonCard - Card-shaped skeleton placeholder
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn(
      "wewrite-card space-y-3 animate-pulse",
      className
    )}>
      <div className="h-5 bg-muted rounded w-2/3" />
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-4/5" />
      </div>
    </div>
  );
}

/**
 * StatsCardSkeleton - Skeleton for stats cards with icon, label, sparkline and value
 * Used in ContentPageStats and similar components
 */
export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      "wewrite-card flex items-center justify-between animate-pulse",
      className
    )}>
      {/* Left side: icon + label */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 bg-muted rounded" />
        <div className="h-4 bg-muted rounded w-16" />
      </div>
      {/* Right side: sparkline + value pill */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-16 bg-muted rounded" />
        <div className="h-6 w-10 bg-muted rounded-md" />
      </div>
    </div>
  );
}

/**
 * StatsCarouselSkeleton - Skeleton for horizontal scrolling stats carousel
 * Used in UserProfileStats and similar components
 */
export function StatsCarouselSkeleton({
  count = 4,
  className
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl", className)}>
      <div className="flex gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted animate-pulse flex-shrink-0"
          >
            <div className="flex flex-col">
              <div className="h-3 w-12 bg-muted-foreground/20 rounded mb-1" />
              <div className="h-4 w-8 bg-muted-foreground/20 rounded" />
            </div>
            <div className="w-12 h-5 bg-muted-foreground/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default LoadingState;
