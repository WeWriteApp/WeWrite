"use client";

import React from 'react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import PillLink from '../utils/PillLink';
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
  isFullPage?: boolean; // Whether this is in full-page view
  timelineType?: 'daily-notes' | 'timeline'; // Type of timeline for navigation
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
  maxNotesCount = 0,
  isFullPage = false,
  timelineType = 'daily-notes'
}: DayContainerProps) {
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const isDark = resolvedTheme === 'dark';

  // Format date for display
  const dayName = format(date, 'EEE'); // Mon, Tue, etc.
  const monthDay = format(date, 'MMM d'); // Jul 7, etc.

  // Truncation logic - be very conservative to prevent clipping
  // Use 3 pills max to ensure they always fit without clipping in the fixed height container
  const maxPillsToShow = isFullPage ? notes.length : 3;
  const visibleNotes = notes.slice(0, maxPillsToShow);
  const hasMoreNotes = notes.length > maxPillsToShow;

  // Navigation handlers
  const handleHeaderClick = () => {
    if (!isFullPage) {
      const dateStr = format(date, 'yyyy-MM-dd');
      router.push(`/timeline?type=${timelineType}&date=${dateStr}`);
    }
  };

  const handleViewMore = () => {
    const dateStr = format(date, 'yyyy-MM-dd');
    router.push(`/timeline?type=${timelineType}&date=${dateStr}`);
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          // Different sizing for full page vs card view
          isFullPage
            ? "flex-shrink-0 w-80 min-h-[400px] max-h-[80vh] rounded-xl border-theme-strong bg-card text-card-foreground shadow-sm"
            : "flex-shrink-0 w-48 h-64 rounded-xl border-theme-strong bg-card text-card-foreground shadow-sm",
          "dark:bg-card/90 dark:hover:bg-card/100 overflow-hidden hover:bg-muted/30",
          "transition-all duration-200 p-4 flex flex-col",
          // Add accent border for today's card
          isToday && "border-2",
          className
        )}
        style={isToday ? { borderColor: accentColor } : undefined}
      >
        {/* Date Header - Centered and clickable if not in full page */}
        <div
          className={cn(
            "mb-3 text-center flex-shrink-0",
            !isFullPage && "cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
          )}
          onClick={handleHeaderClick}
          data-date={format(date, 'yyyy-MM-dd')}
        >
          <div className="text-lg font-semibold text-foreground">
            {dayName} {monthDay}
          </div>
        </div>

        {/* Notes Pills Container - takes up available space */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Notes Pills - different layout for full page vs card view */}
          <div className={cn(
            "flex flex-wrap gap-2 items-start flex-1",
            isFullPage
              ? "overflow-y-auto" // Allow scrolling in full page view
              : "overflow-hidden max-h-[4.5rem]" // Restrict height in card view
          )}>
            {visibleNotes.map((note) => (
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
        </div>

        {/* Bottom Actions Container - always at bottom */}
        <div className="flex-shrink-0 mt-3 space-y-2">
          {/* View More Button - only show if there are more notes and not in full page */}
          {hasMoreNotes && !isFullPage && (
            <button
              onClick={handleViewMore}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 hover:bg-muted/50 rounded"
            >
              View {notes.length - maxPillsToShow} more...
            </button>
          )}

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
