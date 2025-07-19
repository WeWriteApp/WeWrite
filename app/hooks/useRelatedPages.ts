"use client";

import { useState, useEffect, useCallback } from 'react';
import { graphDataCache } from '../utils/graphDataCache';

export interface RelatedPage {
  id: string;
  title: string;
  username?: string;
  lastModified?: any;
  isPublic?: boolean;
}

export interface RelatedPagesData {
  relatedPages: RelatedPage[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch related pages for a given page
 * Uses the existing related pages API endpoint
 */
export function useRelatedPages(pageId: string, pageTitle?: string, pageContent?: string): RelatedPagesData & { refresh: () => void } {
  const [relatedPages, setRelatedPages] = useState<RelatedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchRelatedPages = useCallback(async () => {
    if (!pageId) {
      setRelatedPages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔗 [RELATED_PAGES] Fetching related pages for:', pageId);

      // Use cached data for better performance
      const data = await graphDataCache.getRelatedPages(pageId, pageTitle, pageContent);

      console.log('🔗 [RELATED_PAGES] Received data:', {
        relatedPagesCount: data.relatedPages?.length || 0,
        refreshTrigger: refreshTrigger
      });

      setRelatedPages(data.relatedPages || []);
      
    } catch (error: any) {
      console.error('🔗 useRelatedPages: Error fetching related pages:', error);
      setError(error.message);
      setRelatedPages([]);
    } finally {
      setLoading(false);
    }
  }, [pageId, pageTitle, pageContent, refreshTrigger]);

  // Fetch related pages when dependencies change
  useEffect(() => {
    fetchRelatedPages();
  }, [fetchRelatedPages]);

  const refresh = useCallback(() => {
    console.log('🔄 [RELATED_PAGES] Manual refresh triggered for page:', pageId);
    setRefreshTrigger(prev => prev + 1);
  }, [pageId]);

  return {
    relatedPages,
    loading,
    error,
    refresh
  };
}
