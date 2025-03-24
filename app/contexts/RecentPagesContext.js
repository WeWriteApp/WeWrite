"use client";

import React, { createContext, useState, useEffect, useContext } from 'react';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { app } from '../firebase/config';
import { AuthContext } from '../providers/AuthProvider';

// Maximum number of recent pages to track
const MAX_RECENT_PAGES = 10;

export const RecentPagesContext = createContext({
  recentPages: [],
  loading: false,
  addRecentPage: () => {}
});

export function RecentPagesProvider({ children }) {
  const [recentPages, setRecentPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);

  // Load recent pages from Firebase when user changes
  useEffect(() => {
    if (!user) {
      setRecentPages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const db = getDatabase(app);
      const recentPagesRef = ref(db, `users/${user.uid}/recentPages`);

      const unsubscribe = onValue(recentPagesRef, (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            // Convert to array and sort by timestamp (newest first)
            const pagesArray = Object.values(data)
              .filter(page => page && page.id) // Ensure valid page objects
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              .slice(0, MAX_RECENT_PAGES);
            
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
      console.error("Error setting up recent pages listener:", error);
      setRecentPages([]);
      setLoading(false);
    }
  }, [user]);

  // Add a page to recent pages
  const addRecentPage = async (page) => {
    if (!user || !page || !page.id) return;

    try {
      const db = getDatabase(app);
      const recentPageRef = ref(db, `users/${user.uid}/recentPages/${page.id}`);
      
      // Create a recent page entry with only necessary data
      const recentPage = {
        id: page.id,
        title: page.title || 'Untitled',
        timestamp: Date.now(),
        userId: page.userId || user.uid,
        username: page.username || user.displayName || user.email
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

  return (
    <RecentPagesContext.Provider 
      value={{ 
        recentPages, 
        loading, 
        addRecentPage 
      }}
    >
      {children}
    </RecentPagesContext.Provider>
  );
}

// Custom hook for using recent pages
export function useRecentPages() {
  const context = useContext(RecentPagesContext);
  if (context === undefined) {
    throw new Error('useRecentPages must be used within a RecentPagesProvider');
  }
  return context;
}
