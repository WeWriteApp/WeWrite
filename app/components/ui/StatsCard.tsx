"use client";

import React from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import SimpleSparkline from '../utils/SimpleSparkline';
import AnimatedNumber from './AnimatedNumber';
import { cn } from '../../lib/utils';

/**
 * StatsCard Component
 *
 * A unified component for displaying page statistics with consistent styling.
 * Used for: Views, Recent Edits, Supporters, Custom Date, and other stats.
 *
 * Features:
 * - Consistent header with icon and title
 * - Optional sparkline visualization
 * - Pill-style value display with accent color
 * - Optional children for additional content (like diff previews)
 * - Loading state support
 * - Click handler for interactive cards
 */

// Accent color values using CSS variables
const accentColorValue = 'oklch(var(--primary))';
const pillTextColor = 'oklch(var(--primary-foreground))';

export interface StatsCardProps {
  /** Icon to display in header */
  icon: IconName;
  /** Title text for the header */
  title: string;
  /** Main value to display (number will be animated) */
  value?: number | string | null;
  /** Format function for the value */
  formatValue?: (value: number | string) => string;
  /** Whether to animate numeric values */
  animateValue?: boolean;
  /** Sparkline data (array of numbers for 24h trend) */
  sparklineData?: number[];
  /** Whether to show the sparkline */
  showSparkline?: boolean;
  /** Label for the sparkline period (default: "24h") */
  sparklineLabel?: string;
  /** Whether the card is in loading state */
  loading?: boolean;
  /** Click handler for interactive cards */
  onClick?: () => void;
  /** Additional className for the card */
  className?: string;
  /** Children content (e.g., diff preview, timestamps) */
  children?: React.ReactNode;
  /** Hide the card when value is empty/null/0 */
  hideWhenEmpty?: boolean;
  /** Custom placeholder text when value is empty (for editable cards) */
  emptyPlaceholder?: string;
  /** Whether this is an editable field (shows dashed border when empty) */
  isEditable?: boolean;
}

export function StatsCard({
  icon,
  title,
  value,
  formatValue,
  animateValue = true,
  sparklineData,
  showSparkline = true,
  sparklineLabel = "24h",
  loading = false,
  onClick,
  className,
  children,
  hideWhenEmpty = false,
  emptyPlaceholder,
  isEditable = false,
}: StatsCardProps) {
  // Check if value is empty
  const isEmpty = value === null || value === undefined || value === '' || value === 0;

  // Hide card if empty and hideWhenEmpty is true
  if (hideWhenEmpty && isEmpty && !loading) {
    return null;
  }

  // Format the display value
  const displayValue = (() => {
    if (value === null || value === undefined) return null;
    if (formatValue) return formatValue(value);
    if (typeof value === 'number') return value.toLocaleString();
    return value;
  })();

  // Determine if the value should be animated
  const shouldAnimate = animateValue && typeof value === 'number';

  return (
    <div
      className={cn(
        "wewrite-card min-h-[52px]",
        onClick && "cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors",
        children && "flex flex-col gap-3",
        className
      )}
      onClick={onClick}
    >
      {/* Header with icon, title, and value */}
      <div className="flex items-center justify-between">
        {/* Left side: Icon + Title */}
        <div className="flex items-center gap-2">
          <Icon name={icon} size={20} className="text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>

        {/* Right side: Sparkline + Value */}
        <div className="flex items-center gap-2">
          {/* Sparkline */}
          {showSparkline && sparklineData && sparklineData.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-8 w-16 relative">
                <SimpleSparkline
                  data={sparklineData}
                  height={30}
                  color={accentColorValue}
                />
              </div>
              <span className="text-xs font-medium" style={{ color: accentColorValue }}>
                {sparklineLabel}
              </span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <Icon name="Loader" size={20} />
          )}

          {/* Value pill */}
          {!loading && displayValue !== null && (
            <div
              className="text-sm font-medium px-2 py-1 rounded-md"
              style={{
                backgroundColor: accentColorValue,
                color: pillTextColor
              }}
            >
              {shouldAnimate ? (
                <AnimatedNumber value={value as number} />
              ) : (
                displayValue
              )}
            </div>
          )}

          {/* Empty state for editable fields */}
          {!loading && isEmpty && isEditable && emptyPlaceholder && (
            <div className="text-muted-foreground text-sm font-medium px-2 py-1 rounded-md border border-dashed border-theme-medium">
              {emptyPlaceholder}
            </div>
          )}
        </div>
      </div>

      {/* Children content (additional info like diff preview, timestamps) */}
      {children && (
        <div className="border-t border-neutral-15 pt-3 -mb-1">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * StatsCardHeader Component
 *
 * A simpler header-only component for use in cards with custom content.
 * Provides the same header styling as StatsCard but allows custom body content.
 */
export interface StatsCardHeaderProps {
  icon: IconName;
  title: string;
  value?: number | string | null;
  formatValue?: (value: number | string) => string;
  animateValue?: boolean;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function StatsCardHeader({
  icon,
  title,
  value,
  formatValue,
  animateValue = true,
  loading = false,
  className,
  children,
}: StatsCardHeaderProps) {
  const displayValue = (() => {
    if (value === null || value === undefined) return null;
    if (formatValue) return formatValue(value);
    if (typeof value === 'number') return value.toLocaleString();
    return value;
  })();

  const shouldAnimate = animateValue && typeof value === 'number';

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-2">
        <Icon name={icon} size={20} className="text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {loading && <Icon name="Loader" size={20} />}
        {!loading && displayValue !== null && (
          <div
            className="text-sm font-medium px-2 py-1 rounded-md"
            style={{
              backgroundColor: accentColorValue,
              color: pillTextColor
            }}
          >
            {shouldAnimate ? (
              <AnimatedNumber value={value as number} />
            ) : (
              displayValue
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default StatsCard;
