"use client";

import React from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from 'next-themes';
import { Check } from 'lucide-react';
import { usePillStyle, PILL_STYLES } from '../../contexts/PillStyleContext';

interface DayCardProps {
  date: Date;
  hasNote: boolean;
  onClick: () => void;
  accentColor?: string;
}

/**
 * DayCard Component
 *
 * Displays a calendar day card with two distinct visual states:
 * - Empty State: Greyed out card with dotted outline border
 * - Filled State: Solid card with accent color (respects pill style settings)
 * - Classic Mode: Uses outlined style instead of filled
 */
const DayCard = React.memo(function DayCard({ date, hasNote, onClick, accentColor = '#1768FF' }: DayCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { pillStyle } = usePillStyle();

  // Format date for display
  const dayNumber = date.getDate();
  const monthAbbr = date.toLocaleDateString('en-US', { month: 'short' });
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const isToday = new Date().toDateString() === date.toDateString();

  // Determine card styling based on state and pill style
  const getCardStyles = () => {
    if (hasNote) {
      // For cards with notes, respect the pill style setting
      if (pillStyle === PILL_STYLES.CLASSIC || pillStyle === PILL_STYLES.OUTLINE) {
        // Classic/Outline mode - outlined style
        return {
          backgroundColor: 'transparent',
          borderColor: accentColor,
          color: accentColor,
          borderStyle: 'solid',
          borderWidth: '2px'
        };
      } else {
        // Filled mode - solid card with accent color
        return {
          backgroundColor: accentColor,
          borderColor: accentColor,
          color: '#ffffff',
          borderStyle: 'solid',
          borderWidth: '2px'
        };
      }
    } else {
      // Empty state - dotted border for all empty cards (since Today chip will indicate current day)
      return {
        backgroundColor: 'transparent',
        borderColor: 'hsl(var(--border))',
        color: 'hsl(var(--muted-foreground))',
        borderStyle: 'dotted',
        borderWidth: '2px'
      };
    }
  };

  const cardStyles = getCardStyles();

  return (
    <div
      className={cn(
        // Base styling without wewrite-card to avoid unwanted shadows and padding
        "flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-105",
        "flex flex-col items-center justify-center p-3 min-w-[80px] h-[90px]",
        "active:scale-95 select-none rounded-xl relative", // Added relative positioning for checkmark
        // Only add shadow for cards with notes
        hasNote && "shadow-sm"
        // Removed ring styling from today's card since we now use the "Today" chip
      )}
      style={cardStyles}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${hasNote ? 'View note for' : 'Create note for'} ${date.toLocaleDateString()}`}
    >
      {/* Checkmark icon for filled notes - positioned in top-right corner */}
      {hasNote && (
        <div className="absolute top-1.5 right-1.5 z-10">
          <Check
            className="h-3 w-3 drop-shadow-sm"
            style={{
              color: (pillStyle === PILL_STYLES.CLASSIC || pillStyle === PILL_STYLES.OUTLINE)
                ? accentColor
                : '#ffffff'
            }}
          />
        </div>
      )}

      {/* Day of week - small text at top */}
      <div
        className="text-xs font-medium uppercase tracking-wide"
        style={{
          color: hasNote
            ? (pillStyle === PILL_STYLES.CLASSIC || pillStyle === PILL_STYLES.OUTLINE)
              ? `${accentColor}80` // Add transparency to accent color
              : 'rgba(255, 255, 255, 0.8)'
            : cardStyles.color,
          opacity: hasNote ? 0.8 : 0.7
        }}
      >
        {dayOfWeek}
      </div>

      {/* Day number - large and prominent */}
      <div
        className="text-2xl font-bold leading-none"
        style={{ color: cardStyles.color }}
      >
        {dayNumber}
      </div>

      {/* Month abbreviation - smaller text below */}
      <div
        className="text-xs font-medium mt-1 uppercase tracking-wide"
        style={{
          color: hasNote ? 'rgba(255, 255, 255, 0.8)' : cardStyles.color,
          opacity: hasNote ? 0.8 : 0.7
        }}
      >
        {monthAbbr}
      </div>
    </div>
  );
});

export default DayCard;
