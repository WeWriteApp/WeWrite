"use client";

import React, { useState, useEffect } from 'react';
import { pageApi } from '../../utils/apiClient';
import PillLink from "../utils/PillLink";

interface Page {
  id: string;
  title: string;
}

interface CurrentPage {
  id: string;
  title: string;
}

interface SimilarPagesProps {
  currentPage: CurrentPage | null;
  maxPages?: number;
}

/**
 * SimilarPages Component
 *
 * Displays a list of pages with similar titles to the current page.
 * Uses the page title to find other pages with similar content.
 */
export default function SimilarPages({ currentPage, maxPages = 3 }: SimilarPagesProps) {
  const [similarPages, setSimilarPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSimilarPages() {
      if (!currentPage || !currentPage.title) {
        setLoading(false);
        return;
      }

      try {
        console.log('[SIMILAR PAGES] Fetching similar pages via API for:', currentPage.title);

        // Use API endpoint instead of direct Firebase calls
        const response = await pageApi.getSimilarPages(currentPage.id, currentPage.title, maxPages);

        if (response.success && response.data) {
          setSimilarPages(response.data.pages || []);
          console.log('[SIMILAR PAGES] Found similar pages:', response.data.pages?.length || 0);
        } else {
          console.warn('[SIMILAR PAGES] Failed to fetch similar pages:', response.error);
          setSimilarPages([]);
        }

      } catch (error) {
        console.error('[SIMILAR PAGES] Error fetching similar pages:', error);
        setSimilarPages([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSimilarPages();
  }, [currentPage, maxPages]);



  if (loading) {
    return (
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
        <div className="flex justify-center py-4">
          <div className="loader loader-sm"></div>
        </div>
      </div>
    );
  }

  if (similarPages.length === 0 && !loading) {
    return (
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
        <div className="text-muted-foreground text-sm py-4 text-center border-theme-medium rounded-md p-6 bg-muted/20">
          No similar pages found with matching words in the title.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
      <div className="space-y-2">
        {similarPages.map(page => (
          <PillLink
            key={page.id}
            href={`/${page.id}`}
            className="inline-block"
          >
            {page.title}
          </PillLink>
        ))}
      </div>
    </div>
  );
}
