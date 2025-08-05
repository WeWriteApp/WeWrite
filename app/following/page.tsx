"use client";

import React, { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import NavPageLayout from '../components/layout/NavPageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, FileText, Heart, Lock, UserPlus } from 'lucide-react';
import UserFollowingList from '../components/utils/UserFollowingList';
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
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [mounted, isAuthenticated, router]);

  // Show progressive loading state during hydration
  if (!mounted) {
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
            <Lock className="h-8 w-8 text-primary" />
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
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Heart className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Following</h1>
          </div>
              
              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => router.push('/search')}
                  className="flex items-center gap-2 rounded-2xl h-8 px-3"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Find Users</span>
                </Button>
              </div>
            </div>
            
            <p className="text-muted-foreground text-lg">
              Manage your followed users and pages. Stay connected with the content and creators you care about.
            </p>
      </div>

      {/* Following Content with Tabs */}
      <div className="min-h-[600px]">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid grid-cols-2 mb-6 w-full max-w-md">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Following Users</span>
            </TabsTrigger>
            <TabsTrigger value="pages" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Following Pages</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Users You Follow</h2>
              </div>
              <UserFollowingList
                userId={user.uid}
                isCurrentUser={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="pages" className="mt-0">
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Additional Info */}
      <div className="mt-12 p-6 bg-muted/30 rounded-lg">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          About Following
        </h2>
        <div className="space-y-2 text-muted-foreground">
          <p>
            Following users lets you stay updated with their latest content and activity.
            You'll see their recent edits and new pages in your activity feed.
          </p>
          <p>
            Following pages gives you quick access to specific content you want to track.
            You'll be notified when these pages are updated.
          </p>
          <p>
            Your following relationships are private and only visible to you.
          </p>
        </div>
      </div>
    </NavPageLayout>
  );
}
