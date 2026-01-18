"use client";

import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { GlobalAnalyticsFilters as GlobalAnalyticsFiltersType } from './GlobalAnalyticsFilters';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';
import {
  SegmentedControl,
  SegmentedControlList,
  SegmentedControlTrigger,
} from '../ui/segmented-control';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface PresetRange {
  label: string;
  getValue: () => DateRange;
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
  const [showCustomDates, setShowCustomDates] = useState(false);

  // Preset date range options
  const presetRanges: PresetRange[] = [
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

  // Check if current date range matches a preset
  const matchingPreset = useMemo(() => {
    for (const preset of presetRanges) {
      const presetValue = preset.getValue();
      // Compare start and end dates (ignoring time for day-level comparison)
      if (
        isSameDay(dateRange.startDate, presetValue.startDate) &&
        isSameDay(dateRange.endDate, presetValue.endDate)
      ) {
        return preset.label;
      }
    }
    return null;
  }, [dateRange.startDate, dateRange.endDate]);

  // Get display label for dropdown trigger
  const getDisplayLabel = () => {
    if (matchingPreset) {
      return matchingPreset;
    }
    return `${format(dateRange.startDate, 'MMM d')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`;
  };

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

  // Compact horizontal layout for filter bar
  if (compact) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-3">
          {/* Date Range Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-sm font-medium gap-2"
              >
                <Icon name="Calendar" size={14} />
                <span>{getDisplayLabel()}</span>
                <Icon name="ChevronDown" size={14} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent openDirection="bottom-left" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Quick Select
              </DropdownMenuLabel>
              {presetRanges.map((preset) => (
                <DropdownMenuItem
                  key={preset.label}
                  onClick={() => {
                    applyPresetRange(preset);
                    setShowCustomDates(false);
                  }}
                  className={matchingPreset === preset.label ? 'bg-primary/10 text-primary' : ''}
                >
                  <Icon
                    name={matchingPreset === preset.label ? 'Check' : 'Clock'}
                    size={14}
                    className="mr-2"
                  />
                  {preset.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setShowCustomDates(!showCustomDates);
                }}
              >
                <Icon name="CalendarDays" size={14} className="mr-2" />
                Custom Range
                <Icon
                  name={showCustomDates ? 'ChevronUp' : 'ChevronDown'}
                  size={14}
                  className="ml-auto"
                />
              </DropdownMenuItem>
              {showCustomDates && (
                <div className="px-2 py-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground text-xs w-10">From</span>
                    <input
                      type="date"
                      value={formatDateForInput(dateRange.startDate)}
                      onChange={handleStartDateChange}
                      max={formatDateForInput(dateRange.endDate)}
                      className="flex-1 px-2 py-1 border border-border rounded text-foreground bg-background text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground text-xs w-10">To</span>
                    <input
                      type="date"
                      value={formatDateForInput(dateRange.endDate)}
                      onChange={handleEndDateChange}
                      min={formatDateForInput(dateRange.startDate)}
                      max={formatDateForInput(new Date())}
                      className="flex-1 px-2 py-1 border border-border rounded text-foreground bg-background text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Separator */}
          <div className="h-6 w-px bg-border flex-shrink-0"></div>

          {/* Global Analytics Filters - Combined Mode */}
          {combined && globalFilters && onGlobalFiltersChange && (
            <SegmentedControl
              value={globalFilters.timeDisplayMode}
              onValueChange={(value) => handleTimeDisplayModeChange(value as 'cumulative' | 'overTime')}
            >
              <SegmentedControlList className="h-8">
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
          )}

          {/* Granularity Controls */}
          {onGranularityChange && (
            <>
              <div className="h-6 w-px bg-border flex-shrink-0"></div>
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
            </>
          )}
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
            <Icon name="Calendar" size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">Date Range Filter</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            className="h-8 w-8 p-0"
            title="Reset to last 24 hours"
          >
            <Icon name="RotateCcw" size={16} />
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