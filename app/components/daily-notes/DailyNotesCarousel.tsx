"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DayCard from './DayCard';
import { useAuth } from '../../providers/AuthProvider';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
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
 * Horizontal scrolling carousel showing calendar days with infinite loading.
 * Features:
 * - Symmetric date range (equal days before and after today)
 * - Infinite loading with "Load 15 More" buttons at both ends
 * - Today positioned in the center of the initial range
 * - Checks for existing notes with exact YYYY-MM-DD format titles only
 * - Maintains scroll position when loading new dates
 */
export default function DailyNotesCarousel({ accentColor = '#1768FF' }: DailyNotesCarouselProps) {
  const { user } = useAuth();
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);
  const { formatDateString } = useDateFormat();

  // State for dynamic date range
  const [daysBefore, setDaysBefore] = useState(15); // Days before today
  const [daysAfter, setDaysAfter] = useState(15);   // Days after today

  // State for existing notes
  const [existingNotes, setExistingNotes] = useState<Set<string>>(new Set());
  const [notePageIds, setNotePageIds] = useState<Map<string, string>>(new Map());
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

    // After state update, restore scroll position accounting for new cards
    requestAnimationFrame(() => {
      if (carousel) {
        const cardWidth = 88; // 80px width + 8px gap
        const newScrollPosition = currentScrollLeft + (15 * cardWidth);
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
      // Generate all possible YYYY-MM-DD titles for the date range
      const dateStrings = dateRange.map(date => format(date, 'yyyy-MM-dd'));

      // Query for pages with these exact titles by the current user
      const pagesRef = collection(db, 'pages');
      const foundNotes = new Set<string>();
      const pageIdMap = new Map<string, string>();

      // Split dates into chunks of 10 for Firestore 'in' query limit
      const chunks: string[][] = [];
      for (let i = 0; i < dateStrings.length; i += 10) {
        chunks.push(dateStrings.slice(i, i + 10));
      }

      // Query each chunk - use simple query without deleted filter to avoid index issues
      for (const chunk of chunks) {
        const chunkQuery = query(
          pagesRef,
          where('userId', '==', user?.uid || ''),
          where('title', 'in', chunk)
        );

        const chunkSnapshot = await getDocs(chunkQuery);

        chunkSnapshot.forEach((doc) => {
          const pageData = doc.data();

          // Client-side filtering: only include pages with exact YYYY-MM-DD format titles and not deleted
          if (pageData.title &&
              dateStrings.includes(pageData.title) &&
              isExactDateFormat(pageData.title) &&
              !pageData.deleted) {
            foundNotes.add(pageData.title);
            pageIdMap.set(pageData.title, doc.id);
          }
        });
      }

      setExistingNotes(foundNotes);
      setNotePageIds(pageIdMap);
    } catch (error) {
      console.error('Error checking existing notes:', error);
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
  }, [user?.uid, daysBefore, daysAfter, dates, checkExistingNotes]);

  // Handle day card click with enhanced error handling
  const handleDayClick = (date: Date) => {
    try {
      const dateString = format(date, 'yyyy-MM-dd');
      const hasNote = existingNotes.has(dateString);

      if (hasNote) {
        // Navigate to existing note using the page ID
        const pageId = notePageIds.get(dateString);
        if (pageId) {
          router.push(`/pages/${pageId}`);
        } else {
          // Fallback to search if page ID not found
          router.push(`/search?q=${encodeURIComponent(dateString)}`);
        }
      } else {
        // Navigate to page creation with pre-filled title and daily note flag
        router.push(`/new?title=${encodeURIComponent(dateString)}&type=daily-note`);
      }
    } catch (error) {
      console.error('Error handling day click:', error);
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
        const cardWidth = 88; // 80px width + 8px gap
        const loadMoreButtonWidth = 88; // Same as card width

        // Calculate the exact center position accounting for the "Load More Past" button and container padding
        // The target position should center today's card in the visible area
        const containerPadding = 24; // px-6 = 24px on each side
        const visibleWidth = carousel.clientWidth - (containerPadding * 2);
        const visibleCenter = visibleWidth / 2;
        const cardCenter = cardWidth / 2;

        // Position of today's card relative to the start of content (after load button)
        const todayCardStart = loadMoreButtonWidth + (todayIndex * cardWidth);
        const todayCardCenter = todayCardStart + cardCenter;

        // Calculate scroll position to center today's card in the visible area
        const targetScrollPosition = Math.max(0, todayCardCenter - visibleCenter);

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

  // Regular scroll to today's card (used by "Today" button)
  const scrollToToday = useCallback(() => {
    const today = new Date();
    const todayIndex = dates.findIndex(date =>
      date.toDateString() === today.toDateString()
    );

    if (todayIndex !== -1) {
      const carousel = carouselRef.current;
      if (carousel) {
        const cardWidth = 88; // 80px width + 8px gap
        const loadMoreButtonWidth = 88; // Same as card width

        // Calculate the exact center position accounting for the "Load More Past" button and container padding
        const containerPadding = 24; // px-6 = 24px on each side
        const visibleWidth = carousel.clientWidth - (containerPadding * 2);
        const visibleCenter = visibleWidth / 2;
        const cardCenter = cardWidth / 2;

        // Position of today's card relative to the start of content (after load button)
        const todayCardStart = loadMoreButtonWidth + (todayIndex * cardWidth);
        const todayCardCenter = todayCardStart + cardCenter;

        // Calculate scroll position to center today's card in the visible area
        const scrollPosition = Math.max(0, todayCardCenter - visibleCenter);
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
      <div className="flex gap-2 overflow-x-auto pb-2 px-6 pt-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-[80px] h-[90px] bg-muted/50 rounded-2xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={carouselRef}
      id="daily-notes-carousel"
      className="flex gap-2 overflow-x-auto pb-2 px-6 pt-2 scrollbar-hide"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Load More Past Button */}
      <div className="flex-shrink-0 flex items-center justify-center min-w-[80px] h-[90px]">
        <Button
          variant="outline"
          size="sm"
          onClick={loadMorePast}
          disabled={loadingPast}
          className="h-[90px] w-[80px] rounded-2xl flex flex-col items-center justify-center gap-1 text-xs border-dashed"
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

      {/* Date Cards */}
      {dates.map((date, index) => {
        const dateString = format(date, 'yyyy-MM-dd');
        const hasNote = existingNotes.has(dateString);
        const isToday = new Date().toDateString() === date.toDateString();

        return (
          <div key={dateString} className="flex-shrink-0 flex flex-col items-center">
            <DayCard
              date={date}
              hasNote={hasNote}
              onClick={() => handleDayClick(date)}
              accentColor={accentColor}
            />
            {/* Today chip positioned below today's card */}
            {isToday && (
              <div
                className="mt-2 px-2 py-1 bg-primary text-xs font-medium rounded-full"
                style={{ color: '#ffffff' }}
              >
                Today
              </div>
            )}
          </div>
        );
      })}

      {/* Load More Future Button */}
      <div className="flex-shrink-0 flex items-center justify-center min-w-[80px] h-[90px]">
        <Button
          variant="outline"
          size="sm"
          onClick={loadMoreFuture}
          disabled={loadingFuture}
          className="h-[90px] w-[80px] rounded-2xl flex flex-col items-center justify-center gap-1 text-xs border-dashed"
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
