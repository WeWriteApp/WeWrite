"use client";

import React, { useState, useContext } from 'react';
import { Calendar, Settings } from 'lucide-react';
import { SectionTitle } from '../ui/section-title';
import DailyNotesCarousel from './DailyNotesCarousel';
import DateFormatModal from './DateFormatModal';
import { AuthContext } from '../../providers/AuthProvider';
import { Button } from '../ui/button';

interface DailyNotesSectionProps {
  accentColor?: string;
}

/**
 * DailyNotesSection Component
 * 
 * Main section component for daily notes feature.
 * Displays a horizontal carousel of calendar day cards.
 */
export default function DailyNotesSection({ accentColor = '#1768FF' }: DailyNotesSectionProps) {
  const { user } = useContext(AuthContext);
  const [showDateFormatModal, setShowDateFormatModal] = useState(false);

  if (!user) {
    return null; // Don't show for non-authenticated users
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-6">
        <SectionTitle
          icon={Calendar}
          title="My Daily Notes"
          className="mb-0"
        />
        
        {/* Date format settings button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDateFormatModal(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Date format settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

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

      {/* Date Format Modal */}
      <DateFormatModal
        open={showDateFormatModal}
        onOpenChange={setShowDateFormatModal}
      />
    </div>
  );
}
