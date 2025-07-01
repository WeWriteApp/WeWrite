"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
// TODO: Move these constants to global store or utils
import {
  DATE_FORMATS,
  DATE_FORMAT_DESCRIPTIONS,
  DateFormatType
} from '../../contexts/DateFormatContext';

interface DateFormatPickerProps {
  currentDate?: string; // YYYY-MM-DD format for preview
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

/**
 * DateFormatPicker Component
 *
 * A dropdown that allows users to select their preferred date format.
 * Shows a preview of how the current date would look in each format.
 */
export function DateFormatPicker({
  currentDate = '2025-06-02', // Default preview date
  className,
  isOpen: controlledIsOpen,
  onClose,
  trigger
}: DateFormatPickerProps) {
  const { dateFormat, setDateFormat } = useDateFormat();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onClose ? (open: boolean) => !open && onClose() : setInternalIsOpen;

  // Create a preview date object - parse safely to avoid timezone offset issues
  const previewDate = (() => {
    try {
      // Check if it's in YYYY-MM-DD format
      const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
      if (isoPattern.test(currentDate)) {
        // Parse YYYY-MM-DD manually to avoid timezone offset issues
        const [year, month, day] = currentDate.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
      } else {
        // For other formats, use regular Date constructor
        return new Date(currentDate);
      }
    } catch (error) {
      console.error('Error parsing currentDate:', error);
      // Fallback to a default date
      return new Date(2025, 5, 5); // June 5, 2025
    }
  })();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, setIsOpen]);

  // Generate preview text for each format
  const getPreviewText = (format: DateFormatType): string => {
    try {
      switch (format) {
        case DATE_FORMATS.ISO:
          return previewDate.toISOString().split('T')[0]; // YYYY-MM-DD

        case DATE_FORMATS.FULL_DAY:
          // Mon, Jun 2, 2025
          return previewDate.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

        case DATE_FORMATS.SHORT_DAY:
          // Mon Jun 2
          return previewDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });

        case DATE_FORMATS.MONTH_DAY_YEAR:
          // June 2, 2025
          return previewDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

        case DATE_FORMATS.DAY_MONTH_YEAR:
          // 2 June 2025
          return previewDate.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

        case DATE_FORMATS.NUMERIC_SHORT:
          // 06/02/2025
          return previewDate.toLocaleDateString('en-US');

        case DATE_FORMATS.NUMERIC_EURO:
          // 02/06/2025
          return previewDate.toLocaleDateString('en-GB');

        default:
          return previewDate.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error generating preview text:', error);
      return 'Preview unavailable';
    }
  };

  const handleFormatSelect = (format: DateFormatType) => {
    setDateFormat(format);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger */}
      <div onClick={toggleDropdown}>
        {trigger || (
          <Button
            variant="outline"
            className="justify-between w-full"
          >
            <span>{getPreviewText(dateFormat)}</span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="p-2 space-y-1">
            {Object.values(DATE_FORMATS).map((format) => {
              const isSelected = dateFormat === format;
              const previewText = getPreviewText(format);
              const description = DATE_FORMAT_DESCRIPTIONS[format];

              return (
                <button
                  key={format}
                  onClick={() => handleFormatSelect(format)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-md transition-colors text-left",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <div className="font-medium text-sm">
                    {previewText}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}