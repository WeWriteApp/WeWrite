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
export function useRelatedPages(pageId: string, pageTitle?: string, pageContent?: string, currentUsername?: string, currentUserId?: string): RelatedPagesData & { refresh: () => void } {
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

      // Temporarily bypass cache for debugging
      const params = new URLSearchParams({
        pageId,
        limit: '10'
      });

      if (pageTitle) {
        params.append('pageTitle', pageTitle);
      }

      if (pageContent) {
        params.append('pageContent', pageContent.substring(0, 1000));
      }

      if (currentUsername) {
        params.append('excludeUsername', currentUsername);
      }

      if (currentUserId) {
        params.append('excludeUserId', currentUserId);
      }

      const response = await fetch(`/api/related-pages?${params.toString()}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔗 useRelatedPages: API error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      console.log('🔗 [RELATED_PAGES] Received data:', {
        relatedPagesCount: data.relatedPages?.length || 0,
        refreshTrigger: refreshTrigger,
        fullResponse: data
      });

      setRelatedPages(data.relatedPages || []);
      
    } catch (error: any) {
      console.error('🔗 useRelatedPages: Error fetching related pages:', error);
      setError(error.message);
      setRelatedPages([]);
    } finally {
      setLoading(false);
    }
  }, [pageId, pageTitle, pageContent, currentUsername, currentUserId, refreshTrigger]);

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
