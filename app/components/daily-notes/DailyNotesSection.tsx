"use client";

import React from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { SectionTitle } from '../ui/section-title';
import DailyNotesCarousel from './DailyNotesCarousel';
import { useAuth } from '../../providers/AuthProvider';
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
 *
 * LAYOUT STRUCTURE (simplified for easy debugging):
 * - Header with horizontal padding (px-4)
 * - Carousel with no padding wrapper (full width to prevent clipping)
 * - Parent container has no horizontal padding to allow carousel overflow
 */
export default function DailyNotesSection({}: DailyNotesSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const { accentColor, customColors } = useAccentColor();

  // Get the actual color value from the accent color system
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor] || '#2563EB';
    }
    // For preset colors, we need to get the CSS variable value
    const computedStyle = getComputedStyle(document.documentElement);
    const primaryHsl = computedStyle.getPropertyValue('--primary').trim();
    if (primaryHsl) {
      return `hsl(${primaryHsl})`;
    }
    return '#2563EB'; // fallback
  };

  if (!isAuthenticated || !user) {
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
    <div className="space-y-4">
      {/* Section Header - with horizontal padding */}
      <div className="px-4">
        <SectionTitle
          icon={Calendar}
          title="My Daily Notes"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToToday}
            className="rounded-2xl"
            aria-label="Scroll to today's notes"
          >
            Today
          </Button>
        </SectionTitle>
      </div>

      {/* Carousel - full width, no clipping containers */}
      <DailyNotesCarousel accentColor={getAccentColorValue()} />
    </div>
  );
}