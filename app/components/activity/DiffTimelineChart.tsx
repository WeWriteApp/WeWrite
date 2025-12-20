"use client";

import React from 'react';

interface DiffDataPoint {
  added: number;
  removed: number;
  timestamp?: string;
  id?: string;
}

interface DiffTimelineChartProps {
  data: DiffDataPoint[];
  height?: number;
  className?: string;
  onBarClick?: (index: number, item: DiffDataPoint) => void;
}

/**
 * DiffTimelineChart - Visualizes additions and deletions over time
 *
 * Shows a bar chart with:
 * - Green bars going UP for additions
 * - Red bars going DOWN for deletions
 * - Gray baseline in the middle
 * - Rounded bar caps
 */
export default function DiffTimelineChart({
  data,
  height = 80,
  className = "",
  onBarClick
}: DiffTimelineChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Reverse the data so oldest is on the left, newest on the right
  const reversedData = [...data].reverse();

  // Calculate the maximum value for scaling
  const maxAdded = Math.max(...reversedData.map(d => d.added || 0), 1);
  const maxRemoved = Math.max(...reversedData.map(d => d.removed || 0), 1);
  const maxValue = Math.max(maxAdded, maxRemoved);

  // Calculate bar dimensions
  const barWidth = Math.max(4, Math.min(12, 300 / reversedData.length));
  const gap = Math.max(2, Math.min(4, barWidth * 0.3));
  const centerY = height / 2;
  const maxBarHeight = (height / 2) - 4; // Leave some padding

  // Scale a value to bar height
  const scaleValue = (value: number) => {
    if (value === 0) return 0;
    // Use sqrt scaling to prevent huge bars from dominating
    const scaled = Math.sqrt(value) / Math.sqrt(maxValue);
    return Math.max(4, scaled * maxBarHeight); // Minimum 4px for visibility
  };

  const totalWidth = reversedData.length * (barWidth + gap) - gap;

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <svg
        width={totalWidth}
        height={height}
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="overflow-visible"
      >
        {/* Center baseline - gray dashes */}
        <line
          x1={0}
          y1={centerY}
          x2={totalWidth}
          y2={centerY}
          stroke="oklch(var(--muted-foreground) / 0.3)"
          strokeWidth={2}
          strokeDasharray="4 4"
          strokeLinecap="round"
        />

        {/* Bars */}
        {reversedData.map((item, index) => {
          const x = index * (barWidth + gap);
          const addedHeight = scaleValue(item.added || 0);
          const removedHeight = scaleValue(item.removed || 0);
          const originalIndex = data.length - 1 - index;

          return (
            <g
              key={index}
              className={onBarClick ? "cursor-pointer" : ""}
              onClick={() => onBarClick?.(originalIndex, data[originalIndex])}
            >
              {/* Addition bar (goes up from center) */}
              {item.added > 0 && (
                <rect
                  x={x}
                  y={centerY - addedHeight}
                  width={barWidth}
                  height={addedHeight}
                  rx={barWidth / 2}
                  ry={barWidth / 2}
                  fill="oklch(var(--success))"
                  className="transition-opacity hover:opacity-80"
                />
              )}

              {/* Removal bar (goes down from center) */}
              {item.removed > 0 && (
                <rect
                  x={x}
                  y={centerY}
                  width={barWidth}
                  height={removedHeight}
                  rx={barWidth / 2}
                  ry={barWidth / 2}
                  fill="oklch(var(--error))"
                  className="transition-opacity hover:opacity-80"
                />
              )}

              {/* No changes indicator (gray dot) */}
              {(!item.added || item.added === 0) && (!item.removed || item.removed === 0) && (
                <rect
                  x={x}
                  y={centerY - 2}
                  width={barWidth}
                  height={4}
                  rx={2}
                  ry={2}
                  fill="oklch(var(--muted-foreground) / 0.4)"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
