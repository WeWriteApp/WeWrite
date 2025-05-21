"use client";

import React, { useMemo } from 'react';

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

  // Add debugging to check data
  console.log('SimpleSparkline data:', {
    dataLength: data?.length || 0,
    hasData: data && data.length > 0,
    hasNonZeroValues: data && data.some(val => val > 0)
  });

  // Validate and normalize data
  const normalizedData = useMemo(() => {
    // Ensure data is valid
    if (!data || !Array.isArray(data) || data.length === 0) {
      return Array(24).fill(0);
    }

    // Ensure we have exactly 24 data points for hourly data
    let processedData = [...data];

    // If data length is not 24, pad or truncate
    if (processedData.length !== 24) {
      console.warn(`SimpleSparkline: Data length is ${processedData.length}, expected 24. Normalizing.`);
      if (processedData.length < 24) {
        // Pad with zeros
        processedData = [...processedData, ...Array(24 - processedData.length).fill(0)];
      } else {
        // Truncate to 24
        processedData = processedData.slice(0, 24);
      }
    }

    // Ensure all values are non-negative
    processedData = processedData.map(val => {
      // Convert to number and ensure non-negative
      const numVal = Number(val);
      return isNaN(numVal) ? 0 : Math.max(0, numVal);
    });

    return processedData;
  }, [data]);

  // If all values are zero, still render a flat line
  const hasNonZeroValues = normalizedData.some(val => val > 0);

  // Use 1 as maxValue if all values are zero to avoid division by zero
  const maxValue = hasNonZeroValues ? Math.max(...normalizedData, 1) : 1;
  const width = 100; // Use percentage for responsive width
  const padding = 5;
  const graphHeight = height - (padding * 2);

  // Generate points for the polyline
  const points = normalizedData.map((value, index) => {
    const x = (index / (normalizedData.length - 1)) * width;
    const y = graphHeight - ((value / maxValue) * graphHeight) + padding;
    return `${x},${y}`;
  }).join(' ');

  // Generate points for the area under the line
  const areaPoints = [
    `0,${height}`, // Bottom left
    ...normalizedData.map((value, index) => {
      const x = (index / (normalizedData.length - 1)) * width;
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
