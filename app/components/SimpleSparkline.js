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
 * @param {boolean} props.showTimeToggle - Whether to show the time range toggle
 * @param {string} props.timeRange - Current time range ('all' or '24h')
 * @param {Function} props.onTimeRangeChange - Callback when time range changes
 */
export default function SimpleSparkline({
  data = [],
  height = 60,
  color = "#1768FF",
  strokeWidth = 1.5,
  showTimeToggle = false,
  timeRange = 'all',
  onTimeRangeChange = () => {}
}) {
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
    <div className="w-full" style={{ height: `${height + (showTimeToggle ? 20 : 0)}px` }}>
      <svg width="100%" height={height} preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        {/* Area under the line with very slight opacity */}
        <polygon
          points={areaPoints}
          fill={color}
          fillOpacity="0.1"
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

        {/* No dots for data points - just the line */}
      </svg>

      {/* Time range toggle */}
      {showTimeToggle && (
        <div className="flex justify-end mt-1 text-xs text-muted-foreground">
          <button
            onClick={() => onTimeRangeChange('all')}
            className={`px-1 ${timeRange === 'all' ? 'text-primary font-medium' : ''}`}
          >
            all
          </button>
          <span className="mx-1">|</span>
          <button
            onClick={() => onTimeRangeChange('24h')}
            className={`px-1 ${timeRange === '24h' ? 'text-primary font-medium' : ''}`}
          >
            24h
          </button>
        </div>
      )}
    </div>
  );
}
