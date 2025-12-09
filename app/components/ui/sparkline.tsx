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
 * A standardized sparkline component for WeWrite
 */
export function Sparkline({
  data = [],
  height = 40,
  color = "hsl(var(--primary))",
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
  const paddingBottom = 4; // Extra padding at bottom to avoid baseline appearing as a line
  const graphHeight = height - paddingTop - paddingBottom;

  // Generate points for the polyline
  const points = cleanData.map((value, index) => {
    const x = (index / (cleanData.length - 1)) * width;
    const y = graphHeight - ((value / maxValue) * graphHeight) + paddingTop;
    return `${x},${y}`;
  }).join(' ');

  // Generate points for the area under the line - don't extend to full height
  const bottomY = height - paddingBottom; // Stop before the bottom edge
  const areaPoints = [
    `0,${bottomY}`, // Bottom left
    ...cleanData.map((value, index) => {
      const x = (index / (cleanData.length - 1)) * width;
      const y = graphHeight - ((value / maxValue) * graphHeight) + paddingTop;
      return `${x},${y}`;
    }),
    `${width},${bottomY}` // Bottom right
  ].join(' ');

  return (
    <div className={`w-full ${className}`} style={{ height: `${height}px` }}>
      <svg width="100%" height={height} preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        {/* Area under the line */}
        <polygon
          points={areaPoints}
          fill={color}
          fillOpacity={fillOpacity}
        />

        {/* The line itself */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}