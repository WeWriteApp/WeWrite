"use client";

import React, { useState } from 'react';
import { Calendar, List } from 'lucide-react';
import { Button } from '../ui/button';
import { SectionTitle } from '../ui/section-title';
import StickySection from "../utils/StickySection";
import DailyNotesCarousel from './DailyNotesCarousel';
import DailyNotesCalendar from './DailyNotesCalendar';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useAccentColor } from '../../contexts/AccentColorContext';

interface DailyNotesSectionProps {
  // No longer need accentColor prop since we'll get it from context
}

/**
 * DailyNotesSection Component
 *
 * Main section component for daily notes feature.
 * Displays a horizontal carousel of calendar day cards.
 * Uses YYYY-MM-DD format for all daily note titles.
 * Now uses the standardized sticky header pattern.
 * Uses accent color from context and respects pill style settings.
 */
export default function DailyNotesSection({}: DailyNotesSectionProps) {
  const { currentAccount, isAuthenticated } = useCurrentAccount();
  const { accentColor, customColors } = useAccentColor();
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');

  // Get the actual color value from the accent color system
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor] || '#1768FF';
    }
    // For preset colors, we need to get the CSS variable value
    const computedStyle = getComputedStyle(document.documentElement);
    const primaryHsl = computedStyle.getPropertyValue('--primary').trim();
    if (primaryHsl) {
      return `hsl(${primaryHsl})`;
    }
    return '#1768FF'; // fallback
  };

  if (!isAuthenticated || !currentAccount) {
    return null; // Don't show for non-authenticated users
  }

  // Function to scroll to today's card using the carousel's exposed function
  const scrollToToday = () => {
    // Use the globally exposed function from DailyNotesCarousel
    if ((window as any).dailyNotesScrollToToday) {
      (window as any).dailyNotesScrollToToday();
    } else {
      // Fallback: try to find today's card manually
      const carousel = document.getElementById('daily-notes-carousel');
      if (carousel) {
        // Simple fallback - scroll to approximate center
        const scrollPosition = carousel.scrollWidth / 2 - carousel.clientWidth / 2;
        carousel.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      }
    }
  };

  return (
    <StickySection
      sectionId="daily_notes"
      headerContent={
        <SectionTitle
          icon={Calendar}
          title="My Daily Notes"
        >
          {/* Today Button - only show in timeline mode */}
          {viewMode === 'timeline' && (
            <Button
              variant="outline"
              size="sm"
              onClick={scrollToToday}
              className="rounded-2xl"
            >
              Today
            </Button>
          )}
        </SectionTitle>
      }
    >
      {/* View Toggle - below sticky header */}
      <div className="flex justify-center md:justify-end mb-6">
        {/* View Toggle - full width on mobile, right-aligned on desktop */}
        <div className="flex items-center border border-border rounded-lg p-1 w-full md:w-auto">
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('timeline')}
            className="h-7 px-2 rounded-md flex-1 md:flex-none"
          >
            <List className="h-3 w-3 mr-1" />
            Timeline
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="h-7 px-2 rounded-md flex-1 md:flex-none"
          >
            <Calendar className="h-3 w-3 mr-1" />
            Calendar
          </Button>
        </div>
      </div>

      {/* Content container */}
      <div className="relative">
        {viewMode === 'timeline' ? (
          <>
            <DailyNotesCarousel accentColor={getAccentColorValue()} />
            {/* Gradient fade on edges for better visual indication of scrollability */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          </>
        ) : (
          <DailyNotesCalendar
            accentColor={getAccentColorValue()}
            onPageSelect={(pageId) => {
              // Navigate to the selected page
              window.location.href = `/${pageId}`;
            }}
          />
        )}
      </div>

    </StickySection>
  );
}