"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from '../../providers/AuthProvider';
import { ProfileTabsSkeleton } from "../skeletons/UserProfileSkeleton";
import { Button } from "../ui/button";
import { ChevronLeft, Settings, Share2, Loader } from "lucide-react";
import Link from "next/link";
import dynamic from 'next/dynamic';

// Dynamic imports for heavy components
const UserProfileTabs = dynamic(() => import('../utils/UserProfileTabs'), {
  loading: () => <ProfileTabsSkeleton />,
  ssr: false});

const SupporterBadge = dynamic(() => import('../payments/SupporterBadge'), {
  loading: () => <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />,
  ssr: false});



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
  profile
}: OptimizedSingleProfileViewProps) {
  const { user } = useAuth();
  const [supporterTier, setSupporterTier] = useState(profile.tier || null);
  const [isLoadingTier, setIsLoadingTier] = useState(false);

  const isCurrentUser = user?.uid === profile.uid;



  // Load supporter tier information
  useEffect(() => {
    if (!profile.uid || supporterTier !== null) return;

    const loadSupporterTier = async () => {
      try {
        setIsLoadingTier(true);
        
        // Use API-first approach instead of complex optimized subscription
        try {
          const response = await fetch(`/api/account-subscription?userId=${profile.uid}`);
          if (response.ok) {
            const data = await response.json();
            const subscription = data.hasSubscription ? data.fullData : null;
            setSupporterTier(subscription?.tier || null);
          } else {
            setSupporterTier(null);
          }
        } catch (error) {
          console.error('Error loading subscription:', error);
          setSupporterTier(null);
        }
        setIsLoadingTier(false);

        const unsubscribe = () => {}; // No cleanup needed for API calls

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
          {profile.username || 'Anonymous'}
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



      {/* Profile tabs - lazy loaded */}
      <Suspense fallback={<ProfileTabsSkeleton />}>
        <UserProfileTabs profile={profile} />
      </Suspense>
    </div>
  );
}