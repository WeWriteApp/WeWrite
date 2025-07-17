"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useCurrentAccount } from "../providers/CurrentAccountProvider";

/**
 * Recently viewed page data interface
 */
export interface RecentPage {
  id: string;
  title: string;
  timestamp: number;
  userId: string;
  username: string;
}

/**
 * Page data interface for adding to recently viewed pages
 */
export interface PageData {
  id: string;
  title?: string;
  userId?: string;
  username?: string;
  [key: string]: any;
}

/**
 * Recently viewed pages context interface
 */
interface RecentPagesContextType {
  recentPages: RecentPage[];
  loading: boolean;
  addRecentPage: (page: PageData) => Promise<void>;
}

/**
 * Recently viewed pages provider props interface
 */
interface RecentPagesProviderProps {
  children: ReactNode;
}

// Maximum number of recently viewed pages to track
const MAX_RECENT_PAGES = 10;

export const RecentPagesContext = createContext<RecentPagesContextType>({
  recentPages: [],
  loading: false,
  addRecentPage: async () => {}
});

/**
 * RecentPagesProvider component that manages recently viewed pages state
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export function RecentPagesProvider({ children }: RecentPagesProviderProps) {
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { session } = useCurrentAccount();

  // Load recently viewed pages from API when user changes
  useEffect(() => {
    if (!session) {
      setRecentPages([]);
      setLoading(false);
      return;
    }

    const fetchRecentPages = async () => {
      setLoading(true);
      try {
        console.log('🔍 [RECENT_PAGES_CONTEXT] Fetching recent pages for user:', session.uid);

        const response = await fetch(`/api/recent-pages?userId=${session.uid}&limit=${MAX_RECENT_PAGES}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch recent pages: ${response.status}`);
        }

        const data = await response.json();
        console.log('🔍 [RECENT_PAGES_CONTEXT] API response:', data);

        if (data.pages && Array.isArray(data.pages)) {
          // Convert API response to RecentPage format
          const recentPagesData: RecentPage[] = data.pages.map((page: any) => ({
            id: page.id,
            title: page.title || 'Untitled',
            timestamp: page.lastModified ? new Date(page.lastModified).getTime() : Date.now(),
            userId: page.userId || session.uid,
            username: page.username || page.authorUsername || 'Anonymous'
          }));

          console.log('🔍 [RECENT_PAGES_CONTEXT] Processed pages:', recentPagesData.length);
          setRecentPages(recentPagesData);
        } else {
          console.log('🔍 [RECENT_PAGES_CONTEXT] No recent pages found');
          setRecentPages([]);
        }
      } catch (error) {
        console.error('🔍 [RECENT_PAGES_CONTEXT] Error fetching recent pages:', error);
        setRecentPages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentPages();
  }, [session?.uid]); // Only depend on session.uid to avoid unnecessary re-renders

  /**
   * Add a page to recent pages
   * Since we now use lastModified-based recent pages, this is a no-op
   * Pages automatically appear in recent pages when they're viewed/modified
   *
   * @param page - The page data to add to recent pages
   */
  const addRecentPage = async (page: PageData): Promise<void> => {
    if (!session || !page || !page.id) return;

    try {
      console.log('🔍 [RECENT_PAGES_CONTEXT] Page view tracked (no action needed - using lastModified):', page.id);

      // Since we now use the user's own pages sorted by lastModified,
      // we don't need to manually track page views. The pages will automatically
      // appear in recent pages when they're modified.

      // Optionally refresh the recent pages list to show the latest data
      // This is not strictly necessary but provides immediate feedback
      // We could add a refresh mechanism here if needed

    } catch (error) {
      console.error("Error in addRecentPage:", error);
    }
  };

  const value: RecentPagesContextType = {
    recentPages,
    loading,
    addRecentPage
  };

  return (
    <RecentPagesContext.Provider value={value}>
      {children}
    </RecentPagesContext.Provider>
  );
}

/**
 * Custom hook for using recent pages context
 *
 * @returns The recent pages context value
 * @throws Error if used outside of RecentPagesProvider
 */
export function useRecentPages(): RecentPagesContextType {
  const context = useContext(RecentPagesContext);
  if (context === undefined) {
    throw new Error('useRecentPages must be used within a RecentPagesProvider');
  }
  return context;
}