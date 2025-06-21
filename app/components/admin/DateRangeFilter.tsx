"use client";

import React from 'react';
import { Button } from '../ui/button';
import { Calendar, RotateCcw } from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateRangeFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;
  className?: string;
}

export function DateRangeFilter({ dateRange, onDateRangeChange, className = "" }: DateRangeFilterProps) {
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
        <div className="flex flex-col gap-4">
          {/* Date Inputs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 text-sm flex-1">
              <span className="text-muted-foreground whitespace-nowrap min-w-[40px]">From:</span>
              <input
                type="date"
                value={formatDateForInput(dateRange.startDate)}
                onChange={handleStartDateChange}
                max={formatDateForInput(dateRange.endDate)}
                className="flex-1 px-3 py-2 border border-border rounded text-foreground bg-background text-sm"
              />
            </div>
            <div className="flex items-center gap-2 text-sm flex-1">
              <span className="text-muted-foreground whitespace-nowrap min-w-[25px]">To:</span>
              <input
                type="date"
                value={formatDateForInput(dateRange.endDate)}
                onChange={handleEndDateChange}
                min={formatDateForInput(dateRange.startDate)}
                max={formatDateForInput(new Date())}
                className="flex-1 px-3 py-2 border border-border rounded text-foreground bg-background text-sm"
              />
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {presetRanges.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => applyPresetRange(preset)}
                className="text-xs whitespace-nowrap"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Range Display */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Selected Range:</span>{' '}
          {format(dateRange.startDate, 'MMM dd, yyyy')} - {format(dateRange.endDate, 'MMM dd, yyyy')}
          {' '}({Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))} days)
        </div>
      </div>
    </div>
  );
}
