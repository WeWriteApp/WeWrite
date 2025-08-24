"use client";

import React from 'react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Calendar, RotateCcw, TrendingUp, Users, BarChart3, Activity } from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';
import { GlobalAnalyticsFilters as GlobalAnalyticsFiltersType } from './GlobalAnalyticsFilters';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateRangeFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;
  className?: string;
  compact?: boolean; // New prop for horizontal compact layout
  granularity?: number; // Chart granularity/buckets
  onGranularityChange?: (granularity: number) => void; // Granularity change handler
  // Combined filter props
  globalFilters?: GlobalAnalyticsFiltersType;
  onGlobalFiltersChange?: (filters: GlobalAnalyticsFiltersType) => void;
  combined?: boolean; // New prop to enable combined filter mode
}

export function DateRangeFilter({
  dateRange,
  onDateRangeChange,
  className = "",
  compact = false,
  granularity = 50,
  onGranularityChange,
  globalFilters,
  onGlobalFiltersChange,
  combined = false
}: DateRangeFilterProps) {
  // Preset date range options
  const presetRanges = [
    {
      label: 'Last 24 Hours',
      getValue: () => ({
        startDate: subDays(new Date(), 1),
        endDate: new Date()
      })
    },
    {
      label: 'Last 7 Days',
      getValue: () => ({
        startDate: startOfDay(subDays(new Date(), 7)),
        endDate: endOfDay(new Date())
      })
    },
    {
      label: 'Last 30 Days',
      getValue: () => ({
        startDate: startOfDay(subDays(new Date(), 30)),
        endDate: endOfDay(new Date())
      })
    },
    {
      label: 'Last 3 Months',
      getValue: () => ({
        startDate: startOfDay(subMonths(new Date(), 3)),
        endDate: endOfDay(new Date())
      })
    },
    {
      label: 'Last 6 Months',
      getValue: () => ({
        startDate: startOfDay(subMonths(new Date(), 6)),
        endDate: endOfDay(new Date())
      })
    },
    {
      label: 'This Year',
      getValue: () => ({
        startDate: startOfDay(new Date(new Date().getFullYear(), 0, 1)),
        endDate: endOfDay(new Date())
      })
    }
  ];

  // Format date for input
  const formatDateForInput = (date: Date) => {
    return format(date, 'yyyy-MM-dd');
  };

  // Handle date input changes
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = new Date(e.target.value);
    onDateRangeChange({
      ...dateRange,
      startDate: startOfDay(newStartDate)
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = new Date(e.target.value);
    onDateRangeChange({
      ...dateRange,
      endDate: endOfDay(newEndDate)
    });
  };

  // Apply preset range
  const applyPresetRange = (preset: typeof presetRanges[0]) => {
    onDateRangeChange(preset.getValue());
  };

  // Reset to default (last 24 hours)
  const resetToDefault = () => {
    onDateRangeChange({
      startDate: subDays(new Date(), 1),
      endDate: new Date()
    });
  };

  // Granularity options
  const granularityOptions = [10, 20, 50, 100, 200, 500];

  // Handle granularity change
  const handleGranularityChange = (newGranularity: number) => {
    if (onGranularityChange) {
      onGranularityChange(newGranularity);
    }
  };

  // Global filter handlers
  const handleTimeDisplayModeChange = (mode: 'cumulative' | 'overTime') => {
    if (onGlobalFiltersChange && globalFilters) {
      onGlobalFiltersChange({
        ...globalFilters,
        timeDisplayMode: mode
      });
    }
  };

  const handlePerUserNormalizationChange = (enabled: boolean) => {
    if (onGlobalFiltersChange && globalFilters) {
      onGlobalFiltersChange({
        ...globalFilters,
        perUserNormalization: enabled
      });
    }
  };

  // Compact horizontal layout for filter bar
  if (compact) {
    return (
      <div className={`${className}`}>
        <div className="relative">
          {/* Gradient fade indicators for scrollability */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-card to-transparent pointer-events-none z-10 opacity-50"></div>
          <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-card to-transparent pointer-events-none z-10 opacity-50"></div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent options-bar-compact">
          {/* Date Inputs - Compact */}
          <div className="flex items-center gap-2 text-sm whitespace-nowrap flex-shrink-0">
            <span className="text-muted-foreground font-medium">From:</span>
            <input
              type="date"
              value={formatDateForInput(dateRange.startDate)}
              onChange={handleStartDateChange}
              max={formatDateForInput(dateRange.endDate)}
              className="px-2 py-1.5 border border-border rounded text-foreground bg-background text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors w-32"
            />
          </div>

          <div className="flex items-center gap-2 text-sm whitespace-nowrap flex-shrink-0">
            <span className="text-muted-foreground font-medium">To:</span>
            <input
              type="date"
              value={formatDateForInput(dateRange.endDate)}
              onChange={handleEndDateChange}
              min={formatDateForInput(dateRange.startDate)}
              max={formatDateForInput(new Date())}
              className="px-2 py-1.5 border border-border rounded text-foreground bg-background text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors w-32"
            />
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-border flex-shrink-0"></div>

          {/* Preset Buttons - Horizontal */}
          {presetRanges.map((preset) => (
            <Button
              key={preset.label}
              variant="secondary"
              size="sm"
              onClick={() => applyPresetRange(preset)}
              className="text-xs px-2.5 py-1.5 h-auto whitespace-nowrap hover:bg-primary hover:text-primary-foreground transition-colors flex-shrink-0"
            >
              {preset.label}
            </Button>
          ))}

          {/* Separator */}
          <div className="h-6 w-px bg-border flex-shrink-0"></div>

          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            className="h-8 w-8 p-0 flex-shrink-0"
            title="Reset to last 24 hours"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          {/* Separator */}
          <div className="h-6 w-px bg-border flex-shrink-0"></div>

          {/* Global Analytics Filters - Combined Mode */}
          {combined && globalFilters && onGlobalFiltersChange && (
            <>
              {/* Time Display Mode Toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Display:</span>
                </div>
                <div className="flex items-center bg-muted rounded-md p-0.5">
                  <Button
                    variant={globalFilters.timeDisplayMode === 'cumulative' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTimeDisplayModeChange('cumulative')}
                    className="h-6 px-2 text-xs font-medium"
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Cumulative
                  </Button>
                  <Button
                    variant={globalFilters.timeDisplayMode === 'overTime' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleTimeDisplayModeChange('overTime')}
                    className="h-6 px-2 text-xs font-medium"
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Over Time
                  </Button>
                </div>
              </div>

              {/* Separator */}
              <div className="h-6 w-px bg-border flex-shrink-0"></div>

              {/* Per-User Normalization Toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Per User:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={globalFilters.perUserNormalization}
                    onCheckedChange={handlePerUserNormalizationChange}
                    className="data-[state=checked]:bg-primary scale-75"
                  />
                  <span className="text-xs text-muted-foreground">
                    {globalFilters.perUserNormalization ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="h-6 w-px bg-border flex-shrink-0"></div>
            </>
          )}

          {/* Granularity Controls */}
          {onGranularityChange && (
            <>
              <div className="flex items-center gap-2 text-xs whitespace-nowrap flex-shrink-0">
                <span className="text-muted-foreground font-medium">Granularity:</span>
              </div>

              {/* Granularity Buttons - Horizontal */}
              {granularityOptions.map((option) => (
                <Button
                  key={option}
                  variant={granularity === option ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleGranularityChange(option)}
                  className="text-xs px-2 py-1.5 h-auto whitespace-nowrap hover:bg-primary hover:text-primary-foreground transition-colors flex-shrink-0"
                >
                  {option}
                </Button>
              ))}

              {/* Separator */}
              <div className="h-6 w-px bg-border flex-shrink-0"></div>
            </>
          )}

          {/* Current Range Display - Compact */}
          <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 ml-1">
            <span className="font-mono">{format(dateRange.startDate, 'MMM dd')}</span>
            <span className="mx-1">→</span>
            <span className="font-mono">{format(dateRange.endDate, 'MMM dd')}</span>
            <span className="ml-1.5">({Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))}d)</span>
          </div>

          {/* Info Text for Combined Mode */}
          {combined && globalFilters && (
            <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 ml-2 opacity-75">
              {globalFilters.timeDisplayMode === 'cumulative'
                ? 'Running totals'
                : 'Period values'
              }
              {globalFilters.perUserNormalization && ' • Per user'}
            </div>
          )}
          </div>
        </div>
      </div>
    );
  }

  // Original card layout for non-compact mode
  return (
    <div className={`wewrite-card ${className}`}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Date Range Filter</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            className="h-8 w-8 p-0"
            title="Reset to last 24 hours"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-6">
          {/* Date Inputs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3 text-sm flex-1">
              <span className="text-muted-foreground whitespace-nowrap min-w-[45px] font-medium">From:</span>
              <input
                type="date"
                value={formatDateForInput(dateRange.startDate)}
                onChange={handleStartDateChange}
                max={formatDateForInput(dateRange.endDate)}
                className="wewrite-input flex-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-3 text-sm flex-1">
              <span className="text-muted-foreground whitespace-nowrap min-w-[30px] font-medium">To:</span>
              <input
                type="date"
                value={formatDateForInput(dateRange.endDate)}
                onChange={handleEndDateChange}
                min={formatDateForInput(dateRange.startDate)}
                max={formatDateForInput(new Date())}
                className="wewrite-input flex-1 text-sm"
              />
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Quick Select:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presetRanges.map((preset) => (
                <Button
                  key={preset.label}
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPresetRange(preset)}
                  className="text-sm py-2.5 px-3 h-auto whitespace-nowrap hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Range Display */}
      <div className="mt-4 pt-4 border-t border-border bg-muted/30 rounded-lg p-3">
        <div className="text-sm">
          <div className="font-medium text-foreground mb-1">Selected Range:</div>
          <div className="text-muted-foreground">
            <span className="font-mono">{format(dateRange.startDate, 'MMM dd, yyyy')}</span>
            <span className="mx-2">→</span>
            <span className="font-mono">{format(dateRange.endDate, 'MMM dd, yyyy')}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ({Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))} days)
          </div>
        </div>
      </div>
    </div>
  );
}