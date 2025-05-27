"use client";

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DayCard from './DayCard';
import { AuthContext } from '../../providers/AuthProvider';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { format, subDays, addDays } from 'date-fns';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);

  // State for dynamic date range
  const [daysBefore, setDaysBefore] = useState(15); // Days before today
  const [daysAfter, setDaysAfter] = useState(15);   // Days after today

  // State for existing notes
  const [existingNotes, setExistingNotes] = useState<Set<string>>(new Set());
  const [notePageIds, setNotePageIds] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);

  // Generate symmetric array of dates
  const generateDates = useCallback(() => {
    const dates: Date[] = [];
    const today = new Date();

    // Add past days (in chronological order)
    for (let i = daysBefore; i >= 1; i--) {
      dates.push(subDays(today, i));
    }

    // Add today
    dates.push(today);

    // Add future days
    for (let i = 1; i <= daysAfter; i++) {
      dates.push(addDays(today, i));
    }

    return dates;
  }, [daysBefore, daysAfter]);

  const dates = generateDates();

  // Load more dates in the past
  const loadMorePast = useCallback(async () => {
    if (loadingPast) return;

    setLoadingPast(true);

    // Store current scroll position relative to the current first date card
    const carousel = carouselRef.current;
    const currentScrollLeft = carousel?.scrollLeft || 0;

    // Expand the range by 15 days in the past
    setDaysBefore(prev => prev + 15);

    // After state update, restore scroll position accounting for new cards
    setTimeout(() => {
      if (carousel) {
        const cardWidth = 88; // 80px width + 8px gap
        const newScrollPosition = currentScrollLeft + (15 * cardWidth);
        carousel.scrollTo({ left: newScrollPosition, behavior: 'instant' });
      }
      setLoadingPast(false);
    }, 100);
  }, [loadingPast]);

  // Load more dates in the future
  const loadMoreFuture = useCallback(async () => {
    if (loadingFuture) return;

    setLoadingFuture(true);

    // Expand the range by 15 days in the future
    setDaysAfter(prev => prev + 15);

    // No need to adjust scroll position for future dates
    setTimeout(() => {
      setLoadingFuture(false);
    }, 100);
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
      const chunks = [];
      for (let i = 0; i < dateStrings.length; i += 10) {
        chunks.push(dateStrings.slice(i, i + 10));
      }

      // Query each chunk
      for (const chunk of chunks) {
        const chunkQuery = query(
          pagesRef,
          where('userId', '==', user.uid),
          where('title', 'in', chunk)
        );

        const chunkSnapshot = await getDocs(chunkQuery);
        chunkSnapshot.forEach((doc) => {
          const pageData = doc.data();
          // Only include pages with exact YYYY-MM-DD format titles
          if (pageData.title &&
              dateStrings.includes(pageData.title) &&
              isExactDateFormat(pageData.title)) {
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
  }, [user?.uid, dates.length, checkExistingNotes, dates]);

  // Handle day card click
  const handleDayClick = (date: Date) => {
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
      // Navigate to page creation with pre-filled title
      router.push(`/new?title=${encodeURIComponent(dateString)}`);
    }
  };

  // Scroll to today's card (used both on mount and by external "Today" button)
  const scrollToToday = useCallback(() => {
    const today = new Date();
    const todayIndex = dates.findIndex(date =>
      date.toDateString() === today.toDateString()
    );

    if (todayIndex !== -1) {
      const carousel = carouselRef.current;
      if (carousel) {
        const cardWidth = 88; // 80px width + 8px gap
        const scrollPosition = Math.max(0, (todayIndex * cardWidth) - (carousel.clientWidth / 2) + (cardWidth / 2));
        carousel.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      }
    }
  }, [dates]);

  // Scroll to today's card on initial mount
  useEffect(() => {
    if (!loading) {
      // Delay scroll to ensure DOM is ready
      const timer = setTimeout(scrollToToday, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, scrollToToday]);

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

        return (
          <DayCard
            key={dateString}
            date={date}
            hasNote={hasNote}
            onClick={() => handleDayClick(date)}
            accentColor={accentColor}
          />
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
