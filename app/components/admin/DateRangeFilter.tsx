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
                className="flex-1 px-3 py-2.5 border border-border rounded-md text-foreground bg-background text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
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
                className="flex-1 px-3 py-2.5 border border-border rounded-md text-foreground bg-background text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
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
                  variant="outline"
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
