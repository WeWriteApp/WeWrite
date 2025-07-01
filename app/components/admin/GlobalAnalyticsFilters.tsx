"use client";

import React from 'react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { TrendingUp, Users, BarChart3, Activity } from 'lucide-react';

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
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Display:</span>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-1">
          <Button
            variant={filters.timeDisplayMode === 'cumulative' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTimeDisplayModeChange('cumulative')}
            className="h-7 px-3 text-xs font-medium"
          >
            <TrendingUp className="h-3 w-3 mr-1.5" />
            Cumulative
          </Button>
          <Button
            variant={filters.timeDisplayMode === 'overTime' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTimeDisplayModeChange('overTime')}
            className="h-7 px-3 text-xs font-medium"
          >
            <Activity className="h-3 w-3 mr-1.5" />
            Over Time
          </Button>
        </div>
      </div>

      {/* Vertical Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Per-User Normalization Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
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