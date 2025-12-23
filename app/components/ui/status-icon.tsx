"use client";

import React from 'react';
import { cn } from '../../lib/utils';
import { Icon, IconName } from '@/components/ui/Icon';

interface StatusIconProps {
  /** Status type that determines icon and color */
  status: 'success' | 'error' | 'warning' | 'info' | 'pending' | 'inactive' | 'active' | 'custom';
  /** Size of the icon container */
  size?: 'sm' | 'md' | 'lg';
  /** Custom icon to use (overrides status-based icon) */
  customIcon?: React.ComponentType<{ className?: string }>;
  /** Custom background color (overrides status-based color) */
  customBgColor?: string;
  /** Additional CSS classes */
  className?: string;
  /** Position relative to parent element */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'static';
  /** Custom positioning offset */
  offset?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  /** Whether to show a subtle animation */
  animate?: boolean;
}

/**
 * StatusIcon Component
 * 
 * Displays solid white icons inside color-filled circles for status indicators.
 * Replaces outline icons with a more modern, consistent design.
 */
export function StatusIcon({
  status,
  size = 'md',
  customIcon,
  customBgColor,
  className,
  position = 'static',
  offset,
  animate = false
}: StatusIconProps) {
  
  // Size classes for the container (made bigger)
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  };

  // Icon sizes in pixels
  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  // Position classes
  const positionClasses = {
    'top-right': 'absolute -top-1 -right-1',
    'top-left': 'absolute -top-1 -left-1',
    'bottom-right': 'absolute -bottom-1 -right-1',
    'bottom-left': 'absolute -bottom-1 -left-1',
    'static': ''
  };

  // Custom position style
  const customPositionStyle = offset ? {
    top: offset.top,
    right: offset.right,
    bottom: offset.bottom,
    left: offset.left
  } : {};

  // Get icon name and background color based on status
  const getStatusConfig = (): { iconName: IconName | null; customComponent?: React.ComponentType; bgColor: string } => {
    if (customIcon && customBgColor) {
      return {
        iconName: null,
        customComponent: customIcon,
        bgColor: customBgColor
      };
    }

    switch (status) {
      case 'success':
      case 'active':
        return {
          iconName: 'Check',
          bgColor: 'bg-success'
        };
      case 'error':
        return {
          iconName: 'X',
          bgColor: 'bg-red-500'
        };
      case 'warning':
        return {
          iconName: null,
          customComponent: () => <span className="text-white font-bold text-sm">!</span>,
          bgColor: 'bg-orange-500'
        };
      case 'info':
        return {
          iconName: 'Info',
          bgColor: 'bg-primary'
        };
      case 'pending':
        return {
          iconName: 'Clock',
          bgColor: 'bg-yellow-500'
        };
      case 'inactive':
        return {
          iconName: 'Ban',
          bgColor: 'bg-muted-foreground'
        };

      case 'custom':
      default:
        return {
          iconName: customIcon ? null : 'AlertCircle',
          customComponent: customIcon,
          bgColor: customBgColor || 'bg-muted-foreground'
        };
    }
  };

  const { iconName, customComponent, bgColor } = getStatusConfig();

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center',
        sizeClasses[size],
        bgColor,
        !offset && positionClasses[position],
        animate && 'animate-pulse',
        className
      )}
      style={offset ? customPositionStyle : {}}
      data-component="status-icon"
      data-status={status}
      data-size={size}
    >
      {customComponent ? (
        // Custom component (e.g., warning exclamation mark)
        React.createElement(customComponent)
      ) : iconName ? (
        // Regular icon
        <Icon
          name={iconName}
          size={iconSizes[size]}
          className={cn(
            'text-white flex-shrink-0',
            // Make check icon thicker
            status === 'success' || status === 'active' ? 'stroke-[3]' : 'stroke-[2]'
          )}
        />
      ) : null}
    </div>
  );
}

/**
 * StatusIconContainer Component
 * 
 * A wrapper component that provides relative positioning context
 * for the StatusIcon component.
 */
interface StatusIconContainerProps {
  children: React.ReactNode;
  className?: string;
  showStatus?: boolean;
  statusProps?: Omit<StatusIconProps, 'position'> & { position?: StatusIconProps['position'] };
}

export function StatusIconContainer({
  children,
  className,
  showStatus = false,
  statusProps = {}
}: StatusIconContainerProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {showStatus && (
        <StatusIcon
          position="top-right"
          {...statusProps}
        />
      )}
    </div>
  );
}

/**
 * Utility functions for common status icon patterns
 */
export const StatusIcons = {
  // Subscription status icons
  activeSubscription: () => <StatusIcon status="success" size="sm" position="top-right" offset={{ top: '-2px', right: '-2px' }} />,
  inactiveSubscription: () => <StatusIcon status="warning" size="sm" position="top-right" offset={{ top: '-2px', right: '-2px' }} />,

  // Transaction status icons
  completed: () => <StatusIcon status="success" size="sm" position="static" />,
  failed: () => <StatusIcon status="error" size="sm" position="static" />,
  processing: () => <StatusIcon status="pending" size="sm" position="static" />,

  // Security status icons
  secure: () => <StatusIcon status="success" size="sm" position="static" />,
  insecure: () => <StatusIcon status="error" size="sm" position="static" />,
  warning: () => <StatusIcon status="warning" size="sm" position="static" />,

  // Email verification
  verified: () => <StatusIcon status="success" size="sm" position="static" />,
  unverified: () => <StatusIcon status="error" size="sm" position="static" />,


};
