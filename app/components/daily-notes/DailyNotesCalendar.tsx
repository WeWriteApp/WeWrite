"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useDateFormat } from '../../contexts/DateFormatContext';

interface Note {
  id: string;
  title: string;
  createdAt: string;
  lastModified: string;
  username?: string;
  isPublic?: boolean;
}

interface DailyNotesCalendarProps {
  accentColor?: string;
  onPageSelect?: (pageId: string) => void;
}

/**
 * DailyNotesCalendar Component
 * 
 * Calendar view for daily notes showing:
 * - Monthly calendar grid
 * - Number of notes per day
 * - Click to navigate to single page or show modal for multiple pages
 * - Navigation between months
 */
export default function DailyNotesCalendar({ accentColor = '#1768FF', onPageSelect }: DailyNotesCalendarProps) {
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const { formatDateString } = useDateFormat();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notesByDate, setNotesByDate] = useState<Map<string, Note[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch notes for the current month
  const fetchNotesForMonth = useCallback(async (date: Date) => {
    if (!currentAccount?.uid) {
      console.log('📅 DailyNotesCalendar: No current account, skipping fetch');
      return;
    }

    try {
      setLoading(true);

      const startDate = startOfMonth(date);
      const endDate = endOfMonth(date);

      console.log('📅 DailyNotesCalendar: Fetching notes for month:', {
        month: format(date, 'yyyy-MM'),
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        userId: currentAccount.uid
      });

      // Use the same API endpoint as the carousel
      const apiUrl = '/api/daily-notes?' + new URLSearchParams({
        userId: currentAccount.uid,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      });

      console.log('📅 DailyNotesCalendar: API URL:', apiUrl);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📅 DailyNotesCalendar: API error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📅 DailyNotesCalendar: API returned data:', data);

      // The daily-notes API returns { notesByDate: { "2025-07-16": [pages...] } }
      const notesByDateMap = new Map<string, Note[]>();

      if (data && data.notesByDate) {
        Object.entries(data.notesByDate).forEach(([dateKey, pages]: [string, any[]]) => {
          const notesForDate = pages.map((page: any) => ({
            id: page.id,
            title: page.title || 'Untitled',
            createdAt: page.createdAt,
            lastModified: page.lastModified,
            username: page.username,
            isPublic: page.isPublic
          }));

          notesByDateMap.set(dateKey, notesForDate);
        });
      }

      setNotesByDate(notesByDateMap);
      console.log('📅 DailyNotesCalendar: Grouped notes by date:', notesByDateMap.size, 'days with notes');

    } catch (error) {
      console.error('Error fetching notes for calendar:', error);
      setNotesByDate(new Map());
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.uid]);

  // Fetch notes when month changes
  useEffect(() => {
    fetchNotesForMonth(currentDate);
  }, [currentDate, fetchNotesForMonth]);

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Handle day click - navigate to timeline view for that date
  const handleDayClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    router.push(`/timeline?type=daily-notes&date=${dateKey}`);
  };

  // Handle page selection from modal
  const handlePageSelectFromModal = (pageId: string) => {
    setShowModal(false);
    setSelectedDate(null);
    if (onPageSelect) {
      onPageSelect(pageId);
    } else {
      window.location.href = `/${pageId}`;
    }
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the first day of the week for the month (to add padding)
  const firstDayOfWeek = monthStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const paddingDays = Array.from({ length: firstDayOfWeek }, (_, i) => null);

  const selectedDateNotes = selectedDate ? notesByDate.get(format(selectedDate, 'yyyy-MM-dd')) || [] : [];

  // Calculate total notes for the month
  const totalNotesInMonth = Array.from(notesByDate.values()).reduce((total, notes) => total + notes.length, 0);
  const daysWithNotes = notesByDate.size;

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

          {/* Debug refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNotesForMonth(currentDate)}
            disabled={loading}
            className="text-xs opacity-60 hover:opacity-100"
          >
            🔄 Refresh
          </Button>
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
          const notesForDay = notesByDate.get(dateKey) || [];
          const hasNotes = notesForDay.length > 0;
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
                ${hasNotes
                  ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer hover:border-accent-foreground/20'
                  : 'cursor-default hover:bg-muted/50'
                }
                ${!isCurrentMonth ? 'opacity-50' : ''}
                ${hasNotes ? 'bg-accent/5' : ''}
                flex flex-col items-center justify-center
              `}
            >
              <span className={`text-sm font-medium ${hasNotes ? 'font-semibold' : ''}`}>
                {format(day, 'd')}
              </span>
              {hasNotes && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full text-white mt-1 font-medium shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {notesForDay.length}
                </span>
              )}
              {/* Subtle indicator for days with notes */}
              {hasNotes && (
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
        <div className="text-center py-8 text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Loading calendar...</span>
          </div>
        </div>
      )}



      {/* Summary when notes exist */}
      {!loading && totalNotesInMonth > 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground border-t border-border">
          <span>
            {totalNotesInMonth} note{totalNotesInMonth !== 1 ? 's' : ''} across {daysWithNotes} day{daysWithNotes !== 1 ? 's' : ''} this month
          </span>
        </div>
      )}

      {/* Modal for multiple pages */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Pages from {formatDateString(format(selectedDate, 'yyyy-MM-dd'))}
            </h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedDateNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => handlePageSelectFromModal(note.id)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <div className="font-medium">{note.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(note.createdAt), 'h:mm a')}
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setSelectedDate(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
