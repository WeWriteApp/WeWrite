"use client";

import React from 'react';
import { Users, TrendingUp, Loader } from 'lucide-react';
import SimpleSparkline from '../utils/SimpleSparkline';
import { useUserDonorStats } from '../../hooks/useUserDonorStats';

interface UserDonorKPIProps {
  userId: string;
  className?: string;
}

/**
 * UserDonorKPI - Shows monthly donor count and sparkline for a user
 * 
 * Features:
 * - Current month donor count
 * - 12-month sparkline of donor trends
 * - Total active tokens being pledged
 * - Only shows when payments feature is enabled
 */
export default function UserDonorKPI({ userId, className = "" }: UserDonorKPIProps) {
  const { donorStats, isLoading, error } = useUserDonorStats(userId);

  // Don't render if no data and not loading (payments not enabled)
  if (!isLoading && !donorStats && !error) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <Loader className="h-3 w-3 animate-spin" />
          <span className="text-sm">Loading donors...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !donorStats) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Users className="h-4 w-4" />
        <span className="text-sm">--</span>
      </div>
    );
  }

  const { currentMonthDonors, totalActiveTokens, sparklineData } = donorStats;
  
  // Calculate trend (compare current month to previous month)
  const currentMonthValue = sparklineData[sparklineData.length - 1] || 0;
  const previousMonthValue = sparklineData[sparklineData.length - 2] || 0;
  const trend = currentMonthValue - previousMonthValue;
  const hasTrend = Math.abs(trend) > 0;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* KPI Section */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-lg">
            {currentMonthDonors}
          </span>
        </div>
        
        {/* Trend indicator */}
        {hasTrend && (
          <div className={`flex items-center gap-1 text-xs ${
            trend > 0 ? 'text-green-600 dark:text-green-400' : 
            trend < 0 ? 'text-red-600 dark:text-red-400' : 
            'text-muted-foreground'
          }`}>
            <TrendingUp className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            <span>{Math.abs(trend)}</span>
          </div>
        )}
      </div>

      {/* Sparkline Section */}
      {sparklineData.some(val => val > 0) && (
        <div className="w-16 h-6">
          <SimpleSparkline
            data={sparklineData}
            height={24}
            strokeWidth={1.5}
            title={`Monthly donors over the last 12 months. Current: ${currentMonthDonors} donors`}
          />
        </div>
      )}

      {/* Token info (optional, shown as tooltip or small text) */}
      {totalActiveTokens > 0 && (
        <div className="text-xs text-muted-foreground hidden sm:block">
          {totalActiveTokens} tokens
        </div>
      )}
    </div>
  );
}
