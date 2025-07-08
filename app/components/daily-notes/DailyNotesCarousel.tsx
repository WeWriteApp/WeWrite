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
    if (!currentAccount?.uid) return;

    try {
      // Removed excessive cache invalidation that was causing infinite loops

      // Calculate date range for the carousel
      const startDate = dateRange[0]?.toISOString().split('T')[0];
      const endDate = dateRange[dateRange.length - 1]?.toISOString().split('T')[0];

      // Reduced logging to prevent terminal spam
      // console.log(`Daily notes: querying date range ${startDate} to ${endDate} (${dateRange.length} days)`);

      // Call efficient daily notes API that only returns pages with custom dates
      const response = await fetch(`/api/daily-notes?userId=${currentAccount?.uid}&startDate=${startDate}&endDate=${endDate}`)

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

      // Debug: Check for the specific page that's not showing up
      const targetPage = result.pages.find(p => p.id === 'Kkflv9WNbGxg09JPLVU6');
      if (targetPage) {
        console.log('🔍 DailyNotesCarousel: Found specific page Kkflv9WNbGxg09JPLVU6:', {
          id: targetPage.id,
          title: targetPage.title,
          customDate: targetPage.customDate,
          hasCustomDate: !!targetPage.customDate,
          deleted: targetPage.deleted,
          userId: targetPage.userId
        });
      } else {
        console.log('🔍 DailyNotesCarousel: Specific page Kkflv9WNbGxg09JPLVU6 NOT FOUND in API response');
      }

      // Debug: Show what we're getting from the API
      const pagesWithCustomDateDebug = result.pages.filter(p => p.customDate);
      console.log('🔍 DailyNotesCarousel: Pages with customDate from API:', pagesWithCustomDateDebug.length);
      pagesWithCustomDateDebug.forEach(page => {
        console.log(`  - ${page.id}: "${page.title}" (customDate: ${page.customDate})`);
      });

      // Debug: Show first few pages to see what we're getting
      console.log('🔍 DailyNotesCarousel: First 5 pages from API:',
        result.pages.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          customDate: p.customDate,
          lastModified: p.lastModified
        }))
      );

      let pagesWithCustomDate = 0;
      let pagesWithDateTitle = 0;

      // Filter pages to find ALL pages with custom dates
      result.pages.forEach((page: any) => {
        let dateString: string | null = null;
        let noteTitle = page.title || 'Untitled'; // Use the actual page title

        // Check for pages with customDate field
        if (page.customDate) {
          dateString = page.customDate;
          pagesWithCustomDate++;
        }
        // Check legacy format (title as YYYY-MM-DD, only if no customDate)
        else if (page.title && isExactDateFormat(page.title)) {
          dateString = page.title;
          pagesWithDateTitle++;
          // For legacy pages, keep the date as title since they haven't been migrated yet
          console.log('🔍 DailyNotesCarousel: Found legacy page with date title:', {
            id: page.id,
            title: page.title
          });
        }

        // If we found a date, add it to the map with the actual page title
        if (dateString) {
          if (!notesByDateMap.has(dateString)) {
            notesByDateMap.set(dateString, []);
          }
          notesByDateMap.get(dateString)!.push({ id: page.id, title: noteTitle });

          // Special logging for the specific page
          if (page.id === 'Kkflv9WNbGxg09JPLVU6') {
            console.log('🔍 DailyNotesCarousel: SPECIFIC PAGE ADDED TO MAP:', {
              date: dateString,
              id: page.id,
              title: noteTitle,
              mapSize: notesByDateMap.get(dateString)!.length
            });
          }

          console.log('🔍 DailyNotesCarousel: Added to map:', {
            date: dateString,
            id: page.id,
            title: noteTitle
          });
        }
      });

      // Show title variations for debugging
      const allPagesWithCustomDate = result.pages.filter((page: any) => page.customDate);
      const titleVariations = {};
      allPagesWithCustomDate.forEach(page => {
        const title = page.title || 'NO_TITLE';
        titleVariations[title] = (titleVariations[title] || 0) + 1;
      });

      console.log('🔍 DailyNotesCarousel: Title variations for pages with custom dates:', titleVariations);

      // Check specifically for yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toISOString().split('T')[0];

      // Reduced debug logging to prevent terminal spam
      // console.log('🔍 DailyNotesCarousel: Checking for yesterday:', yesterdayString);
      const yesterdayPages = result.pages.filter(page => page.customDate === yesterdayString);

      // Simplified logging - only log if there are issues
      if (yesterdayPages.length === 0) {
        // Only log when debugging is needed
        // console.log('🔍 DailyNotesCarousel: NO pages found for yesterday');
      }

      console.log('🔍 DailyNotesCarousel: Summary:', {
        totalPages: result.pages.length,
        pagesWithCustomDate,
        pagesWithDateTitle,
        totalDailyNotes: notesByDateMap.size,
        dateKeys: Array.from(notesByDateMap.keys()).sort(),
        yesterdayString,
        yesterdayPagesFound: yesterdayPages.length
      });

      // Debug: Check if specific page is in the final map
      const specificPageInMap = Array.from(notesByDateMap.entries()).find(([date, notes]) =>
        notes.some(note => note.id === 'Kkflv9WNbGxg09JPLVU6')
      );

      if (specificPageInMap) {
        console.log('🔍 DailyNotesCarousel: SPECIFIC PAGE IS IN FINAL MAP:', {
          date: specificPageInMap[0],
          notes: specificPageInMap[1]
        });
      } else {
        console.log('🔍 DailyNotesCarousel: SPECIFIC PAGE NOT IN FINAL MAP');
      }

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
  }, [currentAccount?.uid, daysBefore, daysAfter]); // Removed dates and checkExistingNotes to prevent infinite loop

  // Listen for page updates to refresh daily notes data
  useEffect(() => {
    if (!currentAccount?.uid) return;

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
      if (!eventUserId || eventUserId === currentAccount.uid) {
        // Reduced logging: console.log('🔄 DailyNotesCarousel: Debounced refresh due to page update for user:', currentAccount.uid);
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
        if (!data?.userId || data.userId === currentAccount.uid) {
          // Reduced logging: console.log('🔄 DailyNotesCarousel: Debounced refresh due to global cache invalidation for user:', currentAccount.uid);
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
  }, [currentAccount?.uid]); // Removed dates and checkExistingNotes to prevent infinite re-registration

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
      // Pass the date as a separate parameter so user can choose their own title
      router.push(`/new?customDate=${encodeURIComponent(dateString)}&type=daily-note`);
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

        // Reduced debug logging to prevent terminal spam
        // if (notesForDate.length > 0) {
        //   console.log('🔍 DailyNotesCarousel: Rendering date with notes:', {
        //     date: dateString,
        //     notesCount: notesForDate.length,
        //     notes: notesForDate.map(note => ({ id: note.id, title: note.title }))
        //   });
        // }

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