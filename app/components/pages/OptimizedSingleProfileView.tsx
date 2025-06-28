"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { ProfileStatsSkeleton, ProfileTabsSkeleton } from "../skeletons/UserProfileSkeleton";
import { Button } from "../ui/button";
import { ChevronLeft, Settings, Share2, Loader } from "lucide-react";
import Link from "next/link";
import dynamic from 'next/dynamic';

// Dynamic imports for heavy components
const UserProfileTabs = dynamic(() => import('../utils/UserProfileTabs'), {
  loading: () => <ProfileTabsSkeleton />,
  ssr: false,
});

const SupporterBadge = dynamic(() => import('../payments/SupporterBadge'), {
  loading: () => <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />,
  ssr: false,
});

const SimpleSparkline = dynamic(() => import('../utils/SimpleSparkline'), {
  loading: () => <div className="w-16 h-6 bg-muted rounded animate-pulse" />,
  ssr: false,
});

interface OptimizedProfileData {
  uid: string;
  username?: string;
  displayName?: string;
  bio?: string;
  tier?: string | null;
  subscriptionStatus?: string | null;
  viewCount?: number;
  // Add other profile fields as needed
}

interface OptimizedSingleProfileViewProps {
  profile: OptimizedProfileData;
  initialStats?: {
    pageCount?: number;
    followerCount?: number;
    viewCount?: number;
    contributorCount?: number;
  };
}

/**
 * OptimizedSingleProfileView - High-performance user profile component
 * 
 * Optimizations:
 * - Progressive loading of profile sections
 * - Immediate skeleton display
 * - Dynamic imports for heavy components
 * - Optimistic UI updates
 * - Efficient data fetching
 * - Mobile-optimized rendering
 */
export default function OptimizedSingleProfileView({ 
  profile, 
  initialStats = {} 
}: OptimizedSingleProfileViewProps) {
  const { user } = useAuth();
  const [profileStats, setProfileStats] = useState(initialStats);
  const [isLoadingStats, setIsLoadingStats] = useState(!initialStats.pageCount);
  const [userActivityData, setUserActivityData] = useState<any>(null);
  const [supporterTier, setSupporterTier] = useState(profile.tier || null);
  const [isLoadingTier, setIsLoadingTier] = useState(false);
  
  const isCurrentUser = user?.uid === profile.uid;
  const statsLoadedRef = useRef(false);
  const activityLoadedRef = useRef(false);

  // Progressive loading of profile stats
  useEffect(() => {
    if (statsLoadedRef.current) return;
    statsLoadedRef.current = true;

    const loadProfileStats = async () => {
      try {
        setIsLoadingStats(true);
        
        // Import stats functions dynamically to reduce initial bundle
        const { 
          getUserFollowerCount, 
          getUserPageCount, 
          getUserTotalViewCount, 
          getUserContributorCount 
        } = await import("../../firebase/counters");

        // Load stats in parallel for better performance
        const [pageCount, followerCount, viewCount, contributorCount] = await Promise.all([
          getUserPageCount(profile.uid),
          getUserFollowerCount(profile.uid),
          getUserTotalViewCount(profile.uid),
          getUserContributorCount ? getUserContributorCount(profile.uid) : Promise.resolve(0),
        ]);

        setProfileStats({
          pageCount,
          followerCount,
          viewCount: viewCount || profile.viewCount || 0,
          contributorCount,
        });
      } catch (error) {
        console.error('Error loading profile stats:', error);
        // Use fallback values
        setProfileStats({
          pageCount: 0,
          followerCount: 0,
          viewCount: profile.viewCount || 0,
          contributorCount: 0,
        });
      } finally {
        setIsLoadingStats(false);
      }
    };

    // Load stats with a small delay to prioritize critical rendering
    const timer = setTimeout(loadProfileStats, 100);
    return () => clearTimeout(timer);
  }, [profile.uid, profile.viewCount]);

  // Load activity data progressively
  useEffect(() => {
    if (activityLoadedRef.current) return;
    activityLoadedRef.current = true;

    const loadActivityData = async () => {
      try {
        // Import activity function dynamically
        const { getUserComprehensiveActivityLast24Hours } = await import("../../firebase/userActivity");
        const activityData = await getUserComprehensiveActivityLast24Hours(profile.uid);
        setUserActivityData(activityData);
      } catch (error) {
        console.error('Error loading activity data:', error);
      }
    };

    // Load activity data after stats to prioritize more important content
    const timer = setTimeout(loadActivityData, 500);
    return () => clearTimeout(timer);
  }, [profile.uid]);

  // Load supporter tier information
  useEffect(() => {
    if (!profile.uid || supporterTier !== null) return;

    const loadSupporterTier = async () => {
      try {
        setIsLoadingTier(true);
        
        // Import subscription functions dynamically
        const { setupOptimizedSubscriptionListener } = await import("../../firebase/optimizedSubscription");
        
        const unsubscribe = setupOptimizedSubscriptionListener(
          profile.uid,
          (subscription) => {
            setSupporterTier(subscription?.tier || null);
            setIsLoadingTier(false);
          },
          (error) => {
            console.error('Error loading subscription:', error);
            setSupporterTier(null);
            setIsLoadingTier(false);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up subscription listener:', error);
        setSupporterTier(null);
        setIsLoadingTier(false);
      }
    };

    loadSupporterTier();
  }, [profile.uid, supporterTier]);

  // Render profile header with immediate content
  const renderProfileHeader = () => (
    <div className="text-center mb-8">
      {/* Avatar - use optimized image loading */}
      <div className="w-24 h-24 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center">
        <span className="text-2xl font-bold text-muted-foreground">
          {(profile.username || profile.displayName || 'U')[0].toUpperCase()}
        </span>
      </div>
      
      {/* Username and supporter badge */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <h1 className="text-2xl font-bold">
          {profile.username || profile.displayName || 'Anonymous'}
        </h1>
        {supporterTier && (
          <Suspense fallback={<div className="h-5 w-16 bg-muted rounded-full animate-pulse" />}>
            <SupporterBadge tier={supporterTier} />
          </Suspense>
        )}
        {isLoadingTier && (
          <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      
      {/* Bio */}
      {profile.bio && (
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          {profile.bio}
        </p>
      )}
    </div>
  );

  // Render stats with progressive loading
  const renderStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
      {/* Pages */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">
            {isLoadingStats ? (
              <div className="h-6 w-12 bg-muted rounded animate-pulse" />
            ) : (
              profileStats.pageCount || 0
            )}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>pages</span>
        </div>
      </div>

      {/* Followers */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">
            {isLoadingStats ? (
              <div className="h-6 w-12 bg-muted rounded animate-pulse" />
            ) : (
              profileStats.followerCount || 0
            )}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>followers</span>
        </div>
      </div>

      {/* Contributors */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">
            {isLoadingStats ? (
              <div className="h-6 w-12 bg-muted rounded animate-pulse" />
            ) : (
              profileStats.contributorCount || 0
            )}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>contributors</span>
        </div>
      </div>

      {/* Views with sparkline */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">
            {isLoadingStats ? (
              <div className="h-6 w-12 bg-muted rounded animate-pulse" />
            ) : (
              profileStats.viewCount || 0
            )}
          </span>
          {!isLoadingStats && userActivityData && (
            <Suspense fallback={<div className="w-16 h-6 bg-muted rounded animate-pulse" />}>
              <div className="w-16 h-6">
                <SimpleSparkline
                  data={userActivityData.viewCount || Array(24).fill(0)}
                  height={24}
                  strokeWidth={1.5}
                  title="View count in the last 24 hours"
                />
              </div>
            </Suspense>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>views</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-5 md:p-4">
      {/* Navigation bar */}
      <div className="flex items-center mb-6">
        <div className="flex-1">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          </Link>
        </div>
        
        <div className="flex-1 flex justify-center">
          <span className="text-sm text-muted-foreground">Profile</span>
        </div>
        
        <div className="flex-1 flex justify-end gap-2">
          {isCurrentUser && (
            <Link href="/settings/profile">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Profile header - renders immediately */}
      {renderProfileHeader()}

      {/* Stats section - progressive loading */}
      {isLoadingStats ? (
        <ProfileStatsSkeleton className="mb-8" />
      ) : (
        renderStats()
      )}

      {/* Profile tabs - lazy loaded */}
      <Suspense fallback={<ProfileTabsSkeleton />}>
        <UserProfileTabs profile={profile} />
      </Suspense>
    </div>
  );
}
