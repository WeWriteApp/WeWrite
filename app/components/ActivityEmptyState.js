"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Search } from 'lucide-react';

/**
 * ActivityEmptyState Component
 * 
 * Displays an empty state for the activity feed when the user is not following any pages
 */
export default function ActivityEmptyState() {
  const router = useRouter();

  const handleSearchClick = () => {
    router.push('/search');
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <Search className="h-8 w-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">No activity yet</h3>
      
      <p className="text-muted-foreground mb-6 max-w-md">
        Follow pages to see their updates in your activity feed. Discover interesting content by searching for pages.
      </p>
      
      <Button 
        onClick={handleSearchClick}
        className="flex items-center gap-2"
      >
        <Search className="h-4 w-4" />
        Search for pages
      </Button>
    </div>
  );
}
