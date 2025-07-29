"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';

interface TimelinePage {
  id: string;
  title: string;
  customDate: string;
  lastModified?: string;
  createdAt?: string;
}

interface TimelineCalendarProps {
  accentColor?: string;
  onPageSelect?: (pageId: string) => void;
}

/**
 * TimelineCalendar Component
 * 
 * Calendar view for timeline pages showing:
 * - Monthly calendar grid
 * - Number of pages per day (based on customDate field)
 * - Click to navigate to page or show modal for multiple pages
 * - Navigation between months
 */
export default function TimelineCalendar({ accentColor = '#1768FF', onPageSelect }: TimelineCalendarProps) {
  const { user } = useAuth();
  const router = useRouter();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [pagesByDate, setPagesByDate] = useState<Map<string, TimelinePage[]>>(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch timeline pages for the current month
  const fetchPagesForMonth = useCallback(async (date: Date) => {
    if (!user?.uid) {
      console.log('📅 TimelineCalendar: No current account, skipping fetch');
      return;
    }

    try {
      setLoading(true);

      const startDate = startOfMonth(date);
      const endDate = endOfMonth(date);

      console.log('📅 TimelineCalendar: Fetching timeline pages for month:', {
        month: format(date, 'yyyy-MM'),
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        userId: user.uid
      });

      // Use the timeline API endpoint
      const apiUrl = '/api/timeline?' + new URLSearchParams({
        userId: user.uid,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      });

      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch timeline pages: ${response.status}`);
      }

      const result = await response.json();
      console.log('📅 TimelineCalendar: API response:', result);

      const pages = result.pages || [];
      
      // Group pages by their customDate
      const pagesByDateMap = new Map<string, TimelinePage[]>();
      
      pages.forEach((page: TimelinePage) => {
        if (page.customDate) {
          const dateKey = page.customDate;
          if (!pagesByDateMap.has(dateKey)) {
            pagesByDateMap.set(dateKey, []);
          }
          pagesByDateMap.get(dateKey)!.push(page);
        }
      });

      console.log('📅 TimelineCalendar: Processed pages by date:', {
        totalPages: pages.length,
        datesWithPages: pagesByDateMap.size,
        dateKeys: Array.from(pagesByDateMap.keys()).sort()
      });

      setPagesByDate(pagesByDateMap);

    } catch (error) {
      console.error('Error fetching timeline pages for calendar:', error);
      setPagesByDate(new Map());
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Fetch pages when month changes
  useEffect(() => {
    fetchPagesForMonth(currentDate);
  }, [currentDate, fetchPagesForMonth]);

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Handle day click - navigate to page or show selection if multiple
  const handleDayClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const pagesForDay = pagesByDate.get(dateKey) || [];
    
    if (pagesForDay.length === 0) {
      // No pages for this day - could optionally create a new page with this custom date
      return;
    } else if (pagesForDay.length === 1) {
      // Single page - navigate directly
      router.push(`/${pagesForDay[0].id}`);
    } else {
      // Multiple pages - for now, navigate to the first one
      // TODO: Could show a modal to select which page to view
      router.push(`/${pagesForDay[0].id}`);
    }
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the first day of the week for the month (to add padding)
  const firstDayOfWeek = monthStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const paddingDays = Array.from({ length: firstDayOfWeek }, (_, i) => null);

  // Calculate total pages for the month
  const totalPagesInMonth = Array.from(pagesByDate.values()).reduce((total, pages) => total + pages.length, 0);
  const daysWithPages = pagesByDate.size;

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousMonth}
          disabled={loading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </h3>

          {/* Month summary */}
          {totalPagesInMonth > 0 && (
            <div className="text-sm text-muted-foreground">
              {totalPagesInMonth} page{totalPagesInMonth !== 1 ? 's' : ''} on {daysWithPages} day{daysWithPages !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={goToNextMonth}
          disabled={loading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        
        {/* Padding days */}
        {paddingDays.map((_, index) => (
          <div key={`padding-${index}`} className="p-2 h-16"></div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const pagesForDay = pagesByDate.get(dateKey) || [];
          const hasPages = pagesForDay.length > 0;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);
          
          return (
            <button
              key={dateKey}
              onClick={() => handleDayClick(day)}
              className={`
                p-2 h-16 border rounded-lg transition-all duration-200 relative
                ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
                ${isTodayDate ? 'ring-2 ring-primary border-primary' : 'border-border'}
                ${hasPages
                  ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer hover:border-accent-foreground/20'
                  : 'cursor-default hover:bg-muted/50'
                }
                ${!isCurrentMonth ? 'opacity-50' : ''}
                ${hasPages ? 'bg-accent/5' : ''}
                flex flex-col items-center justify-center
              `}
            >
              <span className={`text-sm font-medium ${hasPages ? 'font-semibold' : ''}`}>
                {format(day, 'd')}
              </span>
              {hasPages && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full text-white mt-1 font-medium shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {pagesForDay.length}
                </span>
              )}
              {/* Subtle indicator for days with pages */}
              {hasPages && (
                <div
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: accentColor, opacity: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="text-center text-muted-foreground py-4">
          Loading timeline pages...
        </div>
      )}

      {/* Empty state */}
      {!loading && totalPagesInMonth === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <p>No timeline pages found for {format(currentDate, 'MMMM yyyy')}</p>
          <p className="text-sm mt-2">Pages with custom dates will appear here</p>
        </div>
      )}
    </div>
  );
}
