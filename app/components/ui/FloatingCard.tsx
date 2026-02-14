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
  variant?: 'default' | 'toolbar' | 'header' | 'overlay' | 'pledge' | 'docked';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isExpanded?: boolean;
  noShadowAtTop?: boolean;
  style?: React.CSSProperties;
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
  isExpanded = false,
  noShadowAtTop = false,
  style
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
    // Rounded corners (not for docked variant)
    variant !== 'docked' && "rounded-2xl",
    // CRITICAL: Shadows - conditional for noShadowAtTop
    noShadowAtTop && !isScrolled
      ? "shadow-none" // No shadow when at top
      : "" // Default shadow from wewrite-card
    // NO POSITIONING - let parent control this completely
  );

  // Variant-specific modifications using new theme system
  const variantClasses = {
    default: "",
    toolbar: cn(
      // Semi-transparent with blur when collapsed, opaque when expanded
      // CSS handles expanded state via [data-expanded="true"]
      "!bg-[var(--card-bg)] !border !border-border"
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
    ),
    docked: cn(
      // Docked to bottom - no rounded corners, only top border, no side shadows
      "!rounded-none !shadow-none",
      "!border-l-0 !border-r-0 !border-b-0 !border-t !border-border",
      // GPU-accelerated transitions for smooth animations
      "will-change-[background-color,border-radius]",
      // Semi-transparent card style when collapsed, solid (same brightness) when expanded
      isExpanded
        ? "!bg-[var(--card-bg)] !rounded-t-2xl"
        : ""
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
      data-expanded={isExpanded ? "true" : undefined}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * FloatingToolbar - Specialized variant for mobile bottom navigation (floating style)
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
 * DockedToolbar - Specialized variant for mobile bottom navigation (docked to bottom edge)
 * No margins, no corners, only top border. Expands upward into drawer with rounded top corners.
 */
export function DockedToolbar({
  children,
  className = '',
  isExpanded = false,
  ...props
}: Omit<FloatingCardProps, 'variant'>) {
  return (
    <FloatingCard
      variant="docked"
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
  noShadowAtTop = false,
  ...props
}: Omit<FloatingCardProps, 'variant'>) {
  return (
    <FloatingCard
      variant="header"
      className={className}
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
