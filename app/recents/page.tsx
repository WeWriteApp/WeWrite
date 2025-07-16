"use client";

import React, { useState, useEffect, useContext } from 'react';
import { Clock, FileText, User, Calendar, ChevronLeft } from 'lucide-react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PillLink } from '../components/utils/PillLink';
import { Skeleton } from '../components/ui/skeleton';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/layout/Header';
import { RecentPagesContext } from '../contexts/RecentPagesContext';

/**
 * Recently Viewed Page Component
 *
 * Displays a comprehensive list of recently viewed pages for authenticated users.
 * Features search, filtering, and detailed page information.
 */
export default function RecentsPage() {
  const { currentAccount } = useCurrentAccount();
  const { recentPages, loading } = useContext(RecentPagesContext);
  const router = useRouter();
  // Remove search functionality - no longer needed

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentAccount) {
      router.push('/auth/login');
      return;
    }
  }, [currentAccount, router]);

  // No search functionality needed

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 168) { // 7 days
      const days = Math.floor(diffInHours / 24);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!currentAccount) {
    return null; // Will redirect to login
  }

  return (
    <>
      <Header />
      <main className="p-6 bg-background min-h-screen">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/')}
              className="text-foreground"
              title="Back to Home"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Recently Viewed</h1>
              <p className="text-muted-foreground">
                Pages you've viewed recently
              </p>
            </div>
          </div>

          {/* Search functionality removed */}

          {/* Content */}
          {loading ? (
            // Loading state
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border border-border rounded-lg">
                  <Skeleton className="h-5 w-5" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : recentPages.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No recently viewed pages yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Start viewing pages to see them appear here
              </p>
              <Link href="/">
                <Button>
                  Explore Pages
                </Button>
              </Link>
            </div>
          ) : (
            // Recently viewed pages list
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {recentPages.length} page{recentPages.length !== 1 ? 's' : ''} found
                </p>
              </div>

              {recentPages.map((page) => (
                <div
                  key={page.id}
                  className="group flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Remove page icon */}
                  
                  <div className="flex-1 min-w-0">
                    <PillLink
                      href={`/${page.id}`}
                      className="block hover:no-underline"
                    >
                      {page.title || 'Untitled'}
                    </PillLink>
                    
                    {page.username && (
                      <div className="flex items-center gap-1 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          by {page.username}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Calendar className="h-3 w-3" />
                    <span>{formatTimestamp(page.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}