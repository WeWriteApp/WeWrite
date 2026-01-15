"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AdaptiveModal } from '@/components/ui/adaptive-modal';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/ui/StatsCard';
import { useAccentColor, ACCENT_COLOR_VALUES } from '../../contexts/AccentColorContext';
import { useDateFormat } from '../../contexts/DateFormatContext';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday
} from 'date-fns';

interface CalendarGridProps {
  selectedDate: string | Date | null;
  onDateSelect: (date: Date) => void;
  accentColorValue: string;
}

/**
 * Calendar Component
 *
 * A visual calendar grid for date selection
 */
function CalendarGrid({ selectedDate, onDateSelect, accentColorValue }: CalendarGridProps) {
  const parseLocalDate = (value: string | Date | null): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    if (typeof value === 'string' && value.includes('-')) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    }
    try {
      const parsed = new Date(value);
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    } catch (e) {
      return null;
    }
  };

  const normalizedSelected = parseLocalDate(selectedDate);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return normalizedSelected || new Date();
  });

  // Update current month when selected date changes
  useEffect(() => {
    if (normalizedSelected) {
      setCurrentMonth(normalizedSelected);
    }
  }, [selectedDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const rows: React.ReactNode[] = [];
  let days: React.ReactNode[] = [];
  let day = startDate;

  // Generate calendar grid
  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const isSelected = normalizedSelected && isSameDay(day, normalizedSelected);
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isTodayDate = isToday(day);

      days.push(
        <div
          key={day.toString()}
          className={`
            h-8 w-8 flex items-center justify-center text-sm cursor-pointer rounded-md transition-colors
            ${isSelected
              ? 'text-white font-medium'
              : isCurrentMonth
                ? 'text-foreground hover:bg-muted'
                : 'text-muted-foreground hover:bg-muted/50'
            }
            ${isTodayDate && !isSelected ? 'bg-muted font-medium' : ''}
          `}
          style={isSelected ? { backgroundColor: accentColorValue } : {}}
          onClick={() => onDateSelect(cloneDay)}
        >
          <span>{formattedDate}</span>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div key={day.toString()} className="grid grid-cols-7 gap-1">
        {days}
      </div>
    );
    days = [];
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1 hover:bg-muted rounded-md transition-colors"
        >
          <Icon name="ChevronLeft" size={16} />
        </button>
        <h3 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={nextMonth}
          className="p-1 hover:bg-muted rounded-md transition-colors"
        >
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(dayName => (
          <div key={dayName} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {rows}
      </div>
    </div>
  );
}

interface CustomDateFieldProps {
  customDate: string | null;
  canEdit?: boolean;
  onCustomDateChange?: (date: string | null) => void;
  className?: string;
  /** When true, shows a simplified compact view for empty state */
  compact?: boolean;
}

/**
 * CustomDateField Component
 *
 * Displays and allows editing of a page's custom date field.
 * Uses StatsCard for consistent styling with other page stats.
 */
export default function CustomDateField({
  customDate,
  canEdit = false,
  onCustomDateChange,
  className = "",
  compact = false
}: CustomDateFieldProps) {
  const { accentColor, customColors } = useAccentColor();
  const { formatDateString } = useDateFormat();
  const [localDate, setLocalDate] = useState<string | null>(customDate);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    setLocalDate(customDate);
  }, [customDate]);

  // Get the actual color value based on the selected accent color
  const getAccentColorValue = (): string => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor] || "#1768FF";
    }
    return ACCENT_COLOR_VALUES[accentColor] || "#1768FF";
  };

  const accentColorValue = getAccentColorValue();

  const handleDateClick = () => {
    if (canEdit && !showDatePicker) {
      setShowDatePicker(true);
    }
  };

  const handleCalendarDateSelect = (date: Date) => {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const formattedDate = format(normalized, 'yyyy-MM-dd');
    setLocalDate(formattedDate);
    onCustomDateChange?.(formattedDate);
    setShowDatePicker(false);
  };

  const handleClearDate = () => {
    setLocalDate(null);
    onCustomDateChange?.(null);
    setShowDatePicker(false);
  };

  const formatCustomDate = (dateString: string | null): string | null => {
    if (!dateString) return null;
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return formatDateString(date);
    } catch (error) {
      return dateString;
    }
  };

  // Get formatted date value for display
  const displayValue = localDate ? formatCustomDate(localDate) : null;

  // Compact mode: simplified centered display for empty state
  if (compact && !localDate && canEdit) {
    return (
      <>
        <div
          className={`wewrite-card cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors ${className}`}
          onClick={handleDateClick}
        >
          <div className="flex items-center justify-center gap-2">
            <Icon name="Calendar" size={18} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Set date</span>
          </div>
        </div>

        {/* Date picker modal */}
        <AdaptiveModal
          isOpen={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          title="Select custom date"
          hashId="custom-date"
          analyticsId="custom-date-picker"
          mobileHeight="auto"
          className="sm:max-w-md"
        >
          <div className="space-y-6">
            <CalendarGrid
              selectedDate={localDate}
              onDateSelect={handleCalendarDateSelect}
              accentColorValue={accentColorValue}
            />
            <Button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                if (onCustomDateChange) {
                  onCustomDateChange(today);
                }
                setShowDatePicker(false);
              }}
              className="w-full"
              style={{
                backgroundColor: accentColorValue,
                color: 'white'
              }}
            >
              Select Today
            </Button>
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowDatePicker(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowDatePicker(false)}
                style={{
                  backgroundColor: accentColorValue,
                  color: 'white'
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </AdaptiveModal>
      </>
    );
  }

  return (
    <>
      <StatsCard
        icon="Calendar"
        title="Custom date"
        value={displayValue}
        onClick={canEdit ? handleDateClick : undefined}
        className={className}
        isEditable={canEdit}
        emptyPlaceholder={canEdit ? "Set date" : undefined}
      />

      {/* Date picker using AdaptiveModal (responsive: Dialog on desktop, Drawer on mobile) */}
      <AdaptiveModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title="Select custom date"
        hashId="custom-date"
        analyticsId="custom-date-picker"
        mobileHeight="auto"
        className="sm:max-w-md"
      >
        <div className="space-y-6">
          {/* Calendar Interface */}
          <CalendarGrid
            selectedDate={localDate}
            onDateSelect={handleCalendarDateSelect}
            accentColorValue={accentColorValue}
          />

          {/* Quick Today Button */}
          <Button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              if (onCustomDateChange) {
                onCustomDateChange(today);
              }
              setShowDatePicker(false);
            }}
            className="w-full"
            style={{
              backgroundColor: accentColorValue,
              color: 'white'
            }}
          >
            Select Today
          </Button>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            {customDate && (
              <Button
                variant="outline"
                onClick={handleClearDate}
              >
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowDatePicker(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowDatePicker(false)}
              style={{
                backgroundColor: accentColorValue,
                color: 'white'
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </AdaptiveModal>
    </>
  );
}
