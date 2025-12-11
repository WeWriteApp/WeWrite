"use client";

import React from 'react';
import { cn } from '../../lib/utils';

interface WarningDotProps {
  /** Whether to show the warning dot */
  show?: boolean;
  /** Size of the warning dot */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant of the warning dot */
  variant?: 'warning' | 'error' | 'critical' | 'info';
  /** Additional CSS classes */
  className?: string;
  /** Position relative to parent element */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Whether to animate the dot */
  animate?: boolean;
  /** Custom positioning offset */
  offset?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

/**
 * WarningDot Component
 * 
 * A small animated dot that can be positioned relative to other elements
 * to indicate warnings, errors, or critical states.
 */
export function WarningDot({
  show = true,
  size = 'md',
  variant = 'warning',
  className,
  position = 'top-right',
  animate = true,
  offset
}: WarningDotProps) {
  if (!show) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  // Color classes based on variant
  const variantClasses = {
    warning: 'bg-orange-500 border-orange-600',
    error: 'bg-red-500 border-red-600',
    critical: 'bg-destructive border-destructive',
    info: 'bg-primary border-primary'
  };

  // Position classes
  const positionClasses = {
    'top-right': '-top-1 -right-1',
    'top-left': '-top-1 -left-1',
    'bottom-right': '-bottom-1 -right-1',
    'bottom-left': '-bottom-1 -left-1'
  };

  // Custom positioning styles
  const customPositionStyle = offset ? {
    top: offset.top,
    right: offset.right,
    bottom: offset.bottom,
    left: offset.left
  } : {};

  return (
    <div
      className={cn(
        'absolute rounded-full border-2 border-background z-10',
        sizeClasses[size],
        variantClasses[variant],
        !offset && positionClasses[position],
        animate && 'animate-pulse',
        className
      )}
      style={offset ? customPositionStyle : {}}
      data-component="warning-dot"
      data-testid="warning-dot"
      data-variant={variant}
      data-size={size}
    >
      {/* Inner pulsing dot for enhanced visibility */}
      {animate && (
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            variantClasses[variant],
            'animate-ping'
          )}
          style={{
            animationDuration: '2s'
          }}
        />
      )}
    </div>
  );
}

/**
 * WarningDotContainer Component
 * 
 * A wrapper component that provides relative positioning context
 * for the WarningDot component.
 */
interface WarningDotContainerProps {
  children: React.ReactNode;
  className?: string;
  showWarning?: boolean;
  warningProps?: Omit<WarningDotProps, 'show'>;
}

export function WarningDotContainer({
  children,
  className,
  showWarning = false,
  warningProps = {}
}: WarningDotContainerProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      <WarningDot
        show={showWarning}
        {...warningProps}
      />
    </div>
  );
}
