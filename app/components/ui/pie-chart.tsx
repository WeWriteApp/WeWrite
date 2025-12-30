'use client';

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Separator } from './separator';

export interface PieChartSegment {
  id: string;
  value: number;
  label: string;
  color: string; // Tailwind fill class like 'fill-primary' or 'fill-green-500', or hex color like '#3b82f6'
  bgColor: string; // Tailwind bg class for legend dot
  textColor?: string; // Optional text color for the value
}

/**
 * Maps common Tailwind color classes to their hex values
 * This is needed because dynamically generated class names aren't picked up by Tailwind's JIT compiler
 */
const COLOR_MAP: Record<string, string> = {
  // Primary colors
  'fill-primary': 'var(--primary)',
  'stroke-primary': 'var(--primary)',
  'bg-primary': 'var(--primary)',
  // Blue
  'fill-blue-500': '#3b82f6',
  'stroke-blue-500': '#3b82f6',
  'bg-blue-500': '#3b82f6',
  'fill-blue-600': '#2563eb',
  'stroke-blue-600': '#2563eb',
  // Green
  'fill-green-500': '#22c55e',
  'stroke-green-500': '#22c55e',
  'bg-green-500': '#22c55e',
  'fill-green-600': '#16a34a',
  'stroke-green-600': '#16a34a',
  // Red
  'fill-red-500': '#ef4444',
  'stroke-red-500': '#ef4444',
  'bg-red-500': '#ef4444',
  // Yellow/Amber
  'fill-yellow-500': '#eab308',
  'stroke-yellow-500': '#eab308',
  'bg-yellow-500': '#eab308',
  'fill-amber-500': '#f59e0b',
  'stroke-amber-500': '#f59e0b',
  'bg-amber-500': '#f59e0b',
  // Orange
  'fill-orange-500': '#f97316',
  'stroke-orange-500': '#f97316',
  'bg-orange-500': '#f97316',
  // Purple
  'fill-purple-500': '#a855f7',
  'stroke-purple-500': '#a855f7',
  'bg-purple-500': '#a855f7',
  // Muted
  'fill-muted-foreground': 'var(--muted-foreground)',
  'stroke-muted-foreground': 'var(--muted-foreground)',
  'bg-muted-foreground': 'var(--muted-foreground)',
};

/**
 * Converts a Tailwind color class to a usable fill value
 */
function getColorValue(colorClass: string): string {
  // If it's already a hex color or CSS variable, return as-is
  if (colorClass.startsWith('#') || colorClass.startsWith('var(') || colorClass.startsWith('rgb')) {
    return colorClass;
  }
  // Look up in color map
  return COLOR_MAP[colorClass] || COLOR_MAP[colorClass.replace('stroke-', 'fill-')] || 'currentColor';
}

interface PieChartProps {
  segments: PieChartSegment[];
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  centerLabel?: string;
  className?: string;
  formatValue?: (value: number) => string;
  /** Show total row in legend */
  showTotal?: boolean;
  totalLabel?: string;
  /** Gap between segments in degrees */
  gap?: number;
  /** Corner radius for segment ends */
  cornerRadius?: number;
  /**
   * Show background track for partial fill effect (gauge-style)
   * When true, renders a neutral background ring behind segments
   */
  showTrack?: boolean;
  /**
   * Color for the background track
   * @default 'rgba(0,0,0,0.08)' (neutral-alpha-10 equivalent)
   */
  trackColor?: string;
  /**
   * For partial fill mode: the maximum value representing 100% of the ring
   * If set, segments fill proportionally based on their total vs this max
   * Leave undefined for standard pie chart where all segments fill the whole ring
   */
  maxValue?: number;
}

/**
 * Converts polar coordinates to cartesian
 */
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

/**
 * Creates an arc path for a donut segment with rounded corners on the flat ends
 */
function describeArc(
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number
): string {
  // Clamp corner radius to half the stroke width
  const strokeWidth = outerRadius - innerRadius;
  const maxCornerRadius = strokeWidth / 2;
  const cr = Math.min(cornerRadius, maxCornerRadius);

  const outerStart = polarToCartesian(x, y, outerRadius, startAngle);
  const outerEnd = polarToCartesian(x, y, outerRadius, endAngle);
  const innerStart = polarToCartesian(x, y, innerRadius, startAngle);
  const innerEnd = polarToCartesian(x, y, innerRadius, endAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  // For very small arcs or no corner radius, use simple path
  if (cr <= 0) {
    return [
      "M", outerStart.x, outerStart.y,
      "A", outerRadius, outerRadius, 0, largeArcFlag, 1, outerEnd.x, outerEnd.y,
      "L", innerEnd.x, innerEnd.y,
      "A", innerRadius, innerRadius, 0, largeArcFlag, 0, innerStart.x, innerStart.y,
      "Z"
    ].join(" ");
  }

  // Calculate corner points offset inward by corner radius
  // For each corner, we need points on the outer arc, inner arc offset by cr
  const outerStartCr = polarToCartesian(x, y, outerRadius - cr, startAngle);
  const outerEndCr = polarToCartesian(x, y, outerRadius - cr, endAngle);
  const innerStartCr = polarToCartesian(x, y, innerRadius + cr, startAngle);
  const innerEndCr = polarToCartesian(x, y, innerRadius + cr, endAngle);

  // Calculate angle offset for the rounded corners along the arcs
  const outerAngleOffset = (cr / outerRadius) * (180 / Math.PI);
  const innerAngleOffset = (cr / innerRadius) * (180 / Math.PI);

  const outerStartOffset = polarToCartesian(x, y, outerRadius, startAngle + outerAngleOffset);
  const outerEndOffset = polarToCartesian(x, y, outerRadius, endAngle - outerAngleOffset);
  const innerStartOffset = polarToCartesian(x, y, innerRadius, startAngle + innerAngleOffset);
  const innerEndOffset = polarToCartesian(x, y, innerRadius, endAngle - innerAngleOffset);

  return [
    // Start at first point after the start corner on outer arc
    "M", outerStartOffset.x, outerStartOffset.y,
    // Outer arc to end corner
    "A", outerRadius, outerRadius, 0, largeArcFlag, 1, outerEndOffset.x, outerEndOffset.y,
    // Round corner: outer end (arc from outer to corner point)
    "A", cr, cr, 0, 0, 1, outerEndCr.x, outerEndCr.y,
    // Straight line down the flat end
    "L", innerEndCr.x, innerEndCr.y,
    // Round corner: inner end
    "A", cr, cr, 0, 0, 1, innerEndOffset.x, innerEndOffset.y,
    // Inner arc (going backwards)
    "A", innerRadius, innerRadius, 0, largeArcFlag, 0, innerStartOffset.x, innerStartOffset.y,
    // Round corner: inner start
    "A", cr, cr, 0, 0, 1, innerStartCr.x, innerStartCr.y,
    // Straight line up the flat start
    "L", outerStartCr.x, outerStartCr.y,
    // Round corner: outer start
    "A", cr, cr, 0, 0, 1, outerStartOffset.x, outerStartOffset.y,
    "Z"
  ].join(" ");
}

/**
 * Interactive Pie Chart with Legend
 *
 * Features:
 * - Separate segments with rounded corners and gaps between them
 * - Grey background track
 * - Hover/tap to highlight segments and legend items
 * - Mobile-optimized with tap interactions
 * - Smooth animations
 * - Customizable colors and sizing
 */
export function PieChart({
  segments,
  size = 120,
  strokeWidth = 16,
  showPercentage = true,
  centerLabel = 'allocated',
  className,
  formatValue = (v) => v.toString(),
  showTotal = false,
  totalLabel = 'Total',
  gap = 6, // Gap in degrees between segments
  cornerRadius = 3, // Corner radius in pixels
  showTrack = false,
  trackColor = 'rgba(0,0,0,0.08)',
  maxValue,
}: PieChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // Add padding for hover expansion
  const padding = 4;
  const effectiveSize = size + padding * 2;

  const outerRadius = size / 2;
  const innerRadius = outerRadius - strokeWidth;
  const center = effectiveSize / 2;

  // Calculate total
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);

  // For partial fill mode, calculate what percentage of the ring to fill
  const isPartialFill = maxValue !== undefined && maxValue > 0;
  const fillRatio = isPartialFill ? Math.min(total / maxValue, 1) : 1;

  // Count active segments (with value > 0)
  const activeSegments = segments.filter(seg => seg.value > 0);
  const numActiveSegments = activeSegments.length;

  // Total gap space in degrees (only between active segments in partial fill mode)
  const totalGapDegrees = numActiveSegments > 1 ? gap * (numActiveSegments - 1) : 0;

  // Available degrees for content
  // For partial fill: use fillRatio of 360 degrees minus gaps
  // For standard: use full 360 minus gap per segment
  const availableDegrees = isPartialFill
    ? (360 * fillRatio) - totalGapDegrees
    : 360 - (numActiveSegments > 0 ? gap * numActiveSegments : 0);

  // Build segment data with angles
  // Start at top (0 degrees after the -90 offset in polarToCartesian)
  let currentAngle = isPartialFill ? 0 : gap / 2;

  const segmentData = segments.map((segment, index) => {
    // For partial fill: percentage is relative to maxValue
    // For standard: percentage is relative to total
    const percentage = isPartialFill
      ? (maxValue! > 0 ? (segment.value / maxValue!) * 100 : 0)
      : (total > 0 ? (segment.value / total) * 100 : 0);

    // Sweep angle calculation
    const sweepAngle = total > 0 ? (segment.value / total) * availableDegrees : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweepAngle;

    // Move to next position (add gap only between segments, not after last)
    if (segment.value > 0) {
      const isLast = index === segments.length - 1 || segments.slice(index + 1).every(s => s.value <= 0);
      currentAngle = endAngle + (isLast ? 0 : gap);
    }

    return {
      ...segment,
      percentage,
      startAngle,
      endAngle,
      sweepAngle,
    };
  });

  // For center display:
  // - Partial fill: show total as percentage of maxValue
  // - Standard: show first segment's percentage
  const primaryPercentage = isPartialFill
    ? (maxValue! > 0 ? (total / maxValue!) * 100 : 0)
    : (segmentData[0]?.percentage || 0);

  const handleSegmentInteraction = (id: string | null) => {
    setHoveredSegment(id);
  };

  return (
    <div className={cn("flex flex-col items-center gap-4 w-full", className)}>
      {/* Pie Chart SVG */}
      <div
        className="relative flex-shrink-0"
        style={{ width: effectiveSize, height: effectiveSize }}
        onMouseLeave={() => handleSegmentInteraction(null)}
      >
        <svg
          width={effectiveSize}
          height={effectiveSize}
          viewBox={`0 0 ${effectiveSize} ${effectiveSize}`}
          style={{ overflow: 'visible' }}
        >
          {/* Background track for partial fill mode */}
          {showTrack && (
            <circle
              cx={center}
              cy={center}
              r={outerRadius - strokeWidth / 2}
              fill="none"
              stroke={trackColor}
              strokeWidth={strokeWidth}
            />
          )}

          {/* Render segments as paths with rounded corners */}
          {segmentData.map((segment) => {
            // Skip segments with no value
            if (segment.value <= 0 || segment.sweepAngle <= 0) return null;

            const isHovered = hoveredSegment === segment.id;
            const isOtherHovered = hoveredSegment !== null && hoveredSegment !== segment.id;

            // Expand radius on hover
            const hoverExpand = isHovered ? 2 : 0;
            const segmentOuterRadius = outerRadius + hoverExpand;
            const segmentInnerRadius = innerRadius - hoverExpand;

            const path = describeArc(
              center,
              center,
              segmentOuterRadius,
              segmentInnerRadius,
              segment.startAngle,
              segment.endAngle,
              cornerRadius
            );

            // Get actual color value (hex or CSS var) instead of relying on Tailwind class
            const fillColor = getColorValue(segment.color);

            return (
              <path
                key={segment.id}
                d={path}
                fill={fillColor}
                className={cn(
                  'transition-all duration-200 cursor-pointer',
                  isHovered && 'opacity-100',
                  isOtherHovered && 'opacity-40'
                )}
                onMouseEnter={() => handleSegmentInteraction(segment.id)}
                onTouchStart={() => handleSegmentInteraction(segment.id)}
                style={{
                  opacity: isOtherHovered ? 0.4 : 1,
                  transition: 'opacity 0.2s ease-out, d 0.2s ease-out'
                }}
              />
            );
          })}
        </svg>

        {/* Center text */}
        {showPercentage && (
          <div
            className="absolute flex flex-col items-center justify-center pointer-events-none"
            style={{
              top: padding,
              left: padding,
              width: size,
              height: size,
            }}
          >
            <span className="text-2xl font-bold tabular-nums">
              {Math.round(primaryPercentage)}%
            </span>
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="w-full space-y-1">
        {segmentData.map((segment) => {
          const isHovered = hoveredSegment === segment.id;
          const isOtherHovered = hoveredSegment !== null && hoveredSegment !== segment.id;

          // Get color for the legend dot
          const dotColor = getColorValue(segment.bgColor);

          return (
            <div
              key={segment.id}
              className={cn(
                "flex items-center justify-between py-1.5 rounded-md cursor-pointer transition-all duration-200",
                isHovered && "bg-muted/50",
                isOtherHovered && "opacity-40"
              )}
              onMouseEnter={() => handleSegmentInteraction(segment.id)}
              onMouseLeave={() => handleSegmentInteraction(null)}
              onTouchStart={() => handleSegmentInteraction(segment.id)}
              onTouchEnd={() => handleSegmentInteraction(null)}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-200", isHovered && "scale-125")}
                  style={{ backgroundColor: dotColor }}
                />
                <span className="text-sm text-muted-foreground">{segment.label}</span>
              </div>
              <span className={cn("font-medium text-sm tabular-nums", segment.textColor || "text-foreground")}>
                {formatValue(segment.value)}
              </span>
            </div>
          );
        })}

        {/* Total row */}
        {showTotal && (
          <>
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{totalLabel}</span>
              <span className="font-medium text-sm tabular-nums">{formatValue(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PieChart;
