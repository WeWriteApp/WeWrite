"use client";

import React, { useState, useEffect, MouseEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { createPortal } from 'react-dom';
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
}

/**
 * CustomDateField Component
 *
 * Displays and allows editing of a page's custom date field.
 * Can be used in both edit and view modes.
 */
export default function CustomDateField({
  customDate,
  canEdit = false,
  onCustomDateChange,
  className = ""
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
    if (canEdit) {
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

  return (
    <div
      className={`wewrite-card w-full flex items-center justify-between ${canEdit ? 'cursor-pointer wewrite-interactive-card' : ''} ${className}`}
      onClick={handleDateClick}
    >
      <div className="flex items-center gap-2">
        <Icon name="Calendar" size={20} className="text-muted-foreground" />
        <span className="text-sm font-medium">Custom date</span>
      </div>

      <div className="flex items-center gap-2">
        {localDate ? (
          <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
            {formatCustomDate(localDate) || localDate}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm font-medium px-2 py-1 rounded-md border border-dashed border-theme-medium">
            {canEdit ? 'Click to set date' : 'No custom date'}
          </div>
        )}
      </div>

      {/* Enhanced Date picker overlay */}
        {showDatePicker && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setShowDatePicker(false)}>
            <div
              className="bg-white dark:bg-zinc-900 border border-border shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col relative z-[10000] rounded-2xl p-6"
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              {/* Header - Fixed */}
              <div className="flex items-start justify-between gap-2 flex-shrink-0 mb-6">
                <h3 className="text-lg font-semibold">Select custom date</h3>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="Close"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto space-y-6">
                {/* Calendar Interface */}
                <div>
                  <CalendarGrid
                    selectedDate={localDate}
                    onDateSelect={handleCalendarDateSelect}
                    accentColorValue={accentColorValue}
                  />
                </div>

                {/* Quick Today Button */}
                <div>
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      if (onCustomDateChange) {
                        onCustomDateChange(today);
                      }
                      setShowDatePicker(false);
                    }}
                    className="w-full px-4 py-2 text-sm font-medium rounded-md transition-colors"
                    style={{
                      backgroundColor: accentColorValue,
                      color: 'white'
                    }}
                  >
                    Select Today
                  </button>
                </div>

              </div>

              {/* Sticky Action Buttons */}
              <div className="flex-shrink-0 border-t border-border pt-4 mt-4">
                <div className="flex gap-2 justify-end">
                  {customDate && (
                    <button
                      onClick={handleClearDate}
                      className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      backgroundColor: accentColorValue,
                      color: 'white'
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
