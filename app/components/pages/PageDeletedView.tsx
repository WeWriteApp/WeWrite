'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Home, Search, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';

interface PageDeletedViewProps {
  pageTitle?: string;
  pageId?: string;
}

export default function PageDeletedView({ pageTitle = "Untitled", pageId }: PageDeletedViewProps) {
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  const handleBackToPrevious = () => {
    window.history.back();
  };

  const handleSearchPage = () => {
    const searchQuery = encodeURIComponent(pageTitle);
    router.push(`/search?q=${searchQuery}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-md w-full mx-auto text-center">
        {/* Icon */}
        <div className="mb-8">
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center">
            <Trash2 className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
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
            <ArrowLeft className="w-4 h-4" />
            Back to previous page
          </Button>

          <Button
            onClick={handleGoHome}
            variant="secondary"
            className="w-full gap-2 h-12 text-base font-medium"
            size="lg"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </Button>

          <Button
            onClick={handleSearchPage}
            variant="secondary"
            className="w-full gap-2 h-12 text-base font-medium"
            size="lg"
          >
            <Search className="w-4 h-4" />
            Search "{pageTitle}"
          </Button>
        </div>
      </div>
    </div>
  );
}
