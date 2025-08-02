'use client';

import React from 'react';
import { formatUsdCents } from '../../utils/formatCurrency';

interface UsdAllocation {
  id: string;
  resourceId: string;
  resourceTitle?: string;
  usdCents: number;
  resourceType: 'page' | 'user' | 'wewrite';
}

interface UsdPieChartProps {
  allocations: UsdAllocation[];
  totalUsdCents: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabels?: boolean;
  onSegmentClick?: (allocation: UsdAllocation) => void;
}

/**
 * UsdPieChart - Interactive pie chart showing USD allocation breakdown
 *
 * Displays how the user's monthly USD budget is allocated across different
 * pages, users, and the WeWrite platform. Includes hover effects and click handlers.
 */
export function UsdPieChart({
  allocations,
  totalUsdCents,
  size = 200,
  strokeWidth = 20,
  className = '',
  showLabels = true,
  onSegmentClick
}: UsdPieChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate unallocated USD
  const allocatedUsdCents = allocations.reduce((sum, allocation) => sum + allocation.usdCents, 0);
  const unallocatedUsdCents = Math.max(0, totalUsdCents - allocatedUsdCents);

  // Create segments including unallocated
  const segments = [
    ...allocations.map(allocation => ({
      ...allocation,
      percentage: totalUsdCents > 0 ? (allocation.usdCents / totalUsdCents) * 100 : 0
    })),
    ...(unallocatedUsdCents > 0 ? [{
      id: 'unallocated',
      resourceId: 'unallocated',
      resourceTitle: 'Unallocated',
      usdCents: unallocatedUsdCents,
      resourceType: 'unallocated' as const,
      percentage: totalUsdCents > 0 ? (unallocatedUsdCents / totalUsdCents) * 100 : 0
    }] : [])
  ];

  // Color scheme for different resource types
  const getSegmentColor = (resourceType: string, index: number) => {
    const colors = {
      page: ['#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a'], // Blues
      user: ['#10b981', '#059669', '#047857', '#065f46'], // Greens
      wewrite: ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'], // Purples
      unallocated: ['#6b7280', '#4b5563', '#374151', '#1f2937'] // Grays
    };
    
    const colorArray = colors[resourceType as keyof typeof colors] || colors.page;
    return colorArray[index % colorArray.length];
  };

  // Calculate segment paths
  let cumulativePercentage = 0;
  const segmentPaths = segments.map((segment, index) => {
    const startAngle = (cumulativePercentage / 100) * 360 - 90; // Start from top
    const endAngle = ((cumulativePercentage + segment.percentage) / 100) * 360 - 90;
    
    cumulativePercentage += segment.percentage;

    // Convert to radians
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    // Calculate arc path
    const x1 = center + radius * Math.cos(startAngleRad);
    const y1 = center + radius * Math.sin(startAngleRad);
    const x2 = center + radius * Math.cos(endAngleRad);
    const y2 = center + radius * Math.sin(endAngleRad);

    const largeArcFlag = segment.percentage > 50 ? 1 : 0;

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    return {
      ...segment,
      pathData,
      color: getSegmentColor(segment.resourceType, index),
      startAngle,
      endAngle
    };
  });

  // Handle empty state
  if (totalUsdCents === 0 || segments.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <div className="text-center text-muted-foreground">
          <div className="text-sm">No USD allocated</div>
          <div className="text-xs">Start allocating funds to creators</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Pie Chart SVG */}
      <svg width={size} height={size} className="transform rotate-0">
        {segmentPaths.map((segment, index) => (
          <path
            key={segment.id}
            d={segment.pathData}
            fill={segment.color}
            stroke="white"
            strokeWidth="2"
            className={`transition-all duration-200 ${
              onSegmentClick ? 'cursor-pointer hover:opacity-80' : ''
            }`}
            onClick={() => onSegmentClick && segment.resourceType !== 'unallocated' && onSegmentClick(segment)}
            title={`${segment.resourceTitle || segment.resourceId}: ${formatUsdCents(segment.usdCents)} (${segment.percentage.toFixed(1)}%)`}
          />
        ))}
        
        {/* Center circle for donut effect */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.6}
          fill="white"
          className="drop-shadow-sm"
        />
        
        {/* Center text */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          className="text-sm font-semibold fill-current"
        >
          {formatUsdCents(totalUsdCents)}
        </text>
        <text
          x={center}
          y={center + 8}
          textAnchor="middle"
          className="text-xs fill-muted-foreground"
        >
          Monthly
        </text>
      </svg>

      {/* Legend */}
      {showLabels && (
        <div className="mt-4 space-y-2">
          {segmentPaths.map((segment) => (
            <div
              key={segment.id}
              className={`flex items-center space-x-2 text-sm ${
                onSegmentClick && segment.resourceType !== 'unallocated' ? 'cursor-pointer hover:opacity-80' : ''
              }`}
              onClick={() => onSegmentClick && segment.resourceType !== 'unallocated' && onSegmentClick(segment)}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">
                  {segment.resourceTitle || segment.resourceId}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatUsdCents(segment.usdCents)} ({segment.percentage.toFixed(1)}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Legacy TokenPieChart component for backward compatibility
 * @deprecated Use UsdPieChart instead
 */
export function TokenPieChart({
  allocations,
  totalTokens,
  size = 200,
  strokeWidth = 20,
  className = '',
  showLabels = true,
  onSegmentClick
}: {
  allocations: Array<{
    id: string;
    resourceId: string;
    resourceTitle?: string;
    tokens: number;
    resourceType: 'page' | 'user' | 'wewrite';
  }>;
  totalTokens: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabels?: boolean;
  onSegmentClick?: (allocation: any) => void;
}) {
  // Convert token allocations to USD allocations
  const usdAllocations = allocations.map(allocation => ({
    ...allocation,
    usdCents: Math.floor(allocation.tokens / 10 * 100)
  }));

  const totalUsdCents = Math.floor(totalTokens / 10 * 100);

  return (
    <UsdPieChart
      allocations={usdAllocations}
      totalUsdCents={totalUsdCents}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      showLabels={showLabels}
      onSegmentClick={onSegmentClick}
    />
  );
}
