"use client";

import React from 'react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { SubscriptionTierBadge } from './SubscriptionTierBadge';
import { sanitizeUsername, getDisplayUsername } from '../../utils/usernameSecurity';

/**
 * UsernameChip - A standardized component for displaying usernames
 *
 * This is the design system component for username display throughout WeWrite.
 * It provides consistent styling and multiple variants for different contexts.
 *
 * Variants:
 * - default: Compact chip with subtle background
 * - outline: Bordered chip, no fill
 * - ghost: No background, minimal styling
 * - pill: Full rounded pill style (more prominent)
 *
 * Sizes:
 * - xs: Extra small (for dense lists)
 * - sm: Small (default)
 * - md: Medium
 * - lg: Large (for prominent displays)
 */

export type UsernameChipVariant = 'default' | 'outline' | 'ghost' | 'pill';
export type UsernameChipSize = 'xs' | 'sm' | 'md' | 'lg';

interface UsernameChipProps {
  /** User ID for linking to profile */
  userId: string;
  /** Username to display */
  username: string;
  /** Visual variant */
  variant?: UsernameChipVariant;
  /** Size of the chip */
  size?: UsernameChipSize;
  /** Subscription tier for badge display */
  tier?: string | null;
  /** Subscription status */
  subscriptionStatus?: string | null;
  /** Subscription amount */
  subscriptionAmount?: number | null;
  /** Whether to show the subscription badge */
  showBadge?: boolean;
  /** Whether the chip is clickable/linkable */
  clickable?: boolean;
  /** Custom click handler (overrides default navigation) */
  onClick?: (e: React.MouseEvent) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show @ prefix before username */
  showAtSymbol?: boolean;
}

// Size configurations
const sizeStyles: Record<UsernameChipSize, string> = {
  xs: 'text-xs px-1.5 py-0.5 gap-0.5',
  sm: 'text-sm px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1',
  lg: 'text-base px-3 py-1.5 gap-1.5',
};

// Variant configurations - using design system tokens
const variantStyles: Record<UsernameChipVariant, {
  base: string;
  active: string;
  inactive: string;
}> = {
  default: {
    base: 'rounded-md',
    active: 'bg-primary/10 text-primary hover:bg-primary/15',
    inactive: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
  outline: {
    base: 'rounded-md border',
    active: 'border-primary/30 text-primary hover:border-primary/50 hover:bg-primary/5',
    inactive: 'border-border text-muted-foreground hover:bg-muted/50',
  },
  ghost: {
    base: 'rounded-md',
    active: 'text-primary hover:bg-primary/10',
    inactive: 'text-muted-foreground hover:bg-muted/50',
  },
  pill: {
    base: 'rounded-full',
    active: 'bg-primary/10 text-primary hover:bg-primary/15',
    inactive: 'bg-muted text-muted-foreground hover:bg-muted/80',
  },
};

export function UsernameChip({
  userId,
  username,
  variant = 'default',
  size = 'sm',
  tier,
  subscriptionStatus,
  subscriptionAmount,
  showBadge = false,
  clickable = true,
  onClick,
  className,
  showAtSymbol = false,
}: UsernameChipProps) {
  // Determine if user has active subscription
  const isActive = subscriptionStatus === 'active';

  // Get sanitized display username
  const displayUsername = getDisplayUsername(sanitizeUsername(username), false);

  // Get variant styles
  const variantConfig = variantStyles[variant];
  const stateStyles = isActive ? variantConfig.active : variantConfig.inactive;

  // Build the chip content
  const chipContent = (
    <span className="inline-flex items-center">
      <span className="truncate max-w-[120px]">
        {showAtSymbol && '@'}{displayUsername}
      </span>
      {showBadge && (
        <SubscriptionTierBadge
          tier={tier}
          status={subscriptionStatus}
          amount={subscriptionAmount}
          size={size === 'xs' ? 'sm' : size}
        />
      )}
    </span>
  );

  // Common class names
  const chipClasses = cn(
    'inline-flex items-center font-medium transition-colors no-underline',
    sizeStyles[size],
    variantConfig.base,
    stateStyles,
    clickable && 'cursor-pointer',
    className
  );

  // Non-clickable version
  if (!clickable) {
    return (
      <span className={chipClasses}>
        {chipContent}
      </span>
    );
  }

  // Custom onClick handler
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(chipClasses, 'focus:outline-none focus:ring-2 focus:ring-primary/20')}
      >
        {chipContent}
      </button>
    );
  }

  // Default: Link to user profile
  return (
    <Link
      href={`/u/${userId}`}
      className={cn(chipClasses, 'hover:no-underline focus:no-underline')}
    >
      {chipContent}
    </Link>
  );
}

/**
 * UsernameChipList - A wrapper for displaying multiple username chips
 *
 * Provides consistent spacing and wrapping behavior for lists of usernames.
 */
interface UsernameChipListProps {
  children: React.ReactNode;
  /** Gap between chips */
  gap?: 'xs' | 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

const gapStyles: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'gap-1',
  sm: 'gap-1.5',
  md: 'gap-2',
};

export function UsernameChipList({
  children,
  gap = 'sm',
  className,
}: UsernameChipListProps) {
  return (
    <div className={cn('flex flex-wrap items-center', gapStyles[gap], className)}>
      {children}
    </div>
  );
}

export default UsernameChip;
