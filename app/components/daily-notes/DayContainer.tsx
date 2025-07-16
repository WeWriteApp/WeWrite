"use client";

import React from 'react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { useTheme } from 'next-themes';
import { PillLink } from '../utils/PillLink';
import { Plus } from 'lucide-react';

interface Note {
  id: string;
  title: string;
}

interface DayContainerProps {
  date: Date;
  notes: Note[];
  onNoteClick: (noteId: string) => void;
  onAddNewClick?: (date: Date) => void; // Optional for Timeline functionality
  accentColor?: string;
  isToday?: boolean;
  className?: string;
  maxNotesCount?: number; // Maximum number of notes across all cards for consistent height
}

/**
 * DayContainer Component
 *
 * Displays a day container with date header and multiple note pills.
 * Used by both Daily Notes (creation date) and Timeline (custom date).
 */
const DayContainer = React.memo(function DayContainer({
  date,
  notes,
  onNoteClick,
  onAddNewClick,
  accentColor = '#1768FF',
  isToday = false,
  className,
  maxNotesCount = 0
}: DayContainerProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Format date for display
  const dayName = format(date, 'EEE'); // Mon, Tue, etc.
  const monthDay = format(date, 'MMM d'); // Jul 7, etc.

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          // Use global card styling for consistency - reduced width
          "flex-shrink-0 w-48 rounded-xl border-theme-strong bg-card text-card-foreground shadow-sm",
          "dark:bg-card/90 dark:hover:bg-card/100 overflow-hidden hover:bg-muted/30",
          "transition-all duration-200 p-4",
          // Add accent border for today's card
          isToday && "border-2",
          className
        )}
        style={isToday ? { borderColor: accentColor } : undefined}
      >
        {/* Date Header - Centered */}
        <div className="mb-3 text-center">
          <div className="text-lg font-semibold text-foreground">
            {dayName} {monthDay}
          </div>
        </div>

        {/* Notes Pills - with consistent height based on maxNotesCount */}
        <div
          className="flex flex-wrap gap-2 items-start mb-3"
          style={{
            // Calculate minimum height based on max notes count
            // Assuming ~32px per row (pill height + gap), with at least one row
            minHeight: maxNotesCount > 0 ? `${Math.max(32, Math.ceil(maxNotesCount / 2) * 40)}px` : '32px'
          }}
        >
          {notes.map((note) => (
            <PillLink
              key={note.id}
              href={`/pages/${note.id}`}
              isPublic={true}
              className="hover:scale-105 transition-transform"
            >
              {note.title}
            </PillLink>
          ))}

          {/* Show message when no notes for this date and no add button */}
          {notes.length === 0 && !onAddNewClick && (
            <div className="text-sm text-muted-foreground italic">
              No pages created on this date
            </div>
          )}
        </div>

        {/* Add New Button - only show if onAddNewClick is provided (Timeline) */}
        {onAddNewClick && (
          <button
            className={cn(
              "w-full flex items-center justify-center gap-2 px-3 py-2",
              "rounded-lg border-2 border-dashed transition-all duration-200",
              "text-sm font-medium hover:scale-[1.02] active:scale-[0.98]",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "border-border text-muted-foreground",
              "hover:border-border/80 hover:text-foreground"
            )}
            style={{
              focusRingColor: accentColor + '40' // 25% opacity for focus ring
            }}
            onClick={() => onAddNewClick(date)}
          >
            <Plus className="w-4 h-4" />
            Add new
          </button>
        )}
      </div>

      {/* Today pill - positioned underneath the card, centered */}
      {isToday && (
        <div className="mt-2 flex justify-center">
          <div
            className="px-3 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: accentColor }}
          >
            Today
          </div>
        </div>
      )}
    </div>
  );
});

export default DayContainer;
