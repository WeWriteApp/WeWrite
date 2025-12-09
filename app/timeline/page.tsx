"use client";

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, List } from 'lucide-react';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger, SegmentedControlContent } from '../components/ui/segmented-control';
import { Button } from '../components/ui/button';
import NavPageLayout from '../components/layout/NavPageLayout';
import { useAuth } from '../providers/AuthProvider';
import { useAccentColor } from '../contexts/AccentColorContext';
import DailyNotesCarousel from '../components/daily-notes/DailyNotesCarousel';
import DailyNotesCalendar from '../components/daily-notes/DailyNotesCalendar';
import TimelineCarousel from '../components/timeline/TimelineCarousel';

/**
 * Timeline Content Component (uses useSearchParams)
 */
function TimelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { accentColor } = useAccentColor();
  
  const type = searchParams.get('type') || 'daily-notes';
  const focusDate = searchParams.get('date');
  
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Get accent color value
  const getAccentColorValue = () => {
    if (accentColor === 'custom') {
      return '#1768FF'; // Default fallback
    }
    return accentColor;
  };

  // Scroll to specific date if provided (prioritize over today)
  useEffect(() => {
    if (focusDate && typeof document !== 'undefined') {
      // Wait for component to mount and then scroll
      const timer = setTimeout(() => {
        // Try to find the date card and scroll to it
        const dateElement = document.querySelector(`[data-date="${focusDate}"]`);
        if (dateElement) {
          dateElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [focusDate]);

  // Handle view mode changes and update URL
  const handleViewModeChange = (newMode: 'timeline' | 'calendar') => {
    setViewMode(newMode);
    const params = new URLSearchParams();
    params.set('type', type);
    if (newMode === 'calendar') {
      params.set('view', 'calendar');
    }
    if (focusDate) {
      params.set('date', focusDate);
    }
    router.replace(`/timeline?${params.toString()}`);
  };

  // Initialize view mode from URL
  useEffect(() => {
    const urlViewMode = searchParams.get('view');
    if (urlViewMode === 'calendar') {
      setViewMode('calendar');
    }
  }, [searchParams]);

  const handleBack = () => {
    router.back();
  };

  // Function to scroll to today's card
  const scrollToToday = () => {
    console.log('📅 Timeline Page: scrollToToday called, type:', type);

    // Guard against server-side rendering
    if (typeof window === 'undefined') return;

    // Use the appropriate scroll function based on current type
    if (type === 'daily-notes' && (window as any).dailyNotesScrollToToday) {
      console.log('📅 Timeline Page: Using dailyNotesScrollToToday');
      (window as any).dailyNotesScrollToToday();
    } else if ((window as any).timelineScrollToToday) {
      console.log('📅 Timeline Page: Using timelineScrollToToday');
      (window as any).timelineScrollToToday();
    } else if (typeof document !== 'undefined') {
      // Fallback: try to find today's card manually
      console.log('📅 Timeline Page: Using fallback querySelector');
      const today = new Date().toISOString().split('T')[0];
      const todayElement = document.querySelector(`[data-date="${today}"]`);
      if (todayElement) {
        todayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Also try scrolling to the carousel center
        const carousel = document.querySelector('#daily-notes-carousel');
        if (carousel) {
          const scrollPosition = carousel.scrollWidth / 2 - carousel.clientWidth / 2;
          carousel.scrollTo({ left: scrollPosition, behavior: 'smooth' });
        }
      }
    }
  };

  const getTitle = () => {
    if (type === 'daily-notes') {
      return 'My Daily Notes';
    }
    return 'Timeline';
  };

  const getDescription = () => {
    if (type === 'daily-notes') {
      return 'Pages organized by creation date';
    }
    return 'Pages organized by custom date';
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <NavPageLayout
      maxWidth="full"
    >
        {/* Page header with actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Timeline</h1>
            <p className="text-muted-foreground">{getDescription()}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToToday}
            className="rounded-2xl"
            aria-label="Scroll to today"
          >
            Today
          </Button>
        </div>

        {/* View Mode Toggle - only for daily notes, in body section */}
        {type === 'daily-notes' && (
          <div className="mb-6">
            <SegmentedControl value={viewMode} onValueChange={handleViewModeChange}>
              <SegmentedControlList className="grid w-full grid-cols-2">
                <SegmentedControlTrigger value="timeline" className="flex items-center justify-center gap-2">
                  <List className="h-4 w-4" />
                  Timeline
                </SegmentedControlTrigger>
                <SegmentedControlTrigger value="calendar" className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Calendar
                </SegmentedControlTrigger>
              </SegmentedControlList>
            </SegmentedControl>
          </div>
        )}

        {/* Content based on type and view mode */}
        {type === 'daily-notes' ? (
          viewMode === 'timeline' ? (
            <DailyNotesCarousel
              accentColor={getAccentColorValue()}
              isFullPage={true}
              focusDate={focusDate}
            />
          ) : (
            <div className="max-w-4xl mx-auto">
              <DailyNotesCalendar
                accentColor={getAccentColorValue()}
              />
            </div>
          )
        ) : (
          <TimelineCarousel
            accentColor={getAccentColorValue()}
            isFullPage={true}
            focusDate={focusDate}
          />
        )}
    </NavPageLayout>
  );
}

/**
 * Main Timeline Page with Suspense boundary
 */
export default function TimelinePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading timeline...</div>
      </div>
    }>
      <TimelineContent />
    </Suspense>
  );
}
