"use client";

import React from 'react';
import { Switch } from '../ui/switch';
import { Icon } from '@/components/ui/Icon';
import {
  SegmentedControl,
  SegmentedControlList,
  SegmentedControlTrigger,
} from '../ui/segmented-control';

export interface GlobalAnalyticsFilters {
  timeDisplayMode: 'cumulative' | 'overTime';
  perUserNormalization: boolean;
}

interface GlobalAnalyticsFiltersProps {
  filters: GlobalAnalyticsFilters;
  onFiltersChange: (filters: GlobalAnalyticsFilters) => void;
  className?: string;
}

export function GlobalAnalyticsFilters({
  filters,
  onFiltersChange,
  className = ""
}: GlobalAnalyticsFiltersProps) {
  
  const handleTimeDisplayModeChange = (mode: 'cumulative' | 'overTime') => {
    onFiltersChange({
      ...filters,
      timeDisplayMode: mode
    });
  };

  const handlePerUserNormalizationChange = (enabled: boolean) => {
    onFiltersChange({
      ...filters,
      perUserNormalization: enabled
    });
  };

  return (
    <div className={`flex items-center gap-6 ${className}`}>
      {/* Time Display Mode Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Icon name="BarChart3" size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Display:</span>
        </div>
        <SegmentedControl
          value={filters.timeDisplayMode}
          onValueChange={(value) => handleTimeDisplayModeChange(value as 'cumulative' | 'overTime')}
        >
          <SegmentedControlList className="h-8 w-auto">
            <SegmentedControlTrigger value="cumulative" className="text-xs px-3 gap-1.5">
              <Icon name="TrendingUp" size={12} />
              Cumulative
            </SegmentedControlTrigger>
            <SegmentedControlTrigger value="overTime" className="text-xs px-3 gap-1.5">
              <Icon name="Activity" size={12} />
              Over Time
            </SegmentedControlTrigger>
          </SegmentedControlList>
        </SegmentedControl>
      </div>

      {/* Vertical Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Per-User Normalization Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Icon name="Users" size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Per User:</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={filters.perUserNormalization}
            onCheckedChange={handlePerUserNormalizationChange}
            className="data-[state=checked]:bg-primary"
          />
          <span className="text-xs text-muted-foreground">
            {filters.perUserNormalization ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Info Text */}
      <div className="text-xs text-muted-foreground ml-2">
        {filters.timeDisplayMode === 'cumulative' 
          ? 'Showing running totals over time'
          : 'Showing period-over-period values'
        }
        {filters.perUserNormalization && ' • Normalized per active user'}
      </div>
    </div>
  );
}

// Default filter values
export const defaultGlobalAnalyticsFilters: GlobalAnalyticsFilters = {
  timeDisplayMode: 'overTime',
  perUserNormalization: false
};

// URL parameter keys for persistence
export const GLOBAL_FILTER_PARAMS = {
  TIME_DISPLAY_MODE: 'timeMode',
  PER_USER_NORMALIZATION: 'perUser'
} as const;

// Helper functions for URL persistence
export function filtersToURLParams(filters: GlobalAnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set(GLOBAL_FILTER_PARAMS.TIME_DISPLAY_MODE, filters.timeDisplayMode);
  params.set(GLOBAL_FILTER_PARAMS.PER_USER_NORMALIZATION, filters.perUserNormalization.toString());
  return params;
}

export function filtersFromURLParams(searchParams: URLSearchParams): GlobalAnalyticsFilters {
  const timeDisplayMode = searchParams.get(GLOBAL_FILTER_PARAMS.TIME_DISPLAY_MODE) as 'cumulative' | 'overTime' || 'overTime';
  const perUserNormalization = searchParams.get(GLOBAL_FILTER_PARAMS.PER_USER_NORMALIZATION) === 'true';
  
  return {
    timeDisplayMode,
    perUserNormalization
  };
}

// Helper functions for localStorage persistence
export function filtersToLocalStorage(filters: GlobalAnalyticsFilters): void {
  try {
    localStorage.setItem('wewrite-admin-analytics-filters', JSON.stringify(filters));
  } catch (error) {
    console.warn('Failed to save analytics filters to localStorage:', error);
  }
}

export function filtersFromLocalStorage(): GlobalAnalyticsFilters | null {
  try {
    const stored = localStorage.getItem('wewrite-admin-analytics-filters');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load analytics filters from localStorage:', error);
  }
  return null;
}