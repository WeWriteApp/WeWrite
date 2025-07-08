"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DayContainer from './DayContainer';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
// Removed direct Firebase imports - now using API endpoints
import { format, subDays, addDays } from 'date-fns';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDateFormat } from '../../contexts/DateFormatContext';
/**
 * Check if a title exactly matches the YYYY-MM-DD format
 * Returns true only for exact matches (10 characters, no additional text)
 */
const isExactDateFormat = (title: string): boolean => {
  // Must be exactly 10 characters long
  if (title.length !== 10) {
    return false;
  }

  // Must match YYYY-MM-DD pattern exactly
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(title);
};

interface DailyNotesCarouselProps {
  accentColor?: string;
}

/**
 * DailyNotesCarousel Component
 *
 * Horizontal scrolling carousel showing day containers with multiple notes.
 * Features:
 * - Symmetric date range (equal days before and after today)
 * - Infinite loading with "Load 15 More" buttons at both ends
 * - Today positioned in the center of the initial range
 * - Shows multiple notes per day in container format
 * - Supports both customDate field and legacy YYYY-MM-DD titles
 * - Maintains scroll position when loading new dates
 */
export default function DailyNotesCarousel({ accentColor = '#1768FF' }: DailyNotesCarouselProps) {
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);
  const { formatDateString } = useDateFormat();

  // State for dynamic date range
  const [daysBefore, setDaysBefore] = useState(15); // Days before today
  const [daysAfter, setDaysAfter] = useState(15);   // Days after today

  // State for existing notes - now organized by date
  const [notesByDate, setNotesByDate] = useState<Map<string, Array<{id: string, title: string}>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Generate symmetric array of dates (memoized to prevent unnecessary re-renders)
  const dates = useMemo(() => {
    const dateArray: Date[] = [];
    const today = new Date();

    // Add past days (in chronological order)
    for (let i = daysBefore; i >= 1; i--) {
      dateArray.push(subDays(today, i));
    }

    // Add today
    dateArray.push(today);

    // Add future days
    for (let i = 1; i <= daysAfter; i++) {
      dateArray.push(addDays(today, i));
    }

    return dateArray;
  }, [daysBefore, daysAfter]);

  // Load more dates in the past
  const loadMorePast = useCallback(() => {
    if (loadingPast) return;

    setLoadingPast(true);
    setIsInitialLoad(false); // Ensure no animation triggers after loading more

    // Store current scroll position relative to the current first date card
    const carousel = carouselRef.current;
    const currentScrollLeft = carousel?.scrollLeft || 0;

    // Expand the range by 15 days in the past
    setDaysBefore(prev => prev + 15);

    // After state update, restore scroll position accounting for new containers
    requestAnimationFrame(() => {
      if (carousel) {
        const containerWidth = 208; // w-48 (192px) + 16px gap
        const newScrollPosition = currentScrollLeft + (15 * containerWidth);
        carousel.scrollTo({ left: newScrollPosition, behavior: 'instant' });
      }
      setLoadingPast(false);
    });
  }, [loadingPast]);

  // Load more dates in the future
  const loadMoreFuture = useCallback(() => {
    if (loadingFuture) return;

    setLoadingFuture(true);
    setIsInitialLoad(false); // Ensure no animation triggers after loading more

    // Expand the range by 15 days in the future
    setDaysAfter(prev => prev + 15);

    // No need to adjust scroll position for future dates
    requestAnimationFrame(() => {
      setLoadingFuture(false);
    });
  }, [loadingFuture]);

  // Check for existing notes with exact YYYY-MM-DD format titles only
  const checkExistingNotes = useCallback(async (dateRange: Date[]) => {
    if (!currentAccount?.uid) return;

    try {
      // Call API endpoint to get user's pages
      const response = await fetch(`/api/my-pages?userId=${currentAccount?.uid}&limit=1000&sortBy=title&sortDirection=asc`)

      if (!response.ok) {
        throw new Error(`Failed to fetch pages: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error || 'Failed to fetch pages')
      }

      const notesByDateMap = new Map<string, Array<{id: string, title: string}>>();

      // Filter pages to find ALL daily notes (not just those in current range)
      result.pages.forEach((page: any) => {
        let dateString: string | null = null;
        let noteTitle = page.title;

        // Check for pages with customDate field (new format)
        if (page.customDate) {
          dateString = page.customDate;
          // For migrated daily notes, show as "Daily note"
          if (page.title === page.customDate) {
            noteTitle = "Daily note";
          }
        }
        // Check legacy format (title as YYYY-MM-DD, only if no customDate)
        else if (page.title && isExactDateFormat(page.title)) {
          dateString = page.title;
          noteTitle = "Daily note"; // Legacy daily notes become "Daily note"
        }

        // If we found a date, add it to the map
        if (dateString) {
          if (!notesByDateMap.has(dateString)) {
            notesByDateMap.set(dateString, []);
          }
          notesByDateMap.get(dateString)!.push({ id: page.id, title: noteTitle });
        }
      });

      setNotesByDate(notesByDateMap);
    } catch (error) {
      console.error('Error checking existing notes:', error);
    }
  }, [currentAccount?.uid]);

  // Check for existing notes when dates change
  useEffect(() => {
    const loadNotes = async () => {
      if (!currentAccount?.uid) {
        setLoading(false);
        return;
      }

      setLoading(true);
      await checkExistingNotes(dates);
      setLoading(false);
    };

    loadNotes();
  }, [currentAccount?.uid, daysBefore, daysAfter, dates, checkExistingNotes]);

  // Handle note pill click - navigate to specific note
  const handleNoteClick = (noteId: string) => {
    try {
      router.push(`/pages/${noteId}`);
    } catch (error) {
      console.error('Error handling note click:', error);
      // Fallback to home page if navigation fails
      router.push('/');
    }
  };

  // Handle add new click - create new note for specific date
  const handleAddNewClick = (date: Date) => {
    try {
      const dateString = format(date, 'yyyy-MM-dd');
      // Use the correct URL parameter format that the /new page expects
      router.push(`/new?title=${encodeURIComponent(dateString)}&type=daily-note`);
    } catch (error) {
      console.error('Error handling add new click:', error);
      // Fallback to home page if navigation fails
      router.push('/');
    }
  };

  // Animated scroll to today's card for initial load
  const animatedScrollToToday = useCallback(() => {
    const today = new Date();
    const todayIndex = dates.findIndex(date =>
      date.toDateString() === today.toDateString()
    );

    if (todayIndex !== -1) {
      const carousel = carouselRef.current;
      if (carousel) {
        const containerWidth = 208; // w-48 (192px) + 16px gap
        const loadMoreButtonWidth = 208; // Same as container width

        // Calculate the exact center position accounting for the "Load More Past" button and container padding
        // The target position should center today's container in the visible area
        const containerPadding = 24; // px-6 = 24px on each side
        const visibleWidth = carousel.clientWidth - (containerPadding * 2);
        const visibleCenter = visibleWidth / 2;
        const containerCenter = containerWidth / 2;

        // Position of today's container relative to the start of content (after load button)
        const todayContainerStart = loadMoreButtonWidth + (todayIndex * containerWidth);
        const todayContainerCenter = todayContainerStart + containerCenter;

        // Calculate scroll position to center today's container in the visible area
        const targetScrollPosition = Math.max(0, todayContainerCenter - visibleCenter);

        // Start from the leftmost position (showing past days)
        carousel.scrollTo({ left: 0, behavior: 'instant' });

        // After a brief moment, animate to today's position
        requestAnimationFrame(() => {
          setTimeout(() => {
            carousel.scrollTo({
              left: targetScrollPosition,
              behavior: 'smooth'
            });
          }, 150); // Small delay to ensure the instant scroll completes
        });
      }
    }
  }, [dates]);

  // Regular scroll to today's container (used by "Today" button)
  const scrollToToday = useCallback(() => {
    const today = new Date();
    const todayIndex = dates.findIndex(date =>
      date.toDateString() === today.toDateString()
    );

    if (todayIndex !== -1) {
      const carousel = carouselRef.current;
      if (carousel) {
        const containerWidth = 208; // w-48 (192px) + 16px gap
        const loadMoreButtonWidth = 208; // Same as container width

        // Calculate the exact center position accounting for the "Load More Past" button and container padding
        const containerPadding = 24; // px-6 = 24px on each side
        const visibleWidth = carousel.clientWidth - (containerPadding * 2);
        const visibleCenter = visibleWidth / 2;
        const containerCenter = containerWidth / 2;

        // Position of today's container relative to the start of content (after load button)
        const todayContainerStart = loadMoreButtonWidth + (todayIndex * containerWidth);
        const todayContainerCenter = todayContainerStart + containerCenter;

        // Calculate scroll position to center today's container in the visible area
        const scrollPosition = Math.max(0, todayContainerCenter - visibleCenter);
        carousel.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      }
    }
  }, [dates]);

  // Scroll to today's card on initial mount with animation
  useEffect(() => {
    if (!loading && isInitialLoad) {
      // Delay to ensure DOM is fully rendered and carousel is ready
      const timer = setTimeout(() => {
        animatedScrollToToday();
        setIsInitialLoad(false); // Mark initial load as complete
      }, 200); // Slightly longer delay to ensure smooth animation

      return () => clearTimeout(timer);
    }
  }, [loading, isInitialLoad, animatedScrollToToday]);

  // Expose scrollToToday function globally for the "Today" button
  useEffect(() => {
    // Store the function globally so the DailyNotesSection can access it
    (window as any).dailyNotesScrollToToday = scrollToToday;

    return () => {
      delete (window as any).dailyNotesScrollToToday;
    };
  }, [scrollToToday]);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2 px-6 pt-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-48 h-[200px] bg-muted/50 rounded-xl animate-pulse border-theme-light"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={carouselRef}
      id="daily-notes-carousel"
      className="flex gap-4 overflow-x-auto pb-2 px-6 pt-2 scrollbar-hide"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Load More Past Button */}
      <div className="flex-shrink-0 flex items-center justify-center min-w-48 h-[200px]">
        <Button
          variant="outline"
          size="sm"
          onClick={loadMorePast}
          disabled={loadingPast}
          className="h-[200px] w-48 rounded-xl flex flex-col items-center justify-center gap-2 text-sm border-dashed"
        >
          {loadingPast ? (
            <div className="animate-spin">⟳</div>
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-center leading-tight">Load 15 More</span>
            </>
          )}
        </Button>
      </div>

      {/* Day Containers */}
      {dates.map((date, index) => {
        const dateString = format(date, 'yyyy-MM-dd');
        const notesForDate = notesByDate.get(dateString) || [];
        const isToday = new Date().toDateString() === date.toDateString();

        return (
          <DayContainer
            key={dateString}
            date={date}
            notes={notesForDate}
            onNoteClick={handleNoteClick}
            onAddNewClick={handleAddNewClick}
            accentColor={accentColor}
            isToday={isToday}
          />
        );
      })}

      {/* Load More Future Button */}
      <div className="flex-shrink-0 flex items-center justify-center min-w-48 h-[200px]">
        <Button
          variant="outline"
          size="sm"
          onClick={loadMoreFuture}
          disabled={loadingFuture}
          className="h-[200px] w-48 rounded-xl flex flex-col items-center justify-center gap-2 text-sm border-dashed"
        >
          {loadingFuture ? (
            <div className="animate-spin">⟳</div>
          ) : (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-center leading-tight">Load 15 More</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}