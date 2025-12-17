"use client";

import React from 'react';

interface SparklineProps {
  data: number[];
  height?: number;
  color?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  className?: string;
}

/**
 * A standardized sparkline bar chart component for WeWrite
 * Renders bars instead of a line - accent colored for values, neutral for zeros
 */
export function Sparkline({
  data = [],
  height = 40,
  color = "oklch(var(--primary))",
  strokeWidth = 1.5,
  fillOpacity = 0.1,
  className = ""
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ height: `${height}px` }} className={`w-full ${className}`}></div>;
  }

  // Filter out any NaN or undefined values
  const cleanData = data.map(val => (isNaN(val) || val === undefined) ? 0 : val);

  const maxValue = Math.max(...cleanData, 1); // Ensure we don't divide by zero
  const width = 100; // Use percentage for responsive width
  const paddingTop = 2;
  const paddingBottom = 2;
  const graphHeight = height - paddingTop - paddingBottom;

  // Calculate bar dimensions
  const barCount = cleanData.length;
  const gap = 1; // Gap between bars in viewBox units
  const totalGapWidth = gap * (barCount - 1);
  const barWidth = (width - totalGapWidth) / barCount;

  return (
    <div className={`w-full ${className}`} style={{ height: `${height}px` }}>
      <svg width="100%" height={height} preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        {cleanData.map((value, index) => {
          const x = index * (barWidth + gap);
          const barHeight = value > 0 ? (value / maxValue) * graphHeight : 2; // Min height of 2 for zero values
          const y = height - paddingBottom - barHeight;
          const isZero = value === 0;

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={1}
              ry={1}
              fill={isZero ? "var(--neutral-alpha-15)" : "oklch(var(--primary))"}
            />
          );
        })}
      </svg>
    </div>
  );
}