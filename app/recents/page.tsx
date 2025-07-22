"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useOptimizedHome } from '../hooks/useOptimizedHome';

import Header from '../components/layout/Header';
import RandomPagesTable from '../components/pages/RandomPagesTable';
import EmptyState from '../components/ui/EmptyState';

/**
 * Recently Viewed Page Component
 *
 * Displays a comprehensive list of recently viewed pages for authenticated users.
 * Uses the same implementation as the homepage's recently viewed section.
 */
export default function RecentsPage() {
  const { user } = useAuth();
  const { data, loading, error } = useOptimizedHome();
  const [pagesWithSubscriptions, setPagesWithSubscriptions] = useState([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }
  }, [user]);

  // Process pages with subscription data from the home API
  useEffect(() => {
    const recentPages = data?.recentlyVisitedPages || [];
    const batchUserData = data?.batchUserData || {};

    if (recentPages.length === 0) {
      setPagesWithSubscriptions([]);
      return;
    }

    // Add subscription data to pages using the batched data from the API
    const pagesWithSubs = recentPages.map(page => {
      if (!page.userId) return page;

      const userData = batchUserData[page.userId];
      return {
        ...page,
        tier: userData?.tier,
        subscriptionStatus: userData?.subscriptionStatus,
        subscriptionAmount: userData?.subscriptionAmount,
        username: userData?.username || page.username
      };
    });

    setPagesWithSubscriptions(pagesWithSubs);
  }, [data?.recentlyVisitedPages, data?.batchUserData]);

  if (!user) {
    return null; // Will redirect to login
  }

  const allRecentPages = pagesWithSubscriptions.length > 0 ? pagesWithSubscriptions : (data?.recentlyVisitedPages || []);

  return (
    <>
      <Header />
      <main className="p-6 bg-background min-h-screen">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Recently Viewed</h1>
            <p className="text-muted-foreground">
              Pages you've viewed recently
            </p>
          </div>

          {/* Content */}
          {loading ? (
            // Loading state
            <div className="animate-pulse space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg"></div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="border border-destructive/20 rounded-lg p-4 text-center text-destructive">
              Failed to load recently viewed pages
            </div>
          ) : allRecentPages.length === 0 ? (
            // Empty state
            <EmptyState
              icon={Clock}
              title="No recently viewed pages"
              description="Pages you visit will appear here for quick access"
            />
          ) : (
            // Recently viewed pages list using RandomPagesTable with UsernameBadge
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {allRecentPages.length} page{allRecentPages.length !== 1 ? 's' : ''} found
                </p>
              </div>

              <RandomPagesTable
                pages={allRecentPages}
                loading={false}
                denseMode={false}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}