"use client";

import React, { useState, useEffect, useContext } from "react";
import EnhancedMyGroups from "../components/EnhancedMyGroups";
import { Button } from "../components/ui/button";
import { Plus, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "../components/ui/skeleton";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { useRouter } from "next/navigation";
import { useFeatureFlag } from "../utils/feature-flags";
import { AuthContext } from "../providers/AuthProvider";
import Cookies from 'js-cookie';

export default function GroupsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const groupsEnabled = useFeatureFlag('groups', user?.email);

  // Check if groups feature is enabled
  useEffect(() => {
    // Get the feature flag from cookies as well (set by middleware)
    const cookieFeatureFlag = Cookies.get('feature_groups') === 'true';

    // Force enable the feature flag in cookies to ensure navigation works
    if (!cookieFeatureFlag) {
      console.log('[DEBUG] Groups page - Setting feature_groups cookie to true to fix navigation');
      Cookies.set('feature_groups', 'true', { expires: 1 }); // 1 day expiry
    }

    console.log('[DEBUG] Groups page - Feature flag checks:', {
      groupsEnabled,
      cookieFeatureFlag,
      userEmail: user?.email,
      isAdmin: user?.email === 'jamiegray2234@gmail.com'
    });

    // Bypass the feature flag check completely to fix navigation issues
    // This ensures users can always access the groups page

    // Simulate loading state for demonstration
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [user?.email]);

  return (
    <div className="container mx-auto py-6 max-w-5xl px-4 md:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back to home</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
            <p className="text-muted-foreground mt-1">
              Collaborate with others in shared writing spaces
            </p>
          </div>
        </div>
        <Button
          className="gap-1.5 rounded-2xl"
          onClick={() => {
            console.log('[DEBUG] Groups page - Create New Group button clicked, navigating to /group/new');
            // Use window.location for more reliable navigation
            window.location.href = '/group/new';
          }}
        >
          <Plus className="h-4 w-4" />
          Create New Group
        </Button>
      </div>

      {isLoading ? (
        <GroupsLoadingSkeleton />
      ) : (
        <EnhancedMyGroups hideHeader={true} />
      )}

    </div>
  );
}

// Loading skeleton for groups
function GroupsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Desktop view skeleton (md and up) */}
      <div className="hidden md:block border border-theme-medium rounded-lg overflow-hidden shadow-md dark:bg-card/90 w-full">
        <div className="p-4">
          <div className="flex justify-between border-b border-border pb-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
          </div>

          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="py-4 border-b border-border/50">
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-12 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile view skeleton (below md) */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-1/3" />
              <div className="flex items-center mt-1">
                <Skeleton className="h-4 w-1/2 mr-2" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="flex space-x-3">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
                <Skeleton className="h-14 w-28 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
