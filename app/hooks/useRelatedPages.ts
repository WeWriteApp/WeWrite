"use client";

import { useState, useEffect, useCallback } from 'react';

export interface RelatedPage {
  id: string;
  title: string;
  username?: string;
  authorId?: string;
  lastModified?: any;
  isPublic?: boolean;
}

export interface RelatedPagesData {
  relatedByOthers: RelatedPage[];
  relatedByAuthor: RelatedPage[];
  authorUsername: string | null;
  loading: boolean;
  error: string | null;
}

interface UseRelatedPagesOptions {
  pageId: string;
  pageTitle?: string;
  pageContent?: string;
  authorId?: string;
  authorUsername?: string;
  excludePageIds?: string[];
  limitByOthers?: number;
  limitByAuthor?: number;
}

/**
 * Hook to fetch related pages using Typesense-powered API
 * Returns both "related by others" and "more by same author" sections
 */
export function useRelatedPages({
  pageId,
  pageTitle,
  pageContent,
  authorId,
  authorUsername,
  excludePageIds = [],
  limitByOthers = 8,
  limitByAuthor = 5,
}: UseRelatedPagesOptions): RelatedPagesData & { refresh: () => void } {
  const [relatedByOthers, setRelatedByOthers] = useState<RelatedPage[]>([]);
  const [relatedByAuthor, setRelatedByAuthor] = useState<RelatedPage[]>([]);
  const [resultAuthorUsername, setResultAuthorUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchRelatedPages = useCallback(async () => {
    if (!pageId) {
      setRelatedByOthers([]);
      setRelatedByAuthor([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        pageId,
        limitByOthers: limitByOthers.toString(),
        limitByAuthor: limitByAuthor.toString(),
      });

      if (pageTitle) {
        params.append('pageTitle', pageTitle);
      }

      if (pageContent) {
        // Send first 1000 chars for search context
        params.append('pageContent', pageContent.substring(0, 1000));
      }

      if (authorId) {
        params.append('authorId', authorId);
      }

      if (authorUsername) {
        params.append('authorUsername', authorUsername);
      }

      if (excludePageIds.length > 0) {
        params.append('excludePageIds', excludePageIds.join(','));
      }

      const response = await fetch(`/api/related-pages?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setRelatedByOthers(data.relatedByOthers || []);
      setRelatedByAuthor(data.relatedByAuthor || []);
      setResultAuthorUsername(data.authorUsername || authorUsername || null);

    } catch (err: any) {
      setError(err.message);
      setRelatedByOthers([]);
      setRelatedByAuthor([]);
    } finally {
      setLoading(false);
    }
  }, [pageId, pageTitle, pageContent, authorId, authorUsername, excludePageIds.join(','), limitByOthers, limitByAuthor, refreshTrigger]);

  useEffect(() => {
    fetchRelatedPages();
  }, [fetchRelatedPages]);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return {
    relatedByOthers,
    relatedByAuthor,
    authorUsername: resultAuthorUsername,
    loading,
    error,
    refresh,
  };
}
