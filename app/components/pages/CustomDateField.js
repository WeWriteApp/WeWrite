"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
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

/**
 * Calendar Component
 *
 * A visual calendar grid for date selection
 */
function CalendarGrid({ selectedDate, onDateSelect, accentColorValue }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) {
      try {
        return new Date(selectedDate);
      } catch (e) {
        return new Date();
      }
    }
    return new Date();
  });

  // Update current month when selected date changes
  useEffect(() => {
    if (selectedDate) {
      try {
        const newDate = new Date(selectedDate);
        if (!isNaN(newDate.getTime())) {
          setCurrentMonth(newDate);
        }
      } catch (e) {
        // Invalid date, keep current month
      }
    }
  }, [selectedDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  // Generate calendar grid
  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const isSelected = selectedDate && isSameDay(day, new Date(selectedDate));
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
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={nextMonth}
          className="p-1 hover:bg-muted rounded-md transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
            {day}
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

/**
 * CustomDateField Component
 *
 * Displays and allows editing of a page's custom date field.
 * Can be used in both edit and view modes.
 *
 * @param {Object} props
 * @param {string} props.customDate - Custom date for the page (YYYY-MM-DD format)
 * @param {boolean} props.canEdit - Whether the user can edit the date
 * @param {Function} props.onCustomDateChange - Callback when custom date is changed
 * @param {string} props.className - Additional CSS classes
 */
export default function CustomDateField({
  customDate,
  canEdit = false,
  onCustomDateChange,
  className = ""
}) {
  const { accentColor, customColors } = useAccentColor();
  const { formatDateString } = useDateFormat();
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Get the actual color value based on the selected accent color
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor];
    }
    return ACCENT_COLOR_VALUES[accentColor] || "#1768FF";
  };

  const accentColorValue = getAccentColorValue();

  const handleDateClick = () => {
    if (canEdit) {
      setShowDatePicker(true);
    }
  };

  const handleDateChange = (event) => {
    const newDate = event.target.value;
    if (onCustomDateChange) {
      onCustomDateChange(newDate); // Allow empty string to clear the date
    }
    setShowDatePicker(false);
  };

  const handleCalendarDateSelect = (date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    if (onCustomDateChange) {
      onCustomDateChange(formattedDate);
    }
    setShowDatePicker(false);
  };

  const handleClearDate = () => {
    if (onCustomDateChange) {
      onCustomDateChange(null); // Clear the custom date
    }
    setShowDatePicker(false);
  };

  const formatCustomDate = (dateString) => {
    if (!dateString) return null;
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return formatDateString(date);
    } catch (error) {
      return dateString; // Fallback to original string
    }
  };

  // Always render the field, but show different UI based on whether there's a custom date

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`w-full flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm ${canEdit ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
        onClick={handleDateClick}
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Custom date</span>
        </div>

        <div className="flex items-center gap-2">
          {customDate ? (
            <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
              {formatCustomDate(customDate) || customDate}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm font-medium px-2 py-1 rounded-md border border-dashed border-border">
              {canEdit ? 'Click to set date' : 'No custom date'}
            </div>
          )}
        </div>

        {/* Enhanced Date picker overlay */}
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDatePicker(false)}>
            <div className="bg-background border rounded-lg p-6 shadow-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Select custom date</h3>
                <p className="text-sm text-muted-foreground">Choose a date for this page</p>
              </div>

              {/* Calendar Interface */}
              <div className="mb-6">
                <CalendarGrid
                  selectedDate={customDate}
                  onDateSelect={handleCalendarDateSelect}
                  accentColorValue={accentColorValue}
                />
              </div>

              {/* Quick Today Button */}
              <div className="mb-4">
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

              {/* Date input field for manual entry */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Or enter date manually (YYYY-MM-DD):</label>
                <input
                  type="date"
                  value={customDate || ''}
                  onChange={handleDateChange}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Quick action buttons */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Quick actions:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      if (onCustomDateChange) {
                        onCustomDateChange(today);
                      }
                      setShowDatePicker(false);
                    }}
                    className="px-3 py-2 text-sm border border-border rounded hover:bg-muted flex-1"
                    style={{
                      borderColor: accentColorValue + '40',
                      color: accentColorValue
                    }}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      const yesterdayString = yesterday.toISOString().split('T')[0];
                      if (onCustomDateChange) {
                        onCustomDateChange(yesterdayString);
                      }
                      setShowDatePicker(false);
                    }}
                    className="px-3 py-2 text-sm border border-border rounded hover:bg-muted flex-1"
                  >
                    Yesterday
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-end">
                {customDate && (
                  <button
                    onClick={handleClearDate}
                    className="px-4 py-2 text-sm border border-destructive text-destructive rounded hover:bg-destructive/10"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="px-4 py-2 text-sm border border-border rounded hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
