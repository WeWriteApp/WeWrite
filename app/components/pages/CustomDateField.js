"use client";

import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useAccentColor, ACCENT_COLOR_VALUES } from '../../contexts/AccentColorContext';
import { useDateFormat } from '../../contexts/DateFormatContext';

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
    if (newDate && onCustomDateChange) {
      onCustomDateChange(newDate);
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

  // Don't render if no custom date
  if (!customDate) {
    return null;
  }

  return (
    <div className={`${className}`}>
      <div
        className={`flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm ${canEdit ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
        onClick={handleDateClick}
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Custom date</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
            {formatCustomDate(customDate) || customDate}
          </div>
        </div>

        {/* Date picker overlay */}
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDatePicker(false)}>
            <div className="bg-background border rounded-lg p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">Select custom date:</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={handleDateChange}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
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
