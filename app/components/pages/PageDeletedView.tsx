'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Home, Search } from 'lucide-react';
import { Button } from '../ui/button';

interface PageDeletedViewProps {
  pageTitle?: string;
  pageId?: string;
}

export default function PageDeletedView({ pageTitle = "Untitled", pageId }: PageDeletedViewProps) {
  const router = useRouter();

  const handleBackToHome = () => {
    router.push('/');
  };

  const handleSearchPage = () => {
    const searchQuery = encodeURIComponent(pageTitle);
    router.push(`/search?q=${searchQuery}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md mx-auto text-center px-6">
        {/* Icon */}
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Page Deleted
        </h1>

        {/* Description */}
        <p className="text-muted-foreground mb-6">
          The page "{pageTitle}" has been deleted and is no longer available.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleBackToHome}
            className="w-full gap-2"
            size="lg"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Button>

          <Button
            onClick={handleSearchPage}
            variant="secondary"
            className="w-full gap-2"
            size="lg"
          >
            <Search className="w-4 h-4" />
            Search "{pageTitle}"
          </Button>
        </div>

        {/* Additional info */}
        <p className="text-xs text-muted-foreground mt-6">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}
