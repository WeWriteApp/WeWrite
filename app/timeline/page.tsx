"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, List, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCurrentAccount } from '../components/providers/CurrentAccountProvider';
import { useAccentColor } from '../components/contexts/AccentColorContext';
import DailyNotesCarousel from '../components/daily-notes/DailyNotesCarousel';
import TimelineCarousel from '../components/timeline/TimelineCarousel';

/**
 * Full-page Timeline View
 * 
 * Displays either:
 * - Daily Notes timeline (grouped by createdAt date)
 * - Custom Timeline (grouped by custom date field)
 * 
 * URL params:
 * - type: 'daily-notes' | 'timeline' 
 * - date: YYYY-MM-DD (optional, to focus on specific date)
 */
export default function TimelinePage() {
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

  // Scroll to specific date if provided
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
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="rounded-2xl"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {type === 'daily-notes' ? (
                    <Calendar className="h-6 w-6" />
                  ) : (
                    <List className="h-6 w-6" />
                  )}
                  {getTitle()}
                </h1>
                <p className="text-sm text-muted-foreground">{getDescription()}</p>
              </div>
            </div>

            {/* View Mode Toggle - only for daily notes */}
            {type === 'daily-notes' && (
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'timeline' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('timeline')}
                  className="rounded-2xl"
                >
                  <List className="h-4 w-4 mr-2" />
                  Timeline
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className="rounded-2xl"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Calendar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {type === 'daily-notes' ? (
          viewMode === 'timeline' ? (
            <DailyNotesCarousel 
              accentColor={getAccentColorValue()} 
              isFullPage={true}
              focusDate={focusDate}
            />
          ) : (
            <div className="max-w-4xl mx-auto">
              {/* Calendar view would go here */}
              <div className="text-center py-12 text-muted-foreground">
                Calendar view coming soon
              </div>
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
