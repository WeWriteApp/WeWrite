/**
 * Analytics Data Processing Utilities
 * 
 * Handles transformation of analytics data based on global filter settings:
 * - Time Display Mode: Cumulative vs Over Time
 * - Per-User Normalization: Raw totals vs per-user metrics
 */

import { GlobalAnalyticsFilters } from '../components/admin/GlobalAnalyticsFilters';

// Generic data point interface for analytics
export interface AnalyticsDataPoint {
  date: string;
  count: number;
  [key: string]: any; // Allow additional properties
}

// User count data for normalization
export interface UserCountData {
  date: string;
  activeUsers: number;
}

/**
 * Transform data based on time display mode
 */
export function transformTimeDisplayMode<T extends AnalyticsDataPoint>(
  data: T[],
  mode: 'cumulative' | 'overTime'
): T[] {
  if (mode === 'overTime') {
    // Return data as-is for period-over-period view
    return data;
  }

  // Calculate cumulative values
  let runningTotal = 0;
  return data.map(point => ({
    ...point,
    count: runningTotal += point.count
  }));
}

/**
 * Transform data based on per-user normalization
 */
export function transformPerUserNormalization<T extends AnalyticsDataPoint>(
  data: T[],
  userCountData: UserCountData[],
  enabled: boolean
): T[] {
  if (!enabled) {
    return data;
  }

  // Create a map of date to active user count for quick lookup
  const userCountMap = new Map<string, number>();
  userCountData.forEach(userData => {
    userCountMap.set(userData.date, userData.activeUsers);
  });

  return data.map(point => {
    const activeUsers = userCountMap.get(point.date) || 1; // Avoid division by zero
    return {
      ...point,
      count: activeUsers > 0 ? point.count / activeUsers : 0,
      originalCount: point.count, // Preserve original for reference
      activeUsers // Include active user count for context
    };
  });
}

/**
 * Apply all global analytics filters to data
 */
export function applyGlobalAnalyticsFilters<T extends AnalyticsDataPoint>(
  data: T[],
  userCountData: UserCountData[],
  filters: GlobalAnalyticsFilters
): T[] {
  // First apply per-user normalization
  let processedData = transformPerUserNormalization(data, userCountData, filters.perUserNormalization);
  
  // Then apply time display mode transformation
  processedData = transformTimeDisplayMode(processedData, filters.timeDisplayMode);
  
  return processedData;
}

/**
 * Calculate summary statistics with filter awareness
 */
export function calculateFilteredSummaryStats<T extends AnalyticsDataPoint>(
  originalData: T[],
  processedData: T[],
  filters: GlobalAnalyticsFilters
) {
  const originalTotal = originalData.reduce((sum, item) => sum + item.count, 0);
  const processedTotal = processedData.length > 0 ? processedData[processedData.length - 1].count : 0;
  
  // For cumulative mode, the total is the last data point
  // For over time mode, the total is the sum of all points
  const displayTotal = filters.timeDisplayMode === 'cumulative' 
    ? processedTotal 
    : processedData.reduce((sum, item) => sum + item.count, 0);
  
  const averagePerPeriod = processedData.length > 0 
    ? (displayTotal / processedData.length) 
    : 0;
  
  return {
    originalTotal,
    displayTotal,
    averagePerPeriod,
    dataPoints: processedData.length
  };
}

/**
 * Generate display labels based on filters
 */
export function getFilteredDisplayLabels(filters: GlobalAnalyticsFilters) {
  const timeLabel = filters.timeDisplayMode === 'cumulative' ? 'Cumulative' : 'Per Period';
  const userLabel = filters.perUserNormalization ? 'Per User' : 'Total';
  
  return {
    totalLabel: `${timeLabel} ${userLabel}`,
    averageLabel: filters.perUserNormalization ? 'Avg Per User/Period' : 'Avg Per Period',
    yAxisLabel: filters.perUserNormalization ? 'Count Per User' : 'Count',
    tooltipSuffix: filters.perUserNormalization ? ' per user' : ''
  };
}

/**
 * Mock user count data generator for development/testing
 * In production, this would come from actual user analytics
 */
export function generateMockUserCountData(
  startDate: Date,
  endDate: Date,
  granularity: number = 50
): UserCountData[] {
  const data: UserCountData[] = [];
  const timeDiff = endDate.getTime() - startDate.getTime();
  const interval = timeDiff / granularity;
  
  // Generate mock data with some realistic variation
  let baseUsers = 100;
  
  for (let i = 0; i < granularity; i++) {
    const date = new Date(startDate.getTime() + (interval * i));
    
    // Add some realistic variation (growth trend with daily fluctuation)
    const growthFactor = 1 + (i / granularity) * 0.3; // 30% growth over period
    const dailyVariation = 0.8 + Math.random() * 0.4; // ±20% daily variation
    const activeUsers = Math.round(baseUsers * growthFactor * dailyVariation);
    
    data.push({
      date: date.toISOString().split('T')[0],
      activeUsers: Math.max(1, activeUsers) // Ensure at least 1 user
    });
  }
  
  return data;
}

/**
 * Format numbers for display based on filter context
 */
export function formatFilteredNumber(
  value: number,
  filters: GlobalAnalyticsFilters,
  precision: number = 1
): string {
  if (filters.perUserNormalization) {
    // For per-user metrics, show more decimal places for small numbers
    if (isNaN(value)) return '0.00';
    return value < 1 ? value.toFixed(2) : value.toFixed(precision);
  }

  // For raw totals, show whole numbers for large values
  if (isNaN(value)) return '0';
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'k';
  }
  
  return Math.round(value).toString();
}
