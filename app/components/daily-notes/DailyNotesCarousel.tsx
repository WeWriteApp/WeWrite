"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import DayContainer from './DayContainer';
import { useAuth } from '../../providers/AuthProvider';
// Removed direct Firebase imports - now using API endpoints
import { format, subDays, addDays } from 'date-fns';
import { Button } from '../ui/button';
import { useDateFormat } from '../../contexts/DateFormatContext';
import { cn } from '../../lib/utils';
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
  isFullPage?: boolean;
  focusDate?: string | null;
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
 * - Groups pages by their creation date (createdAt field)
 * - Maintains scroll position when loading new dates
 *
 * LAYOUT STRUCTURE (simplified for easy debugging):
 * - Single overflow-x-auto container with generous bottom padding
 * - Inner flex container for horizontal layout
 * - No nested clipping containers
 * - Today pill has 3rem bottom padding space to prevent clipping
 */
export default function DailyNotesCarousel({
  accentColor = '#1768FF',
  isFullPage = false,
  focusDate = null
}: DailyNotesCarouselProps) {
  const { user } = useAuth();
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

  // Generate array of dates including all dates with pages (memoized to prevent unnecessary re-renders)
  const dates = useMemo(() => {
    const dateArray: Date[] = [];
    const today = new Date();
    const dateSet = new Set<string>();

    // Add base range: past days (in chronological order)
    for (let i = daysBefore; i >= 1; i--) {
      const date = subDays(today, i);
      const dateString = format(date, 'yyyy-MM-dd');
      dateSet.add(dateString);
      dateArray.push(date);
    }

    // Add today
    const todayString = format(today, 'yyyy-MM-dd');
    dateSet.add(todayString);
    dateArray.push(today);

    // Add base range: future days
    for (let i = 1; i <= daysAfter; i++) {
      const date = addDays(today, i);
      const dateString = format(date, 'yyyy-MM-dd');
      dateSet.add(dateString);
      dateArray.push(date);
    }

    // Add any additional dates that have pages but aren't in the base range
    if (notesByDate && notesByDate.size > 0) {
      for (const dateString of notesByDate.keys()) {
        if (!dateSet.has(dateString)) {
          try {
            const [year, month, day] = dateString.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
              dateArray.push(date);
              dateSet.add(dateString);
            }
          } catch (error) {
            // Invalid date string in notesByDate
          }
        }
      }
    }

    // Sort all dates chronologically
    return dateArray.sort((a, b) => a.getTime() - b.getTime());
  }, [daysBefore, daysAfter, notesByDate]);

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
    if (!user?.uid) return;

    try {
      // Removed excessive cache invalidation that was causing infinite loops

      // Calculate date range for the carousel using local timezone
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDate = formatLocalDate(dateRange[0]);
      const endDate = formatLocalDate(dateRange[dateRange.length - 1]);

      // Get user's timezone for the API
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Call efficient daily notes API that groups pages by creation date with timezone
      const response = await fetch(`/api/daily-notes?userId=${user?.uid}&startDate=${startDate}&endDate=${endDate}&timezone=${encodeURIComponent(userTimezone)}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch daily notes: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error || 'Failed to fetch pages')
      }

      const notesByDateMap = new Map<string, Array<{id: string, title: string}>>();

      let processedPagesCount = 0;

      // Group pages by their creation date
      result.pages.forEach((page: any) => {
        const dateString = page.createdDate; // Use the createdDate field from API
        const noteTitle = page.title || 'Untitled';

        // Only process pages with valid creation dates
        if (dateString) {
          if (!notesByDateMap.has(dateString)) {
            notesByDateMap.set(dateString, []);
          }
          notesByDateMap.get(dateString)!.push({ id: page.id, title: noteTitle });
          processedPagesCount++;
        }
      });

      setNotesByDate(notesByDateMap);
    } catch (error) {
      // Handle specific Firebase quota exhaustion error
      if (error instanceof Error && (error.message.includes('Quota exceeded') || error.message.includes('RESOURCE_EXHAUSTED'))) {
        // Daily notes temporarily unavailable due to high usage
        // Set empty notes map to show empty state instead of loading forever
        setNotesByDate(new Map());
      }
    }
  }, [user?.uid]);

  // Check for existing notes when dates change
  useEffect(() => {
    const loadNotes = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      setLoading(true);
      await checkExistingNotes(dates);
      setLoading(false);
    };

    loadNotes();
  }, [user?.uid, daysBefore, daysAfter]); // Removed dates and checkExistingNotes to prevent infinite loop

  // Listen for page updates to refresh daily notes data
  useEffect(() => {
    if (!user?.uid) return;

    // Debounce cache invalidation to prevent excessive API calls
    let debounceTimer: NodeJS.Timeout | null = null;

    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkExistingNotes(dates);
      }, 500); // 500ms debounce
    };

    const handleUserPagesInvalidation = (event: CustomEvent) => {
      const eventUserId = event.detail?.userId;
      // Refresh if no specific user ID or if it matches current user
      if (!eventUserId || eventUserId === user.uid) {
        debouncedRefresh();
      }
    };

    // Listen for user pages cache invalidation events
    window.addEventListener('invalidate-user-pages', handleUserPagesInvalidation as EventListener);

    // Also register with the global cache invalidation system
    let unregisterGlobal: (() => void) | null = null;
    try {
      const { registerUserPagesInvalidation } = require('../../utils/globalCacheInvalidation');
      unregisterGlobal = registerUserPagesInvalidation((data: any) => {
        // Only refresh if this invalidation is for our user or if no specific user is mentioned
        if (!data?.userId || data.userId === user.uid) {
          debouncedRefresh();
        }
      });
    } catch (error) {
      // Global cache invalidation not available
    }

    return () => {
      // Clear debounce timer on cleanup
      if (debounceTimer) clearTimeout(debounceTimer);

      window.removeEventListener('invalidate-user-pages', handleUserPagesInvalidation as EventListener);
      if (unregisterGlobal) {
        unregisterGlobal();
      }
    };
  }, [user?.uid]); // Removed dates and checkExistingNotes to prevent infinite re-registration

  // Handle note pill click - navigate to specific note
  const handleNoteClick = (noteId: string) => {
    try {
      router.push(`/pages/${noteId}`);
    } catch (error) {
      // Fallback to home page if navigation fails
      router.push('/');
    }
  };

  // Handle add new click - only for today's date since daily notes use createdAt
  const handleAddNewClick = useCallback((date: Date) => {
    try {
      const today = new Date();
      const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

      // Only allow creating new notes for today since daily notes are based on createdAt
      if (!isToday) {
        return;
      }

      // Navigate to new page creation - no customDate needed since it will use current createdAt
      // The page will automatically be grouped under today's date in the daily notes carousel
      router.push('/new?type=daily-note');
    } catch (error) {
      // Fallback to home page if navigation fails
      router.push('/');
    }
  }, [router]);



  // Helper function to scroll to a specific date element and center it
  const scrollToDateElement = useCallback((dateString: string, animated: boolean = true) => {
    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    // Find the element with the target date
    const targetElement = carousel.querySelector(`[data-date="${dateString}"]`);

    if (targetElement) {
      // Get the element's position relative to the carousel
      const elementRect = targetElement.getBoundingClientRect();
      const carouselRect = carousel.getBoundingClientRect();

      // Calculate scroll position to CENTER the element in the viewport
      const elementCenter = elementRect.left + elementRect.width / 2;
      const carouselCenter = carouselRect.left + carouselRect.width / 2;
      const scrollOffset = elementCenter - carouselCenter;

      const newScrollLeft = carousel.scrollLeft + scrollOffset;

      carousel.scrollTo({
        left: Math.max(0, newScrollLeft),
        behavior: animated ? 'smooth' : 'instant'
      });
    } else {
      // Fallback: scroll to approximate center
      const scrollPosition = carousel.scrollWidth / 2 - carousel.clientWidth / 2;
      carousel.scrollTo({ left: scrollPosition, behavior: animated ? 'smooth' : 'instant' });
    }
  }, []);

  // Animated scroll to today's card for initial load
  const animatedScrollToToday = useCallback(() => {
    const todayString = format(new Date(), 'yyyy-MM-dd');
    // Small delay to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollToDateElement(todayString, true);
      }, 100);
    });
  }, [scrollToDateElement]);

  // Regular scroll to today's container (used by "Today" button)
  const scrollToToday = useCallback(() => {
    const todayString = format(new Date(), 'yyyy-MM-dd');
    scrollToDateElement(todayString, true);
  }, [scrollToDateElement]);

  // Scroll to focus date or today's card on initial mount with animation
  useEffect(() => {
    if (!loading && isInitialLoad) {
      // Delay to ensure DOM is fully rendered and carousel is ready
      const timer = setTimeout(() => {
        if (focusDate) {
          // Scroll to specific focus date if provided
          scrollToDateElement(focusDate, true);
        } else {
          // No focus date, scroll to today
          const todayString = format(new Date(), 'yyyy-MM-dd');
          scrollToDateElement(todayString, true);
        }
        setIsInitialLoad(false); // Mark initial load as complete
      }, 300); // Delay to ensure DOM is ready

      return () => clearTimeout(timer);
    }
  }, [loading, isInitialLoad, scrollToDateElement, focusDate]);

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
      <div
        className="w-full overflow-x-auto scrollbar-hide"
        style={{
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.5rem',
          paddingBottom: '3rem' // Extra space for Today pill
        }}
      >
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex-shrink-0 w-48 h-52 bg-muted/50 rounded-xl animate-pulse border-theme-light"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={carouselRef}
      id="daily-notes-carousel"
      className="w-screen overflow-x-auto overflow-y-visible scrollbar-hide -mx-4 md:-mx-6 lg:-mx-8"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingTop: '0.5rem',
        paddingBottom: '3rem' // Extra space for Today pill and any other elements
      }}
    >
      <div className={cn("flex", isFullPage ? "gap-8" : "gap-4")}>
        {/* Load More Past Button */}
      <div className="flex-shrink-0 flex items-center justify-center min-w-48 h-[200px]">
        <Button
          variant="secondary"
          size="sm"
          onClick={loadMorePast}
          disabled={loadingPast}
          className="h-[200px] w-48 rounded-xl flex flex-col items-center justify-center gap-2 text-sm border-dashed"
        >
          {loadingPast ? (
            <Icon name="Loader" size={16} />
          ) : (
            <>
              <Icon name="ChevronLeft" size={16} />
              <span className="text-center leading-tight">Load 15 More</span>
            </>
          )}
        </Button>
      </div>

      {/* Day Containers */}
      {(() => {
        // Calculate the maximum number of notes across all dates for consistent card heights (only for card view)
        const maxNotesCount = isFullPage ? 0 : Math.max(
          ...dates.map(date => {
            const dateString = format(date, 'yyyy-MM-dd');
            const notesForDate = notesByDate.get(dateString) || [];
            return notesForDate.length;
          }),
          0 // Ensure we have at least 0 as minimum
        );

        return dates.map((date, index) => {
          const dateString = format(date, 'yyyy-MM-dd');
          const notesForDate = notesByDate.get(dateString) || [];
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <DayContainer
              key={dateString}
              date={date}
              notes={notesForDate}
              onNoteClick={handleNoteClick}
              onAddNewClick={isToday ? handleAddNewClick : undefined} // Only allow adding new notes for today
              accentColor={accentColor}
              isToday={isToday}
              maxNotesCount={maxNotesCount}
              isFullPage={isFullPage}
              timelineType="daily-notes"
            />
          );
        });
      })()}

      {/* Load More Future Button */}
      <div className="flex-shrink-0 flex items-center justify-center min-w-48 h-[200px]">
        <Button
          variant="secondary"
          size="sm"
          onClick={loadMoreFuture}
          disabled={loadingFuture}
          className="h-[200px] w-48 rounded-xl flex flex-col items-center justify-center gap-2 text-sm border-dashed"
        >
          {loadingFuture ? (
            <Icon name="Loader" size={16} />
          ) : (
            <>
              <Icon name="ChevronRight" size={16} />
              <span className="text-center leading-tight">Load 15 More</span>
            </>
          )}
        </Button>
      </div>
      </div>
    </div>
  );
}