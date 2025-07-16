'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useRouter } from 'next/navigation';
import DayContainer from '../daily-notes/DayContainer';
import { Button } from '../ui/button';

interface Note {
  id: string;
  title: string;
}

interface TimelineCarouselProps {
  accentColor?: string;
  className?: string;
}

/**
 * TimelineCarousel Component
 *
 * Horizontal scrolling carousel showing day containers with pages organized by custom date.
 * Features:
 * - Uses existing pages API and filters by customDate field
 * - Symmetric date range (equal days before and after today)
 * - Infinite loading with "Load 15 More" buttons at both ends
 * - Today positioned in the center of the initial range
 * - Shows multiple notes per day in container format
 * - Includes "Add new" functionality for custom date assignment
 * - Maintains scroll position when loading new dates
 */

const TimelineCarousel: React.FC<TimelineCarouselProps> = ({
  accentColor = '#1768FF',
  className = ''
}) => {
  console.log('📅 TimelineCarousel: Component rendering');

  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State for date range and notes
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 15));
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 15));
  const [notesByDate, setNotesByDate] = useState<Map<string, Note[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [maxNotesCount, setMaxNotesCount] = useState(0);

  // Generate array of dates for the current range
  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }
    
    return dates;
  }, [startDate, endDate]);

  // Check for existing notes when dates change
  const checkExistingNotes = useCallback(async () => {
    console.log('📅 TimelineCarousel: checkExistingNotes called');

    if (!currentAccount?.uid) {
      console.log('📅 TimelineCarousel: No current account UID, skipping load');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Use existing pages API
      const response = await fetch(`/api/pages?userId=${currentAccount?.uid}&limit=1000&orderBy=lastModified&orderDirection=desc`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }

      const result = await response.json();

      // Handle the nested data structure from the pages API
      const pages = result.data?.pages || result.pages || [];

      if (!Array.isArray(pages)) {
        console.error('📅 TimelineCarousel: Invalid API response - pages is not an array:', {
          result,
          pages,
          type: typeof pages
        });
        return;
      }

      console.log('📅 TimelineCarousel: API returned', pages.length, 'pages');

      // Filter pages that have customDate and group by date
      const notesByDateMap = new Map<string, Note[]>();
      let pagesWithCustomDate = 0;

      if (pages && pages.length > 0) {
        console.log('📅 TimelineCarousel: Processing pages for customDate field:', {
          totalPages: pages.length,
          samplePage: pages[0] ? {
            id: pages[0].id,
            title: pages[0].title,
            hasCustomDate: !!pages[0].customDate,
            customDate: pages[0].customDate,
            allFields: Object.keys(pages[0])
          } : null
        });

        pages.forEach((page: any) => {
        // Only process pages with customDate field
        if (page.customDate && !page.deleted) {
          const dateString = page.customDate;
          const noteTitle = page.title || 'Untitled';

          if (!notesByDateMap.has(dateString)) {
            notesByDateMap.set(dateString, []);
          }
          notesByDateMap.get(dateString)!.push({ id: page.id, title: noteTitle });
          pagesWithCustomDate++;

          console.log('📅 TimelineCarousel: Added to timeline:', {
            date: dateString,
            id: page.id,
            title: noteTitle
          });
        } else if (!page.deleted) {
          // Log pages without customDate for debugging
          console.log('📅 TimelineCarousel: Page without customDate:', {
            id: page.id,
            title: page.title,
            hasCustomDate: !!page.customDate,
            customDate: page.customDate
          });
        }
        });
      }

      console.log('📅 TimelineCarousel: Summary:', {
        totalPages: pages.length,
        pagesWithCustomDate,
        timelineDates: notesByDateMap.size,
        dateKeys: Array.from(notesByDateMap.keys()).sort()
      });

      setNotesByDate(notesByDateMap);

      // Calculate max notes count for consistent height
      let maxCount = 0;
      notesByDateMap.forEach(notes => {
        if (notes.length > maxCount) {
          maxCount = notes.length;
        }
      });
      setMaxNotesCount(maxCount);

    } catch (error) {
      console.error('📅 TimelineCarousel: Error checking existing notes:', error);
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.uid]);

  // Load notes when component mounts or user changes
  useEffect(() => {
    checkExistingNotes();
  }, [checkExistingNotes]);

  // Handle note click
  const handleNoteClick = useCallback((noteId: string) => {
    router.push(`/pages/${noteId}`);
  }, [router]);

  // Handle add new click - create new note for specific date
  const handleAddNewClick = useCallback((date: Date) => {
    try {
      const dateString = format(date, 'yyyy-MM-dd');
      // Pass the date as customDate parameter so it gets assigned automatically
      router.push(`/new?customDate=${encodeURIComponent(dateString)}&type=timeline`);
    } catch (error) {
      console.error('📅 TimelineCarousel: Error handling add new click:', error);
      // Fallback to home page if navigation fails
      router.push('/');
    }
  }, [router]);

  // Scroll to today's card
  const scrollToToday = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd');
    const todayCard = scrollContainerRef.current.querySelector(`[data-date="${todayString}"]`);

    if (todayCard) {
      // Scroll the card into view with some padding
      const container = scrollContainerRef.current;
      const cardRect = todayCard.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate scroll position to center the card
      const scrollLeft = container.scrollLeft + cardRect.left - containerRect.left - (containerRect.width / 2) + (cardRect.width / 2);

      container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    } else {
      // If today's card is not visible, scroll to approximate center
      const container = scrollContainerRef.current;
      const scrollPosition = container.scrollWidth / 2 - container.clientWidth / 2;
      container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  }, []);

  // Expose scroll function globally for the Today button
  useEffect(() => {
    (window as any).timelineScrollToToday = scrollToToday;
    return () => {
      delete (window as any).timelineScrollToToday;
    };
  }, [scrollToToday]);

  // Handle load more dates
  const handleLoadEarlier = useCallback(() => {
    setStartDate(prevStart => subDays(prevStart, 15));
  }, []);

  const handleLoadLater = useCallback(() => {
    setEndDate(prevEnd => addDays(prevEnd, 15));
  }, []);

  if (!currentAccount) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please sign in to view your timeline
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Timeline</h2>
        <p className="text-sm text-muted-foreground">
          Pages organized by custom date
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          Loading timeline...
        </div>
      )}

      {/* Carousel */}
      <div className="relative">
        {/* Load Earlier Button */}
        <button
          onClick={handleLoadEarlier}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background border border-border rounded-full p-2 shadow-lg hover:bg-accent transition-colors"
          aria-label="Load earlier dates"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable container */}
        <div ref={scrollContainerRef} className="overflow-x-auto scrollbar-hide px-12">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {dateRange.map(date => {
              const dateString = format(date, 'yyyy-MM-dd');
              const notesForDate = notesByDate.get(dateString) || [];
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

              return (
                <div key={dateString} data-date={dateString}>
                  <DayContainer
                    date={date}
                    notes={notesForDate}
                    onNoteClick={handleNoteClick}
                    onAddNewClick={handleAddNewClick}
                    accentColor={accentColor}
                    isToday={isToday}
                    maxNotesCount={maxNotesCount}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Load Later Button */}
        <button
          onClick={handleLoadLater}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background border border-border rounded-full p-2 shadow-lg hover:bg-accent transition-colors"
          aria-label="Load later dates"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Empty state */}
      {!loading && notesByDate.size === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">No pages with custom dates found</p>
          <p className="text-sm">
            Create a new page and assign it a custom date to see it in your timeline
          </p>
        </div>
      )}
    </div>
  );
};

export default TimelineCarousel;
