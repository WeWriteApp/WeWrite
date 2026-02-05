"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '../providers/AuthProvider';
import NavPageLayout from '../components/layout/NavPageLayout';
import { SegmentedControl, SegmentedControlContent, SegmentedControlList, SegmentedControlTrigger } from '../components/ui/segmented-control';
import UserFollowingList from '../components/utils/UserFollowingList';
import FollowingSuggestions from '../components/utils/FollowingSuggestions';
import FollowedPages from '../components/pages/FollowedPages';
import { Button } from '../components/ui/button';
import { useRouter } from 'next/navigation';

/**
 * Following Page
 * 
 * Full page experience for managing followed users and pages
 * Features:
 * - Toggle between following users and following pages
 * - Full page layout with header
 * - Better management interface for following relationships
 */
export default function FollowingPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to login if not authenticated (only after auth has finished loading)
  React.useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [mounted, isAuthenticated, isLoading, router]);

  // Show progressive loading state during hydration or auth loading
  if (!mounted || isLoading) {
    return (
      <NavPageLayout loading={true} loadingFallback={
        <div>
          {/* Page header skeleton */}
          <div className="text-center mb-8">
            <div className="h-10 w-48 bg-muted rounded-md mx-auto mb-4 animate-pulse" />
            <div className="h-6 w-96 bg-muted rounded-md mx-auto animate-pulse" />
          </div>

          {/* Following list skeleton */}
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="p-4 border border-border rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded-md w-3/4 animate-pulse" />
                    <div className="h-3 bg-muted rounded-md w-1/2 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      } />
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <NavPageLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Icon name="Lock" size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            You need to sign in to view and manage your following relationships.
          </p>
          <Button onClick={() => router.push('/auth/login')}>
            Sign In
          </Button>
        </div>
      </NavPageLayout>
    );
  }

  return (
    <NavPageLayout>
      <PageHeader
        title="Following"
        actions={
          <Button
            variant="secondary"
            onClick={() => router.push('/search')}
            className="flex items-center gap-2 rounded-2xl h-8 px-3"
          >
            <Icon name="Search" size={16} />
            <span className="hidden sm:inline">Search Writers</span>
          </Button>
        }
      />

      {/* Following Content with Segmented Control */}
      <div className="min-h-[600px]">
        <SegmentedControl defaultValue="users" className="space-y-4 sm:space-y-6">
          <SegmentedControlList className="grid w-full grid-cols-2 max-w-md">
            <SegmentedControlTrigger value="users" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Icon name="Users" size={12} className="sm:h-4 sm:w-4" />
              <span>Following Writers</span>
            </SegmentedControlTrigger>
            <SegmentedControlTrigger value="pages" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Icon name="FileText" size={12} className="sm:h-4 sm:w-4" />
              <span>Following Pages</span>
            </SegmentedControlTrigger>
          </SegmentedControlList>

          <SegmentedControlContent value="users" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Writers You Follow</h2>
              </div>
              <UserFollowingList
                userId={user.uid}
                isCurrentUser={true}
              />
            </div>

            {/* Following Suggestions */}
            <div className="mt-8 pt-8 border-t border-border">
              <FollowingSuggestions limit={10} />
            </div>
          </SegmentedControlContent>

          <SegmentedControlContent value="pages" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Pages You Follow</h2>
              </div>
              <FollowedPages
                userId={user.uid}
                isCurrentUser={true}
                showHeader={false}
                limit={100}
              />
            </div>
          </SegmentedControlContent>
        </SegmentedControl>
      </div>

    </NavPageLayout>
  );
}
