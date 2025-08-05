"use client";

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, List, Clock } from 'lucide-react';
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
    console.log('📅 Timeline Page: scrollToToday called');

    // Guard against server-side rendering
    if (typeof window === 'undefined') return;

    // Use the globally exposed function from TimelineCarousel
    if ((window as any).timelineScrollToToday) {
      (window as any).timelineScrollToToday();
    } else if ((window as any).dailyNotesScrollToToday) {
      // For daily notes mode
      (window as any).dailyNotesScrollToToday();
    } else if (typeof document !== 'undefined') {
      // Fallback: try to find today's card manually
      const today = new Date().toISOString().split('T')[0];
      const todayElement = document.querySelector(`[data-date="${today}"]`);
      if (todayElement) {
        todayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            className="rounded-2xl relative"
            aria-label="Scroll to today"
          >
            <Clock className="h-4 w-4" />
            <span className="hidden md:inline ml-2">Today</span>
          </Button>
        </div>

        {/* View Mode Toggle - only for daily notes, in body section */}
        {type === 'daily-notes' && (
          <div className="flex justify-center mb-6">
            <div className="flex items-center border border-border rounded-lg p-1 w-full max-w-sm">
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('timeline')}
                className="h-8 px-3 rounded-md flex-1"
              >
                <List className="h-4 w-4 mr-2" />
                Timeline
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('calendar')}
                className="h-8 px-3 rounded-md flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Calendar
              </Button>
            </div>
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
