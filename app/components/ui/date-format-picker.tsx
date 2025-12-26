"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from './button';
import { cn } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem
} from './dropdown-menu';
import {
  DATE_FORMATS,
  DateFormatType,
  useDateFormat
} from '../../contexts/DateFormatContext';

interface DateFormatPickerProps {
  currentDate?: string; // YYYY-MM-DD format for preview
  className?: string;
  trigger?: React.ReactNode;
}

/**
 * DateFormatPicker Component
 *
 * A dropdown that allows users to select their preferred date format.
 * Shows a preview of how the current date would look in each format.
 * Uses the centralized DropdownMenu for consistent animations.
 */
export function DateFormatPicker({
  currentDate = '2025-06-02', // Default preview date
  className,
  trigger
}: DateFormatPickerProps) {
  const { dateFormat, setDateFormat } = useDateFormat();

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
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button
            variant="secondary"
            className={cn("justify-between w-full", className)}
          >
            <span>{getPreviewText(dateFormat)}</span>
            <Icon name="ChevronDown" size={16} className="opacity-50" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px]">
        {Object.values(DATE_FORMATS).map((format) => {
          const isSelected = dateFormat === format;
          const previewText = getPreviewText(format);

          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleFormatSelect(format)}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                isSelected && "bg-primary/10"
              )}
            >
              <span className={cn("font-medium", isSelected && "text-primary")}>
                {previewText}
              </span>
              {isSelected && (
                <Icon name="Check" size={16} className="text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
