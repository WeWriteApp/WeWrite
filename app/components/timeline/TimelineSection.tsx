"use client";

import React from 'react';
import { Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { SectionTitle } from '../ui/section-title';
import StickySection from "../utils/StickySection";
import TimelineCarousel from './TimelineCarousel';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { useRouter } from 'next/navigation';

interface TimelineSectionProps {
  // No props needed since we get everything from context
}

/**
 * TimelineSection Component
 *
 * Main section component for timeline feature.
 * Displays a horizontal carousel of calendar day cards organized by custom date.
 * Uses the standardized sticky header pattern.
 * Uses accent color from context and respects pill style settings.
 */
export default function TimelineSection({}: TimelineSectionProps) {
  console.log('📅 TimelineSection: Component function called');

  const { currentAccount, isAuthenticated } = useCurrentAccount();
  const { accentColor, customColors } = useAccentColor();
  const router = useRouter();

  // Get the accent color value (either custom or default)
  const getAccentColorValue = () => {
    if (accentColor === 'custom' && customColors?.accent) {
      return customColors.accent;
    }
    // Return the CSS variable value for built-in colors
    return accentColor === 'blue' ? '#1768FF' : 
           accentColor === 'green' ? '#16a34a' :
           accentColor === 'purple' ? '#9333ea' :
           accentColor === 'red' ? '#dc2626' :
           accentColor === 'orange' ? '#ea580c' :
           '#1768FF'; // fallback
  };

  // Temporarily remove auth guard to debug Timeline data
  console.log('📅 TimelineSection: Rendering with auth state:', { isAuthenticated, hasCurrentAccount: !!currentAccount });

  if (!isAuthenticated || !currentAccount) {
    console.log('📅 TimelineSection: Auth not ready, but rendering anyway for debugging');
    // return null; // Temporarily disabled
  }

  // Handle new page creation with current date as custom date
  const handleNewPage = () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    router.push(`/new?customDate=${encodeURIComponent(today)}&type=timeline`);
  };

  // Function to scroll to today's card using the carousel's exposed function
  const scrollToToday = () => {
    // Use the globally exposed function from TimelineCarousel
    if ((window as any).timelineScrollToToday) {
      (window as any).timelineScrollToToday();
    } else {
      // Fallback: try to find today's card manually
      const carousel = document.getElementById('timeline-carousel');
      if (carousel) {
        // Simple fallback - scroll to approximate center
        const scrollPosition = carousel.scrollWidth / 2 - carousel.clientWidth / 2;
        carousel.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      }
    }
  };

  return (
    <StickySection
      sectionId="timeline"
      headerContent={
        <SectionTitle
          icon={Clock}
          title="Timeline"
        >
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={scrollToToday}
              className="rounded-2xl"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewPage}
              className="rounded-2xl"
            >
              New page
            </Button>
          </div>
        </SectionTitle>
      }
    >
      {/* Carousel container */}
      <div className="relative" id="timeline-carousel">
        <TimelineCarousel accentColor={getAccentColorValue()} />

        {/* Gradient fade on edges for better visual indication of scrollability */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>

    </StickySection>
  );
}
