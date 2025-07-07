"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getDatabase, ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { app } from '../../firebase/config';
import { Loader } from '../../components/utils/Loader';
import SingleProfileView from '../../components/pages/SingleProfileView';

import { useFeatureFlag } from '../../utils/feature-flags';
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
  const isPaymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  // Debug the payments flag
  console.warn('🔍 User page: Payments flag value:', {
    isPaymentsEnabled,
    currentAccountEmail: currentAccount?.email,
    currentAccountUid: currentAccount?.uid
  });

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

        const rtdb = getDatabase(app);

        // First, try to get user by ID directly (for numeric IDs or known Firebase UIDs)
        const userByIdRef = ref(rtdb, `users/${id}`);
        const userByIdSnapshot = await get(userByIdRef);

        if (userByIdSnapshot.exists()) {
          // Found user by ID
          const userData = userByIdSnapshot.val();

          // Get user's subscription to check for supporter tier (only if payments enabled)
          let subscription = null;
          console.warn('🔍 User page: About to check payments enabled', { isPaymentsEnabled });
          if (isPaymentsEnabled) {
            console.warn('🔍 User page: Fetching subscription data for user', id);
            subscription = await fetchUserSubscription(id);
            console.warn('🔍 User profile subscription data:', {
              userId: id,
              subscription,
              tier: subscription?.tier,
              status: subscription?.status,
              amount: subscription?.amount
            });
          } else {
            console.warn('🔍 User page: Skipping subscription fetch - payments disabled');
          }

          setProfile({
            uid: id,
            ...userData,
            tier: subscription?.tier || null,
            subscriptionStatus: subscription?.status || null,
            subscriptionAmount: subscription?.amount || null
          });
          setIsLoading(false);
          return;
        }

        // If not found by ID, try to find by username
        const usersRef = ref(rtdb, 'users');
        const usernameQuery = query(usersRef, orderByChild('username'), equalTo(id));
        const usernameSnapshot = await get(usernameQuery);

        if (usernameSnapshot.exists()) {
          // Found user by username
          const userData = Object.entries(usernameSnapshot.val())[0];
          const userId = userData[0];
          const userProfile = userData[1];

          // Get user's subscription to check for supporter tier (only if payments enabled)
          let subscription = null;
          if (isPaymentsEnabled) {
            subscription = await fetchUserSubscription(userId);
            console.log('🔍 User profile subscription data (username lookup):', {
              userId,
              subscription,
              tier: subscription?.tier,
              status: subscription?.status,
              amount: subscription?.amount
            });
          }

          setProfile({
            uid: userId,
            ...userProfile,
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
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">User Not Found</h1>
        <p className="text-muted-foreground">The user you're looking for doesn't exist.</p>
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