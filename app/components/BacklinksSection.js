"use client";

import React, { useState, useEffect } from 'react';
import { PillLink } from './PillLink';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Import the database function with dynamic import to avoid SSR issues
const findBacklinksAsync = async (pageId, limit) => {
  const { findBacklinks } = await import('../firebase/database');
  return findBacklinks(pageId, limit);
};

/**
 * BacklinksSection Component
 *
 * Displays a list of pages that link to the current page.
 * This is also known as "What Links Here" functionality.
 *
 * @param {Object} page - The current page object
 * @param {number} maxPages - Maximum number of backlinks to display (default: 5)
 */
export default function BacklinksSection({ page, maxPages = 5 }) {
  const [backlinks, setBacklinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBacklinks = async () => {
      setIsLoading(true);

      if (!page || !page.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Use the dynamically imported function to find backlinks
        const backlinkPages = await findBacklinksAsync(page.id, maxPages);
        setBacklinks(backlinkPages);
      } catch (error) {
        console.error('Error fetching backlinks:', error);
        // Set empty array on error to avoid undefined state
        setBacklinks([]);
      }

      setIsLoading(false);
    };

    fetchBacklinks();
  }, [page, maxPages]);

  // Add mounted state to prevent hydration issues
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a consistent height container regardless of loading state
  // Only render the full component when mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="mt-8 pt-6 min-h-[120px]">
        <h3 className="text-lg font-medium mb-4">What Links Here</h3>
        <div className="flex justify-center items-center py-4 min-h-[60px]">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 min-h-[120px]">
      <h3 className="text-lg font-medium mb-4">What Links Here</h3>

      {isLoading ? (
        <div className="flex justify-center items-center py-4 min-h-[60px]">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      ) : backlinks.length > 0 ? (
        <div className="flex flex-wrap gap-2 py-4">
          {backlinks.map(page => (
            <div key={page.id} className="flex-none max-w-full">
              <PillLink
                key={page.id}
                href={`/${page.id}`}
                className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
              >
                {page.title || "Untitled"}
              </PillLink>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-center items-center py-4 min-h-[60px] text-muted-foreground border border-dotted border-border/30 rounded-md">
          No pages link to this page
        </div>
      )}
    </div>
  );
}
