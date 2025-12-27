"use client";

import React from 'react';
import { cn } from '../../lib/utils';
import { Icon, IconName } from './Icon';

/**
 * Shared sidebar menu item styling classes.
 * Use these when you need custom implementations but want consistent styling.
 */
export const sidebarMenuItemStyles = {
  base: "flex items-center rounded-lg transition-colors duration-150 select-none cursor-pointer",
  active: "bg-accent-15 text-accent hover:bg-accent-25 active:bg-accent-35 active:scale-[0.98] active:duration-75",
  inactive: "text-muted-foreground hover:text-foreground hover:bg-alpha-10 active:bg-alpha-15 active:scale-[0.98] active:duration-75",
  icon: {
    active: "text-accent",
    inactive: "text-muted-foreground",
  },
} as const;

export interface SidebarMenuItemProps {
  /** Icon to display (Lucide icon name) */
  icon?: IconName | React.ComponentType<{ className?: string }>;
  /** Label text */
  label: string;
  /** Whether this item is currently active/selected */
  isActive?: boolean;
  /** Click handler */
  onClick?: (e?: React.MouseEvent) => void;
  /** Mouse enter handler (for preloading) */
  onMouseEnter?: () => void;
  /** Whether to show expanded content (icon + label) or collapsed (icon only) */
  showContent?: boolean;
  /** Additional content to render after the label (e.g., status indicators) */
  children?: React.ReactNode;
  /** Additional className for the button */
  className?: string;
  /** Render as a link instead of button */
  href?: string;
  /** Size variant */
  size?: 'default' | 'compact';
}

/**
 * SidebarMenuItem - A shared component for all sidebar navigation items.
 *
 * Use this component across all sidebars (main, admin, settings, design system)
 * to ensure consistent styling and behavior.
 *
 * Features:
 * - Consistent hover/active states using alpha tokens
 * - Support for collapsed (icon-only) and expanded modes
 * - Support for both icons (string name or component) and status indicators
 * - Accessible with proper ARIA labels
 */
export function SidebarMenuItem({
  icon,
  label,
  isActive = false,
  onClick,
  onMouseEnter,
  showContent = true,
  children,
  className,
  href,
  size = 'default',
}: SidebarMenuItemProps) {
  const sizeClasses = size === 'compact'
    ? "px-2 py-1.5 text-sm"
    : showContent
      ? "h-10 px-3 py-2"
      : "h-10 w-10 justify-center";

  const content = (
    <>
      {/* Icon */}
      {icon && (
        <span className={cn(
          "flex-shrink-0 flex items-center justify-center",
          showContent ? "mr-3" : ""
        )}>
          {typeof icon === 'string' ? (
            <Icon
              name={icon as IconName}
              size={20}
              className={isActive ? sidebarMenuItemStyles.icon.active : sidebarMenuItemStyles.icon.inactive}
            />
          ) : (
            React.createElement(icon, {
              className: cn(
                "h-5 w-5",
                isActive ? sidebarMenuItemStyles.icon.active : sidebarMenuItemStyles.icon.inactive
              )
            })
          )}
        </span>
      )}

      {/* Label - only shown when expanded */}
      {showContent && (
        <span className={cn(
          "flex-1 text-left truncate",
          size === 'default' && "text-sm font-medium"
        )}>
          {label}
        </span>
      )}

      {/* Status indicators / children */}
      {showContent && children}
    </>
  );

  const sharedProps = {
    className: cn(
      sidebarMenuItemStyles.base,
      sizeClasses,
      isActive ? sidebarMenuItemStyles.active : sidebarMenuItemStyles.inactive,
      showContent ? "w-full" : "",
      className
    ),
    onClick,
    onMouseEnter,
    title: !showContent ? label : undefined,
    'aria-label': label,
    'aria-current': isActive ? 'page' as const : undefined,
  };

  // Render as anchor if href is provided
  if (href) {
    return (
      <a href={href} {...sharedProps}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" {...sharedProps}>
      {content}
    </button>
  );
}

export default SidebarMenuItem;
