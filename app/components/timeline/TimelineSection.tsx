"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Clock, Calendar, List } from 'lucide-react';
import { Button } from '../ui/button';
import { SectionTitle } from '../ui/section-title';
import StickySection from "../utils/StickySection";
import TimelineCarousel from './TimelineCarousel';
import TimelineCalendar from './TimelineCalendar';
import { useAuth } from '../../providers/AuthProvider';
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

  const { user, isAuthenticated } = useAuth();
  const { accentColor, customColors } = useAccentColor();
  const router = useRouter();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');

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
  console.log('📅 TimelineSection: Rendering with auth state:', { isAuthenticated, hasCurrentAccount: !!user });

  if (!isAuthenticated || !user) {
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
    console.log('📅 TimelineSection: scrollToToday called, hasAutoScrolled:', hasAutoScrolled);
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

  // Auto-scroll to today when the timeline section comes into view
  useEffect(() => {
    if (!sectionRef.current || hasAutoScrolled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAutoScrolled) {
            console.log('📅 TimelineSection: Section came into view, auto-scrolling to today');
            // Add a small delay to ensure the carousel is fully rendered
            setTimeout(() => {
              scrollToToday();
              setHasAutoScrolled(true);
            }, 500);
          }
        });
      },
      {
        threshold: 0.3, // Trigger when 30% of the section is visible
        rootMargin: '0px 0px -10% 0px' // Trigger slightly before the section is fully in view
      }
    );

    observer.observe(sectionRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasAutoScrolled]);

  return (
    <div ref={sectionRef}>
      <StickySection
        sectionId="timeline"
        headerContent={
          <SectionTitle
            icon={Clock}
            title="Timeline"
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
        {/* View Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center border border-border rounded-lg p-1 w-full max-w-sm">
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="h-8 px-3 rounded-md flex-1"
            >
              <List className="h-4 w-4 mr-2" />
              Timeline
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="h-8 px-3 rounded-md flex-1"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </div>
        </div>

        {/* Content based on view mode */}
        {viewMode === 'timeline' ? (
          <div className="relative" id="timeline-carousel">
            <TimelineCarousel accentColor={getAccentColorValue()} />

            {/* Gradient fade on edges for better visual indication of scrollability */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <TimelineCalendar accentColor={getAccentColorValue()} />
          </div>
        )}

      </StickySection>
    </div>
  );
}
