'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useCommandPalette } from '../../providers/CommandPaletteProvider';

interface PageDeletedViewProps {
  pageTitle?: string;
  pageId?: string;
}

export default function PageDeletedView({ pageTitle = "Untitled", pageId }: PageDeletedViewProps) {
  const { openPaletteWithQuery } = useCommandPalette();

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleBackToPrevious = () => {
    window.history.back();
  };

  const handleSearchPage = () => {
    openPaletteWithQuery(pageTitle);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-md w-full mx-auto text-center">
        {/* Icon */}
        <div className="mb-8">
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center">
            <Icon name="Trash2" size={32} className="sm:w-10 sm:h-10 text-muted-foreground" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          Page Deleted
        </h1>

        {/* Description */}
        <p className="text-muted-foreground mb-8 text-sm sm:text-base leading-relaxed px-2">
          The page "{pageTitle}" has been deleted and is no longer available.
        </p>

        {/* Actions */}
        <div className="space-y-3 px-2">
          <Button
            onClick={handleBackToPrevious}
            className="w-full gap-2 h-12 text-base font-medium"
            size="lg"
          >
            <Icon name="ArrowLeft" size={16} />
            Back to previous page
          </Button>

          <Button
            onClick={handleGoHome}
            variant="secondary"
            className="w-full gap-2 h-12 text-base font-medium"
            size="lg"
          >
            <Icon name="Home" size={16} />
            Go to Home
          </Button>

          <Button
            onClick={handleSearchPage}
            variant="secondary"
            className="w-full gap-2 h-12 text-base font-medium"
            size="lg"
          >
            <Icon name="Search" size={16} />
            Search "{pageTitle}"
          </Button>
        </div>
      </div>
    </div>
  );
}
