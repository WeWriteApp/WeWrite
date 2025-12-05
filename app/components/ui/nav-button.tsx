"use client";

import React from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface NavButtonProps {
  id: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  onHover?: () => void;
  onTouchStart?: () => void;
  isActive: boolean;
  ariaLabel: string;
  children?: React.ReactNode;
  variant?: 'desktop-sidebar' | 'desktop-sidebar-collapsed' | 'mobile-toolbar';
  isPressed?: boolean;
  isNavigating?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Central navigation button component used across desktop sidebar and mobile toolbar
 * Provides consistent styling, animations, and behavior
 */
export const NavButton = React.forwardRef<HTMLButtonElement, NavButtonProps>(({
  id,
  icon: Icon,
  label,
  onClick,
  onHover,
  onTouchStart,
  isActive,
  ariaLabel,
  children,
  variant = 'mobile-toolbar',
  isPressed = false,
  isNavigating = false,
  disabled = false,
  className,
  ...props
}, ref) => {
  
  // Base styles shared across all variants
  const baseStyles = [
    "relative group",
    "transition-all duration-200 ease-out",
    "touch-manipulation select-none",
    // Springy scale animations
    isPressed && "scale-110 duration-75",
    "active:scale-95 active:duration-75",
    // Loading state
    isNavigating && "opacity-75"
  ];

  // Standardized state styles with accent colors for active state
  const activeStyles = isActive
    ? "nav-selected-state text-accent"
    : [
        "text-muted-foreground hover:text-foreground",
        "nav-hover-state nav-active-state"
      ];

  // Variant-specific styles - simplified and clean
  const variantStyles = {
    'desktop-sidebar': [
      "flex items-center justify-start h-12 w-full rounded-lg px-3"
    ],
    'desktop-sidebar-collapsed': [
      // Centered icon button for collapsed state
      "flex items-center justify-center h-12 w-full rounded-lg"
    ],
    'mobile-toolbar': [
      "flex flex-col items-center justify-center h-14 flex-1 rounded-lg py-1 px-2 gap-0.5",
      "flex-shrink-0 min-w-0"
    ]
  };

  // Icon styles based on variant and active state
  const iconStyles = {
    'desktop-sidebar': `h-5 w-5 mr-3 flex-shrink-0 ${isActive ? 'text-accent' : ''}`,
    'desktop-sidebar-collapsed': `h-5 w-5 flex-shrink-0 ${isActive ? 'text-accent' : ''}`,
    'mobile-toolbar': `h-7 w-7 flex-shrink-0 ${isActive ? 'text-accent' : ''}`
  };

  // Label styles based on variant and active state
  const labelStyles = {
    'desktop-sidebar': `text-sm font-medium truncate flex-1 text-left ${isActive ? 'text-accent' : ''}`,
    'desktop-sidebar-collapsed': `text-[10px] font-medium mt-1 text-center leading-tight ${isActive ? 'text-accent' : ''}`,
    'mobile-toolbar': `text-[10px] font-medium text-center leading-tight ${isActive ? 'text-accent' : ''}`
  };

  // Show label based on variant - never show label in collapsed desktop sidebar
  const showLabel = variant !== 'desktop-sidebar-collapsed';

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={onHover}
      onTouchStart={onTouchStart}
      disabled={disabled}
      className={cn(
        baseStyles,
        variantStyles[variant],
        activeStyles,
        "border-0 bg-transparent cursor-pointer", // Reset button styles
        className
      )}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      {...props}
    >
      {/* Icon */}
      {Icon && (
        <Icon className={cn(
          "transition-colors duration-200",
          iconStyles[variant]
        )} />
      )}

      {/* Label */}
      {showLabel && (
        <span className={cn(
          "transition-colors duration-200",
          labelStyles[variant]
        )}>
          {label}
        </span>
      )}

      {/* Children (badges, indicators, etc.) */}
      {children}
    </button>
  );
});

NavButton.displayName = 'NavButton';
