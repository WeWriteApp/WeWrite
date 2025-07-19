"use client";

import React, { useState, useEffect } from 'react';
import { Network, Maximize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { SectionTitle } from '../ui/section-title';
import StickySection from "../utils/StickySection";
import PageGraphView from './PageGraphView';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';

interface UserPage {
  id: string;
  title: string;
  lastModified: any;
  createdAt: any;
}

/**
 * UserPagesGraphView Component
 * 
 * Shows a graph view of the current user's pages with their connections.
 * Displays the most recently modified page as the center node.
 * Only shows for authenticated users.
 */
export default function UserPagesGraphView() {
  const { currentAccount, isAuthenticated } = useCurrentAccount();
  const [userPages, setUserPages] = useState<UserPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPageTitle, setSelectedPageTitle] = useState<string | null>(null);

  // Fetch user's pages
  useEffect(() => {
    if (!isAuthenticated || !currentAccount?.uid) {
      setLoading(false);
      return;
    }

    const fetchUserPages = async () => {
      try {
        setLoading(true);
        
        // Fetch user's pages using the my-pages API
        const response = await fetch(`/api/my-pages?userId=${currentAccount.uid}&limit=20&sortBy=lastModified`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch pages: ${response.status}`);
        }

        const data = await response.json();
        const pages = data.pages || [];
        
        console.log('🔗 [USER_PAGES_GRAPH] Fetched user pages:', pages.length);
        
        setUserPages(pages);
        
        // Set the most recently modified page as the center node
        if (pages.length > 0) {
          setSelectedPageId(pages[0].id);
          setSelectedPageTitle(pages[0].title);
        }
        
      } catch (error) {
        console.error('Error fetching user pages:', error);
        setUserPages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPages();
  }, [isAuthenticated, currentAccount?.uid]);

  // Don't show for non-authenticated users
  if (!isAuthenticated || !currentAccount) {
    return null;
  }

  // Don't show if user has no pages
  if (!loading && userPages.length === 0) {
    return null;
  }

  return (
    <StickySection
      sectionId="user-pages-graph"
      headerContent={
        <SectionTitle
          icon={Network}
          title="My Pages Graph"
        >
          {userPages.length > 1 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedPageId || ''}
                onChange={(e) => {
                  const pageId = e.target.value;
                  const page = userPages.find(p => p.id === pageId);
                  setSelectedPageId(pageId);
                  setSelectedPageTitle(page?.title || null);
                }}
                className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
              >
                {userPages.map(page => (
                  <option key={page.id} value={page.id}>
                    {page.title || 'Untitled'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </SectionTitle>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Loading your pages graph...</span>
          </div>
        </div>
      ) : selectedPageId ? (
        <div className="relative">
          <PageGraphView
            pageId={selectedPageId}
            pageTitle={selectedPageTitle || undefined}
            className="mt-0" // Remove default margin since we're in a section
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <p>No pages found to display in graph</p>
        </div>
      )}
    </StickySection>
  );
}
