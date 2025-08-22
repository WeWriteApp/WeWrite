"use client";

import React from 'react';
import { BarChart, Bar, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
  data: Array<{
    value: number;
    date?: string;
    label?: string;
  }>;
  color?: string;
  height?: number;
  width?: number;
  strokeWidth?: number;
  className?: string;
  showDots?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

export function Sparkline({
  data,
  color = '#3b82f6',
  height = 40,
  width = 120,
  strokeWidth = 2,
  className = '',
  showDots = false,
  trend
}: SparklineProps) {
  // Handle empty or invalid data - add more defensive checks
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/30 rounded ${className}`}
        style={{ height, width }}
      >
        <span className="text-xs text-muted-foreground">No data</span>
      </div>
    );
  }

  // Ensure we have valid numeric data
  const validData = data.filter(d => typeof d.value === 'number' && !isNaN(d.value));
  
  if (validData.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted/30 rounded ${className}`}
        style={{ height, width }}
      >
        <span className="text-xs text-muted-foreground">Invalid data</span>
      </div>
    );
  }

  // Calculate trend if not provided
  let calculatedTrend = trend;
  if (!trend && validData.length >= 2) {
    const firstValue = validData[0].value;
    const lastValue = validData[validData.length - 1].value;
    if (lastValue > firstValue) {
      calculatedTrend = 'up';
    } else if (lastValue < firstValue) {
      calculatedTrend = 'down';
    } else {
      calculatedTrend = 'neutral';
    }
  }

  // Determine color based on trend
  let lineColor = color;
  if (calculatedTrend === 'up') {
    lineColor = '#10b981'; // green
  } else if (calculatedTrend === 'down') {
    lineColor = '#ef4444'; // red
  }

  return (
    <div className={`relative ${className}`} style={{ height, width }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={validData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Bar
            dataKey="value"
            fill={lineColor}
            radius={[1, 1, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Trend indicator */}
      {calculatedTrend && (
        <div className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{
          backgroundColor: calculatedTrend === 'up' ? '#10b981' : calculatedTrend === 'down' ? '#ef4444' : '#6b7280'
        }} />
      )}
    </div>
  );
}

interface SparklineWithLabelProps extends SparklineProps {
  label: string;
  value?: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function SparklineWithLabel({
  label,
  value,
  subtitle,
  icon,
  data,
  ...sparklineProps
}: SparklineWithLabelProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Left side - Label and value */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon && (
          <div className="flex-shrink-0 text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground truncate">
            {label}
          </div>
          {value && (
            <div className="text-lg font-semibold text-foreground">
              {value}
            </div>
          )}
          {subtitle && (
            <div className="text-xs text-muted-foreground truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Sparkline */}
      <div className="flex-shrink-0 ml-3">
        <Sparkline data={data} {...sparklineProps} />
      </div>
    </div>
  );
}

// Utility function to convert widget data to sparkline format
export function convertToSparklineData(data: any[], valueKey: string = 'value'): Array<{ value: number; date?: string }> {
  if (!Array.isArray(data)) return [];
  
  return data.map((item, index) => ({
    value: typeof item[valueKey] === 'number' ? item[valueKey] : 0,
    date: item.date || item.label || `Point ${index + 1}`
  }));
}

// Utility function to format sparkline values
export function formatSparklineValue(value: number, type: 'number' | 'percentage' | 'currency' = 'number'): string {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  
  switch (type) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'currency':
      return `$${value.toLocaleString()}`;
    default:
      return value.toLocaleString();
  }
}
