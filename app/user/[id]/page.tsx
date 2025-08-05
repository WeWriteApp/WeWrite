"use client";

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import UnifiedLoader from '../../components/ui/unified-loader';
import SingleProfileView from '../../components/pages/SingleProfileView';
import { useAuth } from '../../providers/AuthProvider';
import { PageProvider } from '../../contexts/PageContext';
import { useOptimizedUserProfile } from '../../hooks/useOptimizedUserProfile';

interface UserPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function UserPage({ params }: UserPageProps) {
  // Handle both Promise and object params
  // Note: use() hook cannot be called inside try/catch blocks
  let unwrappedParams;

  // If params is a Promise, use React.use() to unwrap it
  if (params && typeof params.then === 'function') {
    unwrappedParams = use(params);
  } else {
    // If params is already an object, use it directly
    unwrappedParams = params || {};
  }

  const { id } = unwrappedParams;
  const router = useRouter();
  const { user } = useAuth();

  // 🚀 OPTIMIZATION: Use cached user profile hook for instant navigation
  const {
    profile,
    loading: isLoading,
    error,
    isFromCache
  } = useOptimizedUserProfile(id, {
    backgroundRefresh: true,
    cacheTTL: 10 * 60 * 1000, // 10 minutes cache for smooth navigation
    includeSubscription: true
  });

  // 🚀 OPTIMIZATION: Log cache performance for monitoring
  useEffect(() => {
    if (profile) {
      console.log(`🚀 User profile loaded for ${id}:`, {
        username: profile.username,
        fromCache: isFromCache,
        loadTime: isFromCache ? 'instant' : 'fresh'
      });
    }
  }, [profile, isFromCache, id]);

  useEffect(() => {
    if (profile && profile.username) {
      // Send pageview/event to Google Analytics with username
      if (typeof window !== 'undefined' && window.gtag) {
        // Track the profile view event with username
        window.gtag('event', 'view_user_profile', {
          username: profile.username || 'Missing username',
          user_id: profile.uid,
          page_path: window.location.pathname,
          page_title: `User: ${profile.username || 'Missing username'}`,
          profile_owner: profile.uid
        });

        // Update the page title in Google Analytics to include the username
        window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
          page_path: window.location.pathname,
          page_title: `User: ${profile.username || 'Missing username'}`,
          page_location: window.location.href,
          username: profile.username || 'Missing username'
        });
      }
    }
  }, [profile]);

  if (isLoading) {
    return (
      <UnifiedLoader
        isLoading={isLoading}
        message="Loading user profile..."
      />
    );
  }

  if (error) {
    const isUserNotFound = error === 'User not found';
    const isConnectionError = error === 'Error loading user profile';

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">
          {isUserNotFound ? 'User Not Found' : 'Connection Error'}
        </h1>
        <p className="text-muted-foreground">
          {isUserNotFound
            ? "The user you're looking for doesn't exist."
            : "Unable to load user profile. Please check your connection and try again."
          }
        </p>
        {isConnectionError && (
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Additional safety check - don't render if profile is null
  if (!profile) {
    return (
      <UnifiedLoader
        isLoading={true}
        message="Loading user profile..."
      />
    );
  }

  return (
    <>
      {/* ...existing profile rendering... */}
      <PageProvider>
        <SingleProfileView profile={profile} />
      </PageProvider>
    </>
  );
}