"use client";

import React from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from 'next-themes';

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
 * - Filled State: Solid card with accent color
 */
export default function DayCard({ date, hasNote, onClick, accentColor = '#1768FF' }: DayCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Format date for display
  const dayNumber = date.getDate();
  const monthAbbr = date.toLocaleDateString('en-US', { month: 'short' });
  const isToday = new Date().toDateString() === date.toDateString();

  // Determine card styling based on state
  const getCardStyles = () => {
    if (hasNote) {
      // Filled state - solid card with accent color
      return {
        backgroundColor: accentColor,
        borderColor: accentColor,
        color: '#ffffff',
        borderStyle: 'solid',
        borderWidth: '2px'
      };
    } else {
      // Empty state - greyed out with dotted border
      return {
        backgroundColor: 'transparent',
        borderColor: isDark ? '#374151' : '#d1d5db',
        color: isDark ? '#9ca3af' : '#6b7280',
        borderStyle: 'dashed',
        borderWidth: '2px'
      };
    }
  };

  const cardStyles = getCardStyles();

  return (
    <div
      className={cn(
        "wewrite-card flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-105",
        "flex flex-col items-center justify-center p-3 min-w-[80px] h-[90px]",
        "active:scale-95 select-none",
        isToday && "ring-2 ring-offset-2 ring-primary"
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

      {/* Today indicator */}
      {isToday && (
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
