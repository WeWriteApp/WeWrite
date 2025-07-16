"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { getDatabase, ref, onValue, set, Unsubscribe } from 'firebase/database';
import { app } from "../firebase/config";
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

  // Load recently viewed pages from Firebase when user changes
  useEffect(() => {
    if (!session) {
      setRecentPages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const db = getDatabase(app);
      const recentPagesRef = ref(db, `users/${session.uid}/recentPages`);

      const unsubscribe: Unsubscribe = onValue(recentPagesRef, async (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            // Convert to array and sort by timestamp (newest first)
            let pagesArray = Object.values(data)
              .filter((page: any): page is RecentPage => page && page.id) // Ensure valid page objects
              .sort((a: RecentPage, b: RecentPage) => (b.timestamp || 0) - (a.timestamp || 0))
              .slice(0, MAX_RECENT_PAGES);

            // Just set the pages as-is, don't try to fix usernames in the listener
            // (Username fixing should be done elsewhere to avoid infinite loops)
            setRecentPages(pagesArray);
          } else {
            setRecentPages([]);
          }
        } catch (error) {
          console.error("Error processing recent pages data:", error);
          setRecentPages([]);
        } finally {
          setLoading(false);
        }
      }, (error) => {
        console.error("Firebase onValue error:", error);
        setRecentPages([]);
        setLoading(false);
      });

      return () => {
        try {
          unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from recent pages:", error);
        }
      };
    } catch (error) {
      console.error("Error setting up recently viewed pages listener:", error);
      setRecentPages([]);
      setLoading(false);
    }
  }, [session?.uid]); // Only depend on session.uid to avoid unnecessary re-renders

  /**
   * Add a page to recent pages
   *
   * @param page - The page data to add to recent pages
   */
  const addRecentPage = async (page: PageData): Promise<void> => {
    if (!session || !page || !page.id) return;

    try {
      const db = getDatabase(app);
      const recentPageRef = ref(db, `users/${session.uid}/recentPages/${page.id}`);

      // Create a recent page entry with only necessary data
      const recentPage: RecentPage = {
        id: page.id,
        title: page.title || 'Untitled',
        timestamp: Date.now(),
        userId: page.userId || session.uid,
        username: page.username || session.displayName || "Anonymous"
      };

      // Save to Firebase
      await set(recentPageRef, recentPage);

      // Update local state (optimistic update)
      setRecentPages(prev => {
        // Remove if already exists
        const filtered = Array.isArray(prev) ? prev.filter(p => p && p.id !== page.id) : [];
        // Add to beginning
        return [recentPage, ...filtered].slice(0, MAX_RECENT_PAGES);
      });
    } catch (error) {
      console.error("Error adding recent page:", error);
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