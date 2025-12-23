'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '../../providers/AuthProvider';
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
  isFullPage?: boolean;
  focusDate?: string | null;
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
  className = '',
  isFullPage = false,
  focusDate = null
}) => {
  console.log('📅 TimelineCarousel: Component rendering');

  const { user } = useAuth();
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State for date range and notes
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 15));
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 15));
  const [notesByDate, setNotesByDate] = useState<Map<string, Note[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [maxNotesCount, setMaxNotesCount] = useState(0);

  // State for info card dismissal
  const [isInfoCardDismissed, setIsInfoCardDismissed] = useState(false);
  const [isInfoCardAnimating, setIsInfoCardAnimating] = useState(false);

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

    if (!user?.uid) {
      console.log('📅 TimelineCarousel: No current account UID, skipping load');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Use existing pages API
      const response = await fetch(`/api/pages?userId=${user?.uid}&limit=1000&orderBy=lastModified&orderDirection=desc`);
      
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
          } : null,
          // Show first few pages with their customDate status
          pagesWithCustomDate: pages.slice(0, 5).map(page => ({
            id: page.id,
            title: page.title,
            customDate: page.customDate,
            hasCustomDate: !!page.customDate
          }))
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
  }, [user?.uid]);

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
    if (!scrollContainerRef.current) {
      console.log('📅 TimelineCarousel: scrollContainerRef not available');
      return;
    }

    // Use the CURRENT date, not startOfDay which might use a cached date
    const now = new Date();
    const today = startOfDay(now);
    const todayString = format(today, 'yyyy-MM-dd');

    console.log('📅 TimelineCarousel: Scrolling to today:', {
      now: now.toISOString(),
      today: today.toISOString(),
      todayString,
      allCards: Array.from(scrollContainerRef.current.querySelectorAll('[data-date]')).map(el => el.getAttribute('data-date'))
    });

    const todayCard = scrollContainerRef.current.querySelector(`[data-date="${todayString}"]`);

    if (todayCard) {
      console.log('📅 TimelineCarousel: Found today card, scrolling to it');
      // Scroll the card into view with some padding
      const container = scrollContainerRef.current;
      const cardRect = todayCard.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate scroll position to center the card
      const scrollLeft = container.scrollLeft + cardRect.left - containerRect.left - (containerRect.width / 2) + (cardRect.width / 2);

      console.log('📅 TimelineCarousel: Scrolling details:', {
        scrollLeft,
        cardRectLeft: cardRect.left,
        containerRectLeft: containerRect.left,
        containerWidth: containerRect.width,
        cardWidth: cardRect.width
      });

      container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    } else {
      console.warn('📅 TimelineCarousel: Today card NOT FOUND! Available dates:',
        Array.from(scrollContainerRef.current.querySelectorAll('[data-date]')).map(el => el.getAttribute('data-date'))
      );
      // If today's card is not visible, scroll to approximate center
      const container = scrollContainerRef.current;
      const scrollPosition = container.scrollWidth / 2 - container.clientWidth / 2;
      container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  }, []);

  // Scroll to focus date or today on initial load
  useEffect(() => {
    if (!loading && scrollContainerRef.current) {
      const timer = setTimeout(() => {
        if (focusDate) {
          // Scroll to specific focus date if provided
          const focusCard = scrollContainerRef.current?.querySelector(`[data-date="${focusDate}"]`);
          if (focusCard) {
            const container = scrollContainerRef.current;
            const cardRect = focusCard.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const scrollLeft = container.scrollLeft + cardRect.left - containerRect.left - (container.clientWidth / 2) + (cardRect.width / 2);
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
          } else {
            // Focus date not found, fall back to today
            scrollToToday();
          }
        } else if (isFullPage) {
          // In full page mode without focus date, scroll to today
          scrollToToday();
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [loading, focusDate, isFullPage, scrollToToday]);

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

  // Handle info card dismissal with animation
  const handleDismissInfoCard = useCallback(() => {
    setIsInfoCardAnimating(true);
    // Wait for animation to complete before removing from DOM
    setTimeout(() => {
      setIsInfoCardDismissed(true);
      setIsInfoCardAnimating(false);
    }, 300); // Match the animation duration
  }, []);

  if (!user) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please sign in to view your timeline
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      {/* Loading state */}
      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          Loading timeline...
        </div>
      )}

      {/* Carousel */}
      <div className="relative overflow-hidden">
        {/* Load Earlier Button */}
        <button
          onClick={handleLoadEarlier}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background border border-border rounded-full p-2 shadow-lg hover:bg-accent transition-colors"
          aria-label="Load earlier dates"
        >
          <Icon name="ChevronLeft" size={16} />
        </button>

        {/* Scrollable container */}
        <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-hidden scrollbar-hide px-12">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {dateRange.map(date => {
              const dateString = format(date, 'yyyy-MM-dd');
              const notesForDate = notesByDate.get(dateString) || [];
              const isToday = format(date, 'yyyy-MM-dd') === format(startOfDay(new Date()), 'yyyy-MM-dd');

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
                    isFullPage={isFullPage}
                    timelineType="timeline"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Load Later Button */}
        <button
          onClick={handleLoadLater}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background border border-border rounded-full p-2 shadow-lg hover:bg-accent transition-colors"
          aria-label="Load later dates"
        >
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>

      {/* Info card for empty state */}
      {!loading && notesByDate.size === 0 && !isInfoCardDismissed && (
        <div
          className={`
            transition-all duration-300 ease-in-out overflow-hidden
            ${isInfoCardAnimating ? 'opacity-0 max-h-0 py-0' : 'opacity-100 max-h-96 py-4'}
          `}
        >
          <div className="bg-muted/50 border border-border rounded-lg p-4 mx-auto max-w-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Icon name="Info" size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium mb-1">
                  Timeline shows pages with custom dates
                </p>
                <p className="text-xs text-muted-foreground">
                  Create a new page and assign it a custom date to see it appear in your timeline
                </p>
              </div>
              <button
                onClick={handleDismissInfoCard}
                className="flex-shrink-0 p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                aria-label="Dismiss"
              >
                <Icon name="X" size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineCarousel;
