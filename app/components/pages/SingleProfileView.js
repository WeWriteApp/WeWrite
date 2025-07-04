"use client";
import React, { useContext, useState, useEffect } from "react";
import { PillLink } from "../utils/PillLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataContext } from "../../providers/DataProvider";

import {
  ProfilePagesProvider,
  ProfilePagesContext} from "../../providers/ProfilePageProvider";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Loader, Settings, ChevronLeft, Share2 } from "lucide-react";
import SupporterBadge from "../payments/SupporterBadge";
import { SupporterIcon } from "../payments/SupporterIcon";
import { SubscriptionInfoModal } from "../payments/SubscriptionInfoModal";
import { Button } from "../ui/button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/database";
import SidebarLayout from "../layout/SidebarLayout";

import UserProfileTabs from '../utils/UserProfileTabs';
import { useFeatureFlag } from "../../utils/feature-flags";

const SingleProfileView = ({ profile }) => {
  const { session } = useCurrentAccount(); // Fixed destructuring issues
  const router = useRouter();

  const [username, setUsername] = useState(profile.username || 'Anonymous');
  const [supporterTier, setSupporterTier] = useState(profile.tier || null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(profile.subscriptionStatus || null);
  const [isLoadingTier, setIsLoadingTier] = useState(false);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);

  // Check if payments feature is enabled
  const paymentsEnabled = useFeatureFlag('payments', session?.email);

  // Check if subscription feature is enabled
  useEffect(() => {
    const checkSubscriptionFeature = async () => {
      try {
        const featureFlagsRef = doc(db, 'config', 'featureFlags');
        const featureFlagsDoc = await getDoc(featureFlagsRef);

        if (featureFlagsDoc.exists()) {
          const flagsData = featureFlagsDoc.data();
          setSubscriptionEnabled(flagsData.subscription_management === true);
        }
      } catch (error) {
        console.error('Error checking subscription feature flag:', error);
      }
    };

    checkSubscriptionFeature();
  }, []);

  // Check if this profile belongs to the current user
  const isCurrentUser = session && session.uid === profile.uid;

  // Fetch username if not provided
  useEffect(() => {
    const fetchUsername = async () => {
      if (profile.uid && (!profile.username || profile.username === 'Anonymous' || profile.username === 'Missing username')) {
        try {
          const { getUsernameById } = await import('../../utils/userUtils');
          const fetchedUsername = await getUsernameById(profile.uid);
          if (fetchedUsername && fetchedUsername !== 'Anonymous' && fetchedUsername !== 'Missing username') {
            setUsername(fetchedUsername);
            console.log(`Fetched username for profile: ${fetchedUsername}`);
          }
        } catch (error) {
          console.error('Error fetching username for profile:', error);
        }
      }
    };

    fetchUsername();
  }, [profile.uid, profile.username]);



  // Fetch user's subscription tier
  useEffect(() => {
    let unsubscribe = null;

    const setupSubscriptionListener = async () => {
      if (profile.uid) {
        try {
          setIsLoadingTier(true);

          // Set up a real-time listener for subscription changes
          const { listenToUserSubscription } = await import('../../firebase/subscription');

          unsubscribe = listenToUserSubscription(profile.uid, (subscription) => {
            console.log(`Subscription update received for user ${profile.uid}:`, subscription);

            // Always set the subscription status if available
            if (subscription) {
              setSubscriptionStatus(subscription.status);

              // Determine tier based on subscription amount if active
              if (subscription.status === 'active' || subscription.status === 'trialing') {
                let tier = null;
                const amount = subscription.amount;

                if (amount >= 10 && amount < 20) {
                  tier = 'tier1';
                } else if (amount >= 20 && amount < 50) {
                  tier = 'tier2';
                } else if (amount >= 50 && amount < 100) {
                  tier = 'tier3';
                }

                // Log the tier determination for debugging
                console.log(`Determined tier for user ${profile.uid}: ${tier} (amount: ${amount})`);

                // If tier is already set in the subscription data, use that instead
                if (subscription.tier) {
                  console.log(`Using tier from subscription data: ${subscription.tier}`);
                  // Convert legacy tier names if needed
                  if (subscription.tier === 'bronze') {
                    tier = 'tier1';
                  } else if (subscription.tier === 'silver') {
                    tier = 'tier2';
                  } else if (subscription.tier === 'gold') {
                    tier = 'tier3';
                  } else {
                    tier = subscription.tier;
                  }
                }

                setSupporterTier(tier);
              } else {
                // No active subscription
                setSupporterTier(null);
              }
            } else {
              // No subscription data
              setSubscriptionStatus(null);
              setSupporterTier(null);
            }

            setIsLoadingTier(false);
          });
        } catch (error) {
          console.error('Error setting up subscription listener:', error);
          setSupporterTier(null);
          setIsLoadingTier(false);
        }
      }
    };

    setupSubscriptionListener();

    // Clean up the listener when the component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [profile.uid]);

  return (
    <ProfilePagesProvider userId={profile.uid}>
      {/* Apply WeWrite standardized padding for consistent layout */}
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

          {/* Right side buttons */}
          <div className="flex-1 flex justify-end gap-2">
            {/* Share button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                // Create share text in the format: "[, sessionname]'s profile on @WeWriteApp [URL]"
                const profileUrl = window.location.href;
                const shareText = `${username}'s profile on @WeWriteApp ${profileUrl}`;

                // Check if the Web Share API is available
                if (navigator.share) {
                  navigator.share({
                    title: `${username} on WeWrite`,
                    text: shareText,
                    url: profileUrl}).catch((error) => {
                    // Silent error handling - no toast
                    console.error('Error sharing:', error);
                  });
                } else {
                  // Create a Twitter share URL as fallback
                  try {
                    // First try to open Twitter share dialog
                    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
                    window.open(twitterShareUrl, '_blank', 'noopener,noreferrer');
                  } catch (error) {
                    console.error('Error opening Twitter share:', error);

                    // If that fails, copy the URL to clipboard
                    try {
                      navigator.clipboard.writeText(profileUrl);
                    } catch (clipboardError) {
                      console.error('Error copying link:', clipboardError);
                    }
                  }
                }
              }}
              title="Share"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </Button>

            {/* Settings button removed for current user - now accessible via navigation menu */}
            {/* This eliminates UI redundancy as settings are available in the main navigation */}
          </div>
        </div>

        {/* Username row */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <Link href={`/user/${profile.uid}`} className="hover:underline">
              <h1 className="text-3xl font-semibold">{username}</h1>
            </Link>
          </div>

          {/* Tier badge as a chip below username - completely hidden when payments feature is disabled */}
          {false && subscriptionEnabled && (
            <SubscriptionInfoModal
              currentTier={supporterTier}
              currentStatus={subscriptionStatus}
              userId={profile.uid}
              username={!isCurrentUser ? username : undefined}
            >
              <div className="cursor-pointer">
                {isLoadingTier ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
                    <Loader className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
                    <SupporterIcon
                      tier={supporterTier}
                      status={subscriptionStatus}
                      size="md"
                    />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {supporterTier === 'tier1' ? 'Tier 1 Subscription' :
                       supporterTier === 'tier2' ? 'Tier 2 Subscription' :
                       supporterTier === 'tier3' ? 'Tier 3 Subscription' :
                       'No Subscription'}
                    </span>
                  </div>
                )}
              </div>
            </SubscriptionInfoModal>
          )}
        </div>



        {!session && (
          <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg p-5 mb-6 mx-2 shadow-sm">
            <div className="flex flex-col space-y-4">
              <p className="text-center font-medium">
                You need to be logged in to continue
              </p>
              <div className="flex justify-center space-x-4">
                <Link href="/auth/register">
                  <Button variant="outline" size="sm" className="gap-1 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50">
                    <span>Create Account</span>
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="default" size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                    <span>Log In</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <UserProfileTabs profile={profile} />
      </div>
    </ProfilePagesProvider>
  );
};

export default SingleProfileView;