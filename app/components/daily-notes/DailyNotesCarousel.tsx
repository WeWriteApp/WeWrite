"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DayContainer from './DayContainer';
import { useAuth } from '../../providers/AuthProvider';
// Removed direct Firebase imports - now using API endpoints
import { format, subDays, addDays } from 'date-fns';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
            console.warn('Invalid date string in notesByDate:', dateString);
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

      // Reduced logging to prevent terminal spam
      // console.log(`Daily notes: querying date range ${startDate} to ${endDate} (${dateRange.length} days)`);

      // Call efficient daily notes API that groups pages by creation date with timezone
      const response = await fetch(`/api/daily-notes?userId=${user?.uid}&startDate=${startDate}&endDate=${endDate}&timezone=${encodeURIComponent(userTimezone)}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch daily notes: ${response.status}`)
      }

      const result = await response.json()

      console.log('🔍 DailyNotesCarousel: API response summary:', {
        totalFound: result.totalFound,
        pagesReturned: result.pages.length,
        sortBy: result.sortBy,
        sortDirection: result.sortDirection
      });

      // Check for the specific page you mentioned
      const legacyPage = result.pages.find(p => p.id === 'BYojetF6H58rq1xvf0mY');
      if (legacyPage) {
        console.log('🔍 DailyNotesCarousel: Found specific page BYojetF6H58rq1xvf0mY:', {
          id: legacyPage.id,
          title: legacyPage.title,
          customDate: legacyPage.customDate,
          hasCustomDate: !!legacyPage.customDate,
          deleted: legacyPage.deleted,
          isPublic: legacyPage.isPublic,
          userId: legacyPage.userId
        });
      } else {
        console.log('🔍 DailyNotesCarousel: Specific page BYojetF6H58rq1xvf0mY NOT FOUND in API response');

        // Check if it exists in the raw response but with different properties
        const allPageIds = result.pages.map(p => p.id);
        console.log('🔍 DailyNotesCarousel: All page IDs in response:', allPageIds.slice(0, 10), '... (showing first 10)');
      }

      if (result.error) {
        throw new Error(result.error || 'Failed to fetch pages')
      }

      const notesByDateMap = new Map<string, Array<{id: string, title: string}>>();

      console.log('🔍 DailyNotesCarousel: Processing', result.pages.length, 'pages for daily notes');

      // Debug: Show what we're getting from the API
      console.log('🔍 DailyNotesCarousel: API returned', result.pages.length, 'pages');
      console.log('🔍 DailyNotesCarousel: First 5 pages from API:',
        result.pages.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          createdDate: p.createdDate,
          createdAt: p.createdAt,
          customDate: p.customDate // Show both for comparison
        }))
      );

      // Check if any pages have createdDate
      const pagesWithCreatedDate = result.pages.filter(p => p.createdDate);
      const pagesWithCustomDate = result.pages.filter(p => p.customDate);
      console.log('🔍 DailyNotesCarousel: Pages with createdDate:', pagesWithCreatedDate.length);
      console.log('🔍 DailyNotesCarousel: Pages with customDate:', pagesWithCustomDate.length);

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

          console.log('🔍 DailyNotesCarousel: Added to map:', {
            date: dateString,
            id: page.id,
            title: noteTitle
          });
        }
      });

      console.log('🔍 DailyNotesCarousel: Summary:', {
        totalPages: result.pages.length,
        pagesWithCreatedDate: pagesWithCreatedDate.length,
        processedPagesCount,
        totalDailyNotes: notesByDateMap.size,
        dateKeys: Array.from(notesByDateMap.keys()).sort()
      });

      setNotesByDate(notesByDateMap);
    } catch (error) {
      console.error('Error checking existing notes:', error);

      // Handle specific Firebase quota exhaustion error
      if (error instanceof Error && (error.message.includes('Quota exceeded') || error.message.includes('RESOURCE_EXHAUSTED'))) {
        console.warn('Daily notes temporarily unavailable due to high usage');
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
        // Reduced logging: console.log('🔄 DailyNotesCarousel: Debounced refresh due to page update for user:', user.uid);
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
          // Reduced logging: console.log('🔄 DailyNotesCarousel: Debounced refresh due to global cache invalidation for user:', user.uid);
          debouncedRefresh();
        }
      });
    } catch (error) {
      console.warn('Global cache invalidation not available:', error);
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
      console.error('Error handling note click:', error);
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
        console.warn('📅 DailyNotesCarousel: Cannot create note for past/future dates in daily notes');
        return;
      }

      // Navigate to new page creation - no customDate needed since it will use current createdAt
      // The page will automatically be grouped under today's date in the daily notes carousel
      router.push('/new?type=daily-note');
    } catch (error) {
      console.error('📅 DailyNotesCarousel: Error handling add new click:', error);
      // Fallback to home page if navigation fails
      router.push('/');
    }
  }, [router]);



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

  // Scroll to focus date or today's card on initial mount with animation
  useEffect(() => {
    if (!loading && isInitialLoad) {
      // Delay to ensure DOM is fully rendered and carousel is ready
      const timer = setTimeout(() => {
        if (focusDate) {
          // Scroll to specific focus date if provided
          const focusDateObj = new Date(focusDate);
          const focusIndex = dates.findIndex(date =>
            date.toDateString() === focusDateObj.toDateString()
          );

          if (focusIndex !== -1) {
            // Use the same scrolling logic as animatedScrollToToday but for focus date
            const carousel = carouselRef.current;
            if (carousel) {
              const containerWidth = 200; // Approximate width of each container
              const containerPadding = 24; // px-6 = 24px
              const loadMoreButtonWidth = 120; // Approximate width of load more button
              const visibleWidth = carousel.clientWidth - (containerPadding * 2);
              const visibleCenter = visibleWidth / 2;
              const containerCenter = containerWidth / 2;

              const focusContainerStart = loadMoreButtonWidth + (focusIndex * containerWidth);
              const focusContainerCenter = focusContainerStart + containerCenter;
              const targetScrollPosition = Math.max(0, focusContainerCenter - visibleCenter);

              carousel.scrollTo({ left: 0, behavior: 'instant' });
              setTimeout(() => {
                carousel.scrollTo({ left: targetScrollPosition, behavior: 'smooth' });
              }, 100);
            }
          } else {
            // Focus date not found, fall back to today
            animatedScrollToToday();
          }
        } else {
          // No focus date, scroll to today
          animatedScrollToToday();
        }
        setIsInitialLoad(false); // Mark initial load as complete
      }, 200); // Slightly longer delay to ensure smooth animation

      return () => clearTimeout(timer);
    }
  }, [loading, isInitialLoad, animatedScrollToToday, focusDate, dates]);

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
      className={cn(
        "flex overflow-x-auto pb-2 px-6 pt-2 scrollbar-hide",
        isFullPage ? "gap-8" : "gap-4" // Larger gaps for full page
      )}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
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