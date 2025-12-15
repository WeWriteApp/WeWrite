"use client";

import React from 'react';
import { Badge, type BadgeProps } from './badge';
import { RollingCounter } from './rolling-counter';
import { cn } from '../../lib/utils';

type BadgeVariant = NonNullable<BadgeProps['variant']>;
type BadgeSize = NonNullable<BadgeProps['size']>;

interface CounterBadgeProps {
  /** The numeric value to display */
  value: number;
  /** Badge variant - matches Badge component variants */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Enable rolling animation when value changes */
  animated?: boolean;
  /** Animation duration per digit in ms */
  duration?: number;
  /** Stagger delay between digits in ms */
  staggerDelay?: number;
  /** Format the number with commas */
  formatWithCommas?: boolean;
  /** Prefix to display before the number (e.g., "$") */
  prefix?: string;
  /** Suffix to display after the number (e.g., " views") */
  suffix?: string;
  /** Decimal places to show */
  decimals?: number;
  /** Additional className */
  className?: string;
}

/**
 * CounterBadge - A Badge that displays a numeric counter with optional rolling animation
 *
 * Composes the Badge component with RollingCounter for animated number transitions.
 * Inherits all Badge variants (default, secondary, outline, etc.) and shiny mode support.
 *
 * @example
 * ```tsx
 * // Static counter badge
 * <CounterBadge value={42} />
 *
 * // Animated counter with prefix
 * <CounterBadge value={1234} animated prefix="$" />
 *
 * // Secondary variant with suffix
 * <CounterBadge value={99} variant="secondary" suffix=" new" />
 *
 * // Outline variant (non-animated)
 * <CounterBadge value={5} variant="outline" animated={false} />
 * ```
 */
export function CounterBadge({
  value,
  variant = 'default',
  size = 'default',
  animated = true,
  duration = 400,
  staggerDelay = 50,
  formatWithCommas = true,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}: CounterBadgeProps) {
  // Format value for static display
  const formatValue = (val: number): string => {
    let numStr = decimals > 0
      ? val.toFixed(decimals)
      : Math.floor(val).toString();

    if (formatWithCommas) {
      const parts = numStr.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      numStr = parts.join('.');
    }

    return `${prefix}${numStr}${suffix}`;
  };

  return (
    <Badge
      variant={variant}
      size={size}
      className={cn("tabular-nums", className)}
    >
      {animated ? (
        <RollingCounter
          value={value}
          duration={duration}
          staggerDelay={staggerDelay}
          formatWithCommas={formatWithCommas}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
        />
      ) : (
        formatValue(value)
      )}
    </Badge>
  );
}

export default CounterBadge;
