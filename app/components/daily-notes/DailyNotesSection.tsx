"use client";

import React, { useContext } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { SectionTitle } from '../ui/section-title';
import StickySection from '../StickySection';
import DailyNotesCarousel from './DailyNotesCarousel';
import { AuthContext } from '../../providers/AuthProvider';

interface DailyNotesSectionProps {
  accentColor?: string;
}

/**
 * DailyNotesSection Component
 *
 * Main section component for daily notes feature.
 * Displays a horizontal carousel of calendar day cards.
 * Uses YYYY-MM-DD format for all daily note titles.
 * Now uses the standardized sticky header pattern.
 */
export default function DailyNotesSection({ accentColor = '#1768FF' }: DailyNotesSectionProps) {
  const { user } = useContext(AuthContext);

  if (!user) {
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
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToToday}
            className="rounded-2xl"
          >
            Today
          </Button>
        </SectionTitle>
      }
    >
      {/* Carousel container */}
      <div className="relative">
        <DailyNotesCarousel accentColor={accentColor} />

        {/* Gradient fade on edges for better visual indication of scrollability */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>

      {/* Helpful text */}
      <div className="px-6 mt-3">
        <p className="text-xs text-muted-foreground text-center">
          Tap empty cards to create notes • Tap filled cards to view/edit
        </p>
      </div>
    </StickySection>
  );
}
