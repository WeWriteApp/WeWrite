/**
 * Chart Utilities for WeWrite Admin Dashboard
 * 
 * Provides responsive chart configuration utilities to ensure optimal
 * label density and readability across different screen sizes and data volumes.
 */

/**
 * Calculate optimal x-axis tick interval based on container width and data length
 * 
 * @param dataLength - Number of data points in the chart
 * @param containerWidth - Width of the chart container in pixels (optional)
 * @param isMobile - Whether the device is mobile (optional, defaults to window width check)
 * @returns Recharts interval value (number or 'preserveStartEnd')
 */
export function calculateXAxisInterval(
  dataLength: number, 
  containerWidth?: number,
  isMobile?: boolean
): number | 'preserveStartEnd' {
  // Determine if mobile if not explicitly provided
  const mobile = isMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768);
  
  // Use container width if provided, otherwise fall back to window width
  const width = containerWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  // Estimate available width for labels (accounting for margins and Y-axis)
  const marginLeft = mobile ? 40 : 60;
  const marginRight = mobile ? 20 : 40;
  const availableWidth = width - marginLeft - marginRight;
  
  // Estimate label width based on typical date/time formats
  // Hourly: "Dec 21 14:00" ≈ 80px
  // Daily: "Dec 21" ≈ 50px
  const estimatedLabelWidth = mobile ? 60 : 80;
  
  // Calculate how many labels can fit comfortably
  const maxLabels = Math.floor(availableWidth / estimatedLabelWidth);
  
  // If we have fewer data points than max labels, show all
  if (dataLength <= maxLabels) {
    return 0; // Show all ticks
  }
  
  // Calculate interval to show approximately maxLabels
  const interval = Math.ceil(dataLength / maxLabels) - 1;
  
  // For very small containers or many data points, use preserveStartEnd
  if (interval > dataLength / 3 || maxLabels < 3) {
    return 'preserveStartEnd';
  }
  
  return Math.max(0, interval);
}

/**
 * Get responsive chart margins based on screen size
 * 
 * @param isMobile - Whether the device is mobile
 * @returns Margin object for Recharts
 */
export function getResponsiveMargins(isMobile?: boolean) {
  const mobile = isMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768);
  
  return {
    top: 5,
    right: mobile ? 10 : 30,
    left: mobile ? 10 : 20,
    bottom: 5
  };
}

/**
 * Get responsive tick configuration for charts
 * 
 * @param isMobile - Whether the device is mobile
 * @returns Tick configuration object
 */
export function getResponsiveTickConfig(isMobile?: boolean) {
  const mobile = isMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768);
  
  return {
    fontSize: mobile ? 10 : 12,
    width: mobile ? 30 : 40
  };
}

/**
 * Detect granularity from data labels
 * @param data - Chart data array with label property
 * @returns 'hourly' or 'daily'
 */
export function detectGranularity(data: Array<{ label: string }>): 'hourly' | 'daily' {
  if (!data || data.length === 0) return 'daily';

  // Check if any label contains time information (e.g., "14:00", "Dec 21 14:00")
  const hasTimeInfo = data.some(item =>
    item.label && /\d{1,2}:\d{2}/.test(item.label)
  );

  return hasTimeInfo ? 'hourly' : 'daily';
}

/**
 * Hook to get responsive chart configuration
 * Updates when window resizes or data changes
 */
export function useResponsiveChart(dataLength: number, data?: Array<{ label: string }>) {
  const [config, setConfig] = React.useState(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        interval: calculateXAxisInterval(dataLength, 1200, false),
        margins: getResponsiveMargins(false),
        tickConfig: getResponsiveTickConfig(false),
        granularity: detectGranularity(data || [])
      };
    }

    const isMobile = window.innerWidth < 768;
    const granularity = detectGranularity(data || []);
    return {
      isMobile,
      interval: calculateXAxisInterval(dataLength, window.innerWidth, isMobile),
      margins: getResponsiveMargins(isMobile),
      tickConfig: getResponsiveTickConfig(isMobile),
      granularity
    };
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const granularity = detectGranularity(data || []);
      setConfig({
        isMobile,
        interval: calculateXAxisInterval(dataLength, window.innerWidth, isMobile),
        margins: getResponsiveMargins(isMobile),
        tickConfig: getResponsiveTickConfig(isMobile),
        granularity
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dataLength, data]);

  return config;
}

/**
 * Custom tick formatter for different time granularities
 * 
 * @param value - The tick value (label)
 * @param index - The tick index
 * @param granularity - The time granularity ('hourly' | 'daily')
 * @returns Formatted label
 */
export function formatTickLabel(value: string, index: number, granularity: 'hourly' | 'daily' = 'daily'): string {
  if (!value) return '';
  
  // For hourly data, we might want to show shorter labels on mobile
  if (granularity === 'hourly') {
    // Extract time part for hourly labels (e.g., "14:00" from "Dec 21 14:00")
    const timeMatch = value.match(/(\d{1,2}:\d{2})/);
    if (timeMatch && typeof window !== 'undefined' && window.innerWidth < 768) {
      return timeMatch[1]; // Return just the time on mobile
    }
  }
  
  return value;
}

// Re-export React for the hook
import React from 'react';
