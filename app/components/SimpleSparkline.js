"use client";

import React from 'react';

/**
 * A simple sparkline component that doesn't rely on external libraries
 *
 * @param {Object} props
 * @param {Array<number>} props.data - Array of data points
 * @param {number} props.height - Height of the sparkline
 * @param {string} props.color - Color of the line
 * @param {number} props.strokeWidth - Width of the line
 * @param {string} props.title - Optional title/tooltip for the sparkline
 */
export default function SimpleSparkline({
  data = [],
  height = 60,
  color,
  strokeWidth = 1.5,
  title = "Edit activity in the last 24 hours"
}) {
  // Use the accent color from CSS variables if no color is provided
  const effectiveColor = color || "hsl(var(--primary))";
  if (!data || data.length === 0) {
    return <div style={{ height: `${height}px` }} className="w-full"></div>;
  }

  const maxValue = Math.max(...data, 1); // Ensure we don't divide by zero
  const width = 100; // Use percentage for responsive width
  const padding = 5;
  const graphHeight = height - (padding * 2);

  // Generate points for the polyline
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = graphHeight - ((value / maxValue) * graphHeight) + padding;
    return `${x},${y}`;
  }).join(' ');

  // Generate points for the area under the line
  const areaPoints = [
    `0,${height}`, // Bottom left
    ...data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = graphHeight - ((value / maxValue) * graphHeight) + padding;
      return `${x},${y}`;
    }),
    `${width},${height}` // Bottom right
  ].join(' ');

  return (
    <div className="w-full" style={{ height: `${height}px` }} title={title}>
      <svg width="100%" height={height} preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        {/* Area under the line with very slight opacity */}
        <polygon
          points={areaPoints}
          fill={effectiveColor}
          fillOpacity="0.1"
        />

        {/* The line itself */}
        <polyline
          points={points}
          fill="none"
          stroke={effectiveColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* No dots for data points - just the line */}
      </svg>
    </div>
  );
}
