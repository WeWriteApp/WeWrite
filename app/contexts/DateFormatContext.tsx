"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Available date format options
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  FULL_DAY: 'Mon, Jun 2, 2025',
  SHORT_DAY: 'Mon Jun 2',
  MONTH_DAY_YEAR: 'June 2, 2025',
  DAY_MONTH_YEAR: '2 June 2025',
  NUMERIC_SHORT: '06/02/2025',
  NUMERIC_EURO: '02/06/2025'
} as const;

export type DateFormatType = typeof DATE_FORMATS[keyof typeof DATE_FORMATS];

// Format descriptions for the picker
export const DATE_FORMAT_DESCRIPTIONS = {
  [DATE_FORMATS.ISO]: 'ISO Format (YYYY-MM-DD)',
  [DATE_FORMATS.FULL_DAY]: 'Full Day Name',
  [DATE_FORMATS.SHORT_DAY]: 'Short Day Name',
  [DATE_FORMATS.MONTH_DAY_YEAR]: 'Month Day, Year',
  [DATE_FORMATS.DAY_MONTH_YEAR]: 'Day Month Year',
  [DATE_FORMATS.NUMERIC_SHORT]: 'US Numeric (MM/DD/YYYY)',
  [DATE_FORMATS.NUMERIC_EURO]: 'European Numeric (DD/MM/YYYY)'
} as const;

interface DateFormatContextType {
  dateFormat: DateFormatType;
  setDateFormat: (format: DateFormatType) => void;
  formatDate: (date: Date | string) => string;
  formatDateString: (dateString: string) => string;
}

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined);

interface DateFormatProviderProps {
  children: ReactNode;
}

/**
 * DateFormatProvider - Context provider for global date formatting preferences
 *
 * Manages the user's preferred date format and persists the selection in localStorage
 * for consistent date display across the entire application.
 */
export function DateFormatProvider({ children }: DateFormatProviderProps) {
  // Default to ISO format
  const [dateFormat, setDateFormatState] = useState<DateFormatType>(DATE_FORMATS.ISO);

  // Load saved preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedFormat = localStorage.getItem('dateFormat') as DateFormatType;
        if (savedFormat && Object.values(DATE_FORMATS).includes(savedFormat)) {
          setDateFormatState(savedFormat);
        }
      } catch (error) {
        console.error('Error loading date format from localStorage:', error);
      }
    }
  }, []);

  // Save preference to localStorage when it changes
  const setDateFormat = (format: DateFormatType) => {
    setDateFormatState(format);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dateFormat', format);
        console.log('Date format saved to localStorage:', format);
      } catch (error) {
        console.error('Error saving date format to localStorage:', error);
      }
    }
  };

  // Format a Date object or date string according to user preference
  const formatDate = (date: Date | string): string => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Validate date
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date provided to formatDate:', date);
        return typeof date === 'string' ? date : 'Invalid Date';
      }

      return formatDateByType(dateObj, dateFormat);
    } catch (error) {
      console.error('Error formatting date:', error);
      return typeof date === 'string' ? date : 'Invalid Date';
    }
  };

  // Format a YYYY-MM-DD string according to user preference
  const formatDateString = (dateString: string): string => {
    try {
      // If it's already in the user's preferred format and not ISO, return as-is
      if (dateFormat !== DATE_FORMATS.ISO && !isISODateString(dateString)) {
        return dateString;
      }

      // Parse the date string safely to avoid timezone offset issues
      let dateObj: Date;
      if (isISODateString(dateString)) {
        // Parse YYYY-MM-DD manually to avoid timezone offset issues
        const [year, month, day] = dateString.split('-').map(Number);
        dateObj = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        dateObj = new Date(dateString);
      }

      // Validate date
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date string provided to formatDateString:', dateString);
        return dateString;
      }

      return formatDateByType(dateObj, dateFormat);
    } catch (error) {
      console.error('Error formatting date string:', error);
      return dateString;
    }
  };

  const value: DateFormatContextType = {
    dateFormat,
    setDateFormat,
    formatDate,
    formatDateString
  };

  return (
    <DateFormatContext.Provider value={value}>
      {children}
    </DateFormatContext.Provider>
  );
}

/**
 * Hook to use the DateFormat context
 */
export function useDateFormat() {
  const context = useContext(DateFormatContext);
  if (context === undefined) {
    throw new Error('useDateFormat must be used within a DateFormatProvider');
  }
  return context;
}

/**
 * Format a date according to the specified format type
 */
function formatDateByType(date: Date, format: DateFormatType): string {
  const options: Intl.DateTimeFormatOptions = {};
  
  switch (format) {
    case DATE_FORMATS.ISO:
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
      
    case DATE_FORMATS.FULL_DAY:
      // Mon, Jun 2, 2025
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
    case DATE_FORMATS.SHORT_DAY:
      // Mon Jun 2
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      
    case DATE_FORMATS.MONTH_DAY_YEAR:
      // June 2, 2025
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
    case DATE_FORMATS.DAY_MONTH_YEAR:
      // 2 June 2025
      return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
    case DATE_FORMATS.NUMERIC_SHORT:
      // 06/02/2025
      return date.toLocaleDateString('en-US');
      
    case DATE_FORMATS.NUMERIC_EURO:
      // 02/06/2025
      return date.toLocaleDateString('en-GB');
      
    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Check if a string is in ISO date format (YYYY-MM-DD)
 */
function isISODateString(dateString: string): boolean {
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  return isoPattern.test(dateString);
}