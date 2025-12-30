'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';

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
    <Button
      variant="destructive-secondary"
      size="lg"
      onClick={onDeleteAllEmptyLines}
      className={`w-full gap-2 rounded-2xl font-medium ${className}`}
    >
      <Icon name="Trash2" size={20} />
      Delete {emptyLinesCount} empty {emptyLinesCount === 1 ? 'line' : 'lines'}
    </Button>
  );
}
