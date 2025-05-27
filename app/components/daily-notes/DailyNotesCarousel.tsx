"use client";

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import DayCard from './DayCard';
import { AuthContext } from '../../providers/AuthProvider';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { format, subDays, addDays } from 'date-fns';

interface DailyNotesCarouselProps {
  accentColor?: string;
}

/**
 * DailyNotesCarousel Component
 *
 * Horizontal scrolling carousel showing calendar days.
 * Displays past 30 days + next 7 days for a total of 37 days.
 * Checks for existing notes with YYYY-MM-DD format titles.
 */
export default function DailyNotesCarousel({ accentColor = '#1768FF' }: DailyNotesCarouselProps) {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [existingNotes, setExistingNotes] = useState<Set<string>>(new Set());
  const [notePageIds, setNotePageIds] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Generate array of dates (30 days ago to 7 days in future)
  const generateDates = () => {
    const dates: Date[] = [];
    const today = new Date();

    // Add past 30 days
    for (let i = 30; i >= 0; i--) {
      dates.push(subDays(today, i));
    }

    // Add next 7 days
    for (let i = 1; i <= 7; i++) {
      dates.push(addDays(today, i));
    }

    return dates;
  };

  const dates = generateDates();

  // Check for existing notes with YYYY-MM-DD format
  useEffect(() => {
    const checkExistingNotes = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Generate all possible YYYY-MM-DD titles for the date range
        const dateStrings = dates.map(date => format(date, 'yyyy-MM-dd'));

        // Query for pages with these exact titles by the current user
        const pagesRef = collection(db, 'pages');
        const q = query(
          pagesRef,
          where('userId', '==', user.uid),
          where('title', 'in', dateStrings.slice(0, 10)) // Firestore 'in' limit is 10
        );

        const querySnapshot = await getDocs(q);
        const foundNotes = new Set<string>();
        const pageIdMap = new Map<string, string>();

        querySnapshot.forEach((doc) => {
          const pageData = doc.data();
          if (pageData.title && dateStrings.includes(pageData.title)) {
            foundNotes.add(pageData.title);
            pageIdMap.set(pageData.title, doc.id);
          }
        });

        // If we have more than 10 dates, we need additional queries
        if (dateStrings.length > 10) {
          const remainingDates = dateStrings.slice(10);
          const chunks = [];

          // Split remaining dates into chunks of 10
          for (let i = 0; i < remainingDates.length; i += 10) {
            chunks.push(remainingDates.slice(i, i + 10));
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
              if (pageData.title && dateStrings.includes(pageData.title)) {
                foundNotes.add(pageData.title);
                pageIdMap.set(pageData.title, doc.id);
              }
            });
          }
        }

        setExistingNotes(foundNotes);
        setNotePageIds(pageIdMap);
      } catch (error) {
        console.error('Error checking existing notes:', error);
      } finally {
        setLoading(false);
      }
    };

    checkExistingNotes();
  }, [user?.uid, dates.length]);

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

  // Scroll to today's card on mount
  useEffect(() => {
    const scrollToToday = () => {
      const today = new Date();
      const todayIndex = dates.findIndex(date =>
        date.toDateString() === today.toDateString()
      );

      if (todayIndex !== -1) {
        const carousel = document.getElementById('daily-notes-carousel');
        if (carousel) {
          const cardWidth = 88; // 80px width + 8px gap
          const scrollPosition = Math.max(0, (todayIndex * cardWidth) - (carousel.clientWidth / 2) + (cardWidth / 2));
          carousel.scrollTo({ left: scrollPosition, behavior: 'smooth' });
        }
      }
    };

    // Delay scroll to ensure DOM is ready
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [dates]);

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 px-6">
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
      id="daily-notes-carousel"
      className="flex gap-2 overflow-x-auto pb-2 px-6 scrollbar-hide"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
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
    </div>
  );
}
