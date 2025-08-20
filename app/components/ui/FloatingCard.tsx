/**
 * FloatingCard Component - SINGLE SOURCE OF TRUTH for all glassmorphism styling
 *
 * This component replaces all legacy glass classes (liquid-glass, glass-overlay, etc.)
 * and provides consistent glassmorphism styling across the entire design system.
 *
 * Design System Benefits:
 * - Single component for all floating/glass elements
 * - Consistent shadow, blur, and transparency values
 * - Theme-aware styling (light/dark mode)
 * - Centralized maintenance point
 */

"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface FloatingCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'toolbar' | 'header' | 'overlay' | 'pledge';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  withGradient?: boolean;
  isExpanded?: boolean;
  noShadowAtTop?: boolean;
}

/**
 * FloatingCard Component - SIMPLIFIED AND CONSISTENT
 *
 * All floating elements use identical base styling with shadows built-in
 */
export function FloatingCard({
  children,
  className = '',
  variant = 'default',
  size = 'md',
  withGradient = false,
  isExpanded = false,
  noShadowAtTop = false
}: FloatingCardProps) {

  // Scroll detection for conditional shadow
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!noShadowAtTop) return;

    const handleScroll = () => {
      const scrolled = window.scrollY > 10;
      setIsScrolled(scrolled);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [noShadowAtTop]);

  // UNIFIED base styling for ALL floating elements using universal card system
  const baseClasses = cn(
    // Use universal card system with floating variant
    "wewrite-card wewrite-floating",
    // Rounded corners
    "rounded-2xl",
    // CRITICAL: Shadows - conditional for noShadowAtTop
    noShadowAtTop && !isScrolled
      ? "shadow-none" // No shadow when at top
      : "", // Default shadow from wewrite-card
    // Positioning
    "relative"
  );

  // Variant-specific modifications using new theme system
  const variantClasses = {
    default: "",
    toolbar: cn(
      // Enhanced background when expanded - use CSS variables
      isExpanded && "bg-[var(--card-floating-bg-hover)]"
    ),
    header: "",
    overlay: cn(
      // Stronger overlay effect for modals/overlays
      "shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
    ),
    pledge: cn(
      // Enhanced effect for allocation bars - slightly more opaque
      "bg-[var(--card-floating-bg-hover)]",
      "border-[var(--card-border-hover)]",
      "shadow-[0_6px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.25)]"
    )
  };

  const sizeClasses = {
    xs: "p-1",
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3"
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      data-floating-card={variant}
    >
      {children}

      {/* Optional bottom gradient */}
      {withGradient && (
        <div className="absolute -bottom-6 left-0 right-0 h-6 bg-gradient-to-b from-white/20 dark:from-card/20 to-transparent pointer-events-none" />
      )}
    </div>
  );
}

/**
 * FloatingToolbar - Specialized variant for mobile bottom navigation
 */
export function FloatingToolbar({
  children,
  className = '',
  isExpanded = false,
  ...props
}: Omit<FloatingCardProps, 'variant'>) {
  return (
    <FloatingCard
      variant="toolbar"
      className={className}
      isExpanded={isExpanded}
      {...props}
    >
      {children}
    </FloatingCard>
  );
}

/**
 * FloatingHeader - Specialized variant for floating headers
 */
export function FloatingHeader({
  children,
  className = '',
  withGradient = true,
  noShadowAtTop = false,
  ...props
}: Omit<FloatingCardProps, 'variant'>) {
  return (
    <FloatingCard
      variant="header"
      className={className}
      withGradient={withGradient}
      noShadowAtTop={noShadowAtTop}
      {...props}
    >
      {children}
    </FloatingCard>
  );
}

/**
 * FloatingOverlay - Specialized variant for overlay elements
 */
export function FloatingOverlay({
  children,
  className = '',
  ...props
}: Omit<FloatingCardProps, 'variant'>) {
  return (
    <FloatingCard
      variant="overlay"
      className={className}
      {...props}
    >
      {children}
    </FloatingCard>
  );
}

/**
 * FloatingPledge - Specialized variant for allocation bars (replaces glass-pledge)
 */
export function FloatingPledge({
  children,
  className = '',
  ...props
}: Omit<FloatingCardProps, 'variant'>) {
  return (
    <FloatingCard
      variant="pledge"
      className={className}
      {...props}
    >
      {children}
    </FloatingCard>
  );
}

export default FloatingCard;
