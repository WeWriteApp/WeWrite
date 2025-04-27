"use client";
import React, { useContext, useState, useEffect } from "react";
import { PillLink } from "./PillLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataContext } from "../providers/DataProvider";
import TypeaheadSearch from "./TypeaheadSearch";
import {
  ProfilePagesProvider,
  ProfilePagesContext,
} from "../providers/ProfilePageProvider";
import { useAuth } from "../providers/AuthProvider";
import { Loader, Settings, ChevronLeft, Heart, Users, Eye } from "lucide-react";
import SupporterBadge from "./SupporterBadge";
import { SupporterIcon } from "./SupporterIcon";
import { SubscriptionInfoModal } from "./SubscriptionInfoModal";
import { Button } from "./ui/button";
import UserStreak from "./UserStreak";
import UserProfileTabs from "./UserProfileTabs";
import { getUserFollowerCount, getUserPageCount, getUserTotalViewCount } from "../firebase/counters";
import { getUserSubscription } from "../firebase/subscription";

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [pageCount, setPageCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [viewCount, setViewCount] = useState(profile.viewCount || 0);
  const [username, setUsername] = useState(profile.username || 'Anonymous');
  const [supporterTier, setSupporterTier] = useState(profile.tier || null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(profile.subscriptionStatus || null);
  const [isLoadingTier, setIsLoadingTier] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Check if this profile belongs to the current user
  const isCurrentUser = user && user.uid === profile.uid;

  // Fetch username if not provided
  useEffect(() => {
    const fetchUsername = async () => {
      if (profile.uid && (!profile.username || profile.username === 'Anonymous')) {
        try {
          const { getUsernameById } = await import('../utils/userUtils');
          const fetchedUsername = await getUsernameById(profile.uid);
          if (fetchedUsername && fetchedUsername !== 'Anonymous') {
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

  // Fetch follower count and page count using optimized counters
  useEffect(() => {
    const fetchStats = async () => {
      if (profile.uid) {
        try {
          setIsLoadingStats(true);

          // Get follower count, page count, and view count in parallel
          const [followerCountResult, pageCountResult, viewCountResult] = await Promise.all([
            getUserFollowerCount(profile.uid),
            getUserPageCount(profile.uid),
            getUserTotalViewCount(profile.uid)
          ]);

          setFollowerCount(followerCountResult);
          setPageCount(pageCountResult);
          setViewCount(viewCountResult);

        } catch (error) {
          console.error('Error fetching user stats:', error);
        } finally {
          setIsLoadingStats(false);
        }
      }
    };

    fetchStats();
  }, [profile.uid]);

  // Fetch user's subscription tier
  useEffect(() => {
    const fetchSubscriptionTier = async () => {
      if (profile.uid) {
        try {
          setIsLoadingTier(true);

          // Get the user's subscription data
          const subscription = await getUserSubscription(profile.uid);

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
        } catch (error) {
          console.error('Error fetching subscription tier:', error);
          setSupporterTier(null);
        } finally {
          setIsLoadingTier(false);
        }
      }
    };

    fetchSubscriptionTier();
  }, [profile.uid]);

  return (
    <ProfilePagesProvider userId={profile.uid}>
      <div className="p-2">
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

          {/* Settings button - only visible for current user */}
          <div className="flex-1 flex justify-end">
            {isCurrentUser && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => router.push('/account')}
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Button>
            )}
            {!isCurrentUser && <div className="w-8" />}
          </div>
        </div>

        {/* Username row */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <Link href={`/user/${profile.uid}`} className="hover:underline">
              <h1 className="text-3xl font-semibold">{username}</h1>
            </Link>
          </div>

          {/* Tier badge as a chip below username - always show */}
          {(
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

        {/* User stats */}
        <div className="flex flex-wrap gap-6 items-center justify-center mb-6">
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold">
              {isLoadingStats ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                pageCount
              )}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>pages</span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold">
              {isLoadingStats ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                followerCount
              )}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              <span>followers</span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold">
              {isLoadingStats ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                viewCount
              )}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>views</span>
            </div>
          </div>
        </div>

        {/* Writing Streak */}
        <div className="mb-6">
          <UserStreak userId={profile.uid} />
        </div>

        {!user && (
          <div className="bg-primary/10 text-primary border border-primary/20 rounded-md p-4 mb-4">
            <div className="flex flex-col space-y-3">
              <p className="text-center">
                You are viewing this profile as a guest.
              </p>
              <div className="flex justify-center space-x-3">
                <Link href="/auth/register">
                  <Button variant="outline" size="sm" className="gap-1">
                    <span>Create Account</span>
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="default" size="sm" className="text-white gap-1">
                    <span>Log In</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="my-4">
          <TypeaheadSearch
            userId={profile.uid}
            placeholder={`Search ${username}'s pages...`}
          />
        </div>
        <UserProfileTabs profile={profile} />
      </div>
    </ProfilePagesProvider>
  );
};

export default SingleProfileView;
