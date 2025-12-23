'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';

interface EmptyLinesAlertProps {
  emptyLinesCount: number;
  onDeleteAllEmptyLines: () => void;
  className?: string;
}

/**
 * EmptyLinesAlert Component
 * 
 * Displays a warning banner at the bottom of the edit page when there are empty lines.
 * Provides a button to delete all empty lines at once.
 * 
 * Features:
 * - Shows count of empty lines
 * - Warning styling with orange/amber colors
 * - Delete all empty lines button
 * - Only shows when there are empty lines
 * - Responsive design
 */
export default function EmptyLinesAlert({
  emptyLinesCount,
  onDeleteAllEmptyLines,
  className = ''
}: EmptyLinesAlertProps) {
  // Don't render if no empty lines
  if (emptyLinesCount === 0) {
    return null;
  }

  return (
    <div className={`mt-6 ${className}`}>
      <div className="bg-amber-50 dark:bg-amber-950/20 border-theme-medium shadow-lg rounded-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-3 sm:gap-4">
            {/* Warning content */}
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="flex-shrink-0">
                <Icon name="AlertTriangle" size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                    {emptyLinesCount === 1 
                      ? '1 empty line detected' 
                      : `${emptyLinesCount} empty lines detected`
                    }
                  </span>
                  <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                    Empty lines are highlighted in orange
                  </span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={onDeleteAllEmptyLines}
                className="gap-2 h-8 px-3 text-xs sm:text-sm border-theme-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <Icon name="Trash2" size={24} className="h-3.5 w-3.5" />
                Delete Empty Lines
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
