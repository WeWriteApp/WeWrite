"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
// Removed Firebase imports - now using API endpoints
import { Loader } from '../../components/utils/Loader';
import SingleProfileView from '../../components/pages/SingleProfileView';


import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { PageProvider } from '../../contexts/PageContext';
import { getUserSubscriptionTier } from '../../utils/userUtils';

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
  const { currentAccount } = useCurrentAccount();
  // Payments feature is now always enabled
  const isPaymentsEnabled = true;

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use the same subscription data pipeline as page headers
  const fetchUserSubscription = async (userId) => {
    try {
      const subscriptionData = await getUserSubscriptionTier(userId);
      return subscriptionData;
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      return { tier: null, status: null, amount: null };
    }
  };

  useEffect(() => {
    async function fetchUser() {
      try {
        console.warn('🔍 User page: Fetching user data', {
          id,
          isPaymentsEnabled,
          currentAccountEmail: currentAccount?.email,
          currentAccountUid: currentAccount?.uid,
          timestamp: new Date().toISOString()
        });

        // Use API endpoint to get user profile (works in both dev and prod)
        const response = await fetch(`/api/users/profile?id=${encodeURIComponent(id)}`);

        let userData = null;
        let userId = id;

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            userData = result.data;
            userId = userData.uid || userData.id;
          } else {
            console.warn('API returned error for user profile:', result.error);
          }
        } else {
          console.warn('User profile API request failed:', response.status, response.statusText);
        }

        if (userData) {
          // Get user's subscription to check for supporter tier (only if payments enabled)
          let subscription = null;
          console.warn('🔍 User page: About to check payments enabled', { isPaymentsEnabled });
          if (isPaymentsEnabled) {
            console.warn('🔍 User page: Fetching subscription data for user', userId);
            subscription = await fetchUserSubscription(userId);
            console.warn('🔍 User profile subscription data:', {
              userId,
              subscription,
              tier: subscription?.tier,
              status: subscription?.status,
              amount: subscription?.amount
            });
          } else {
            console.warn('🔍 User page: Skipping subscription fetch - payments disabled');
          }

          setProfile({
            uid: userId,
            ...userData,
            tier: subscription?.tier || null,
            subscriptionStatus: subscription?.status || null,
            subscriptionAmount: subscription?.amount || null
          });
          setIsLoading(false);
          return;
        }



        // User not found by either ID or username
        setError('User not found');
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching user:", error);
        setError('Error loading user profile');
        setIsLoading(false);
      }
    }

    fetchUser();
  }, [id, router, isPaymentsEnabled]);

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
    return <Loader />;
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

  return (
    <>
      {/* ...existing profile rendering... */}
      <PageProvider>
        <SingleProfileView profile={profile} />
      </PageProvider>
    </>
  );
}