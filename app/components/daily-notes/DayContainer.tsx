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
  onAddNewClick: (date: Date) => void;
  accentColor?: string;
  isToday?: boolean;
  className?: string;
}

/**
 * DayContainer Component
 *
 * Displays a day container with date header and multiple note pills.
 * Replaces the old DayCard component to support multiple notes per day.
 */
const DayContainer = React.memo(function DayContainer({
  date,
  notes,
  onNoteClick,
  onAddNewClick,
  accentColor = '#1768FF',
  isToday = false,
  className
}: DayContainerProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Format date for display
  const dayName = format(date, 'EEE'); // Mon, Tue, etc.
  const monthDay = format(date, 'MMM d'); // Jul 7, etc.

  return (
    <div
      className={cn(
        // Use global card styling for consistency - reduced width
        "flex-shrink-0 w-48 rounded-xl border-theme-strong bg-card text-card-foreground shadow-sm",
        "dark:bg-card/90 dark:hover:bg-card/100 overflow-hidden hover:bg-muted/30",
        "transition-all duration-200 p-4",
        className
      )}
    >
      {/* Date Header - Centered */}
      <div className="mb-3 text-center">
        <div className="text-lg font-semibold text-foreground">
          {dayName} {monthDay}
        </div>
        {isToday && (
          <div
            className="text-xs font-medium mt-1"
            style={{ color: accentColor }}
          >
            Today
          </div>
        )}
      </div>

      {/* Notes Pills */}
      <div className="space-y-2 mb-3">
        {notes.map((note) => (
          <div key={note.id} className="w-full">
            <PillLink
              href={`/pages/${note.id}`}
              isPublic={true}
              className="inline-block max-w-full truncate"
            >
              {note.title}
            </PillLink>
          </div>
        ))}
      </div>

      {/* Add New Button */}
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
    </div>
  );
});

export default DayContainer;
