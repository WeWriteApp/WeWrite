"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, List, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
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
  const { currentAccount, isAuthenticated } = useCurrentAccount();
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
    if (focusDate) {
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

  if (!isAuthenticated || !currentAccount) {
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
    <div className="min-h-screen bg-background">
      {/* Header - Mobile Optimized */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {/* Mobile-optimized back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="rounded-2xl p-2 md:px-3"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline ml-2">Back</span>
            </Button>

            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                {type === 'daily-notes' ? (
                  <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                ) : (
                  <List className="h-5 w-5 md:h-6 md:w-6" />
                )}
                {getTitle()}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden md:block">{getDescription()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 md:py-8">
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
      </div>
    </div>
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
