"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Loader, UserX, Users } from 'lucide-react';
import { db } from "../../firebase/database";
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { unfollowUser, getFollowedUsers } from "../../firebase/follows";
import { useAuth } from "../../providers/AuthProvider";
import Link from 'next/link';
import { PillLink } from "./PillLink";
import { SupporterIcon } from '../payments/SupporterIcon';
import { useFeatureFlag } from "../../utils/feature-flags";

interface FollowingListProps {
  userId: string;
  isCurrentUser?: boolean;
}

export default function FollowingList({ userId, isCurrentUser = false }: FollowingListProps) {
  const { user } = useAuth();
  const [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Use the reactive feature flag hook instead of manual Firestore check
  const subscriptionEnabled = useFeatureFlag('payments', user?.email);

  useEffect(() => {
    if (!userId) return;

    // Privacy restriction: Only load followed users for the current user
    if (!isCurrentUser) return;

    loadFollowedUsers();
  }, [userId, isCurrentUser]);

  const loadFollowedUsers = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPage(1);
      }

      setError(null);

      // Get the IDs of users the profile user follows
      const followedUserIds = await getFollowedUsers(userId);

      if (followedUserIds.length === 0) {
        setFollowedUsers([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // Calculate pagination
      const currentPage = loadMore ? page + 1 : 1;
      const startIndex = 0;
      const endIndex = currentPage * limit;
      const paginatedIds = followedUserIds.slice(startIndex, endIndex);

      // Check if there are more users to load
      setHasMore(followedUserIds.length > endIndex);

      // Fetch user details for each followed user
      const userPromises = paginatedIds.map(async (followedId) => {
        try {
          const userRef = doc(db, 'users', followedId);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            // Get subscription tier if available
            let tier = null;
            let subscriptionStatus = null;

            try {
              const subscriptionRef = doc(db, 'users', followedId, 'subscription', 'current');
              const subscriptionDoc = await getDoc(subscriptionRef);

              if (subscriptionDoc.exists()) {
                const subscriptionData = subscriptionDoc.data();
                tier = subscriptionData.tier || null;
                subscriptionStatus = subscriptionData.status || null;
              }
            } catch (err) {
              console.error(`Error fetching subscription for user ${followedId}:`, err);
            }

            return {
              id: followedId,
              ...userDoc.data(),
              tier,
              subscriptionStatus
            };
          }
          return null;
        } catch (err) {
          console.error(`Error fetching user ${followedId}:`, err);
          return null;
        }
      });

      const userResults = await Promise.all(userPromises);
      const validUsers = userResults.filter(user => user !== null);

      if (loadMore) {
        setFollowedUsers(prev => [...prev, ...validUsers]);
        setPage(currentPage);
      } else {
        setFollowedUsers(validUsers);
      }
    } catch (err) {
      console.error('Error loading followed users:', err);
      setError('Failed to load followed users');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleUnfollow = async (followedId: string) => {
    if (!user || !isCurrentUser) return;

    try {
      setUnfollowingId(followedId);

      // Call the unfollow function
      await unfollowUser(user.uid, followedId);

      // Update the local state
      setFollowedUsers(prev => prev.filter(u => u.id !== followedId));
    } catch (err) {
      console.error('Error unfollowing user:', err);
      alert('Failed to unfollow user. Please try again.');
    } finally {
      setUnfollowingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error}
      </div>
    );
  }

  if (followedUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-medium mb-2">No followed users or pages yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {isCurrentUser
            ? "When you follow users or pages, they'll appear here so you can easily find them later."
            : "This user isn't following anyone or any pages yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        {followedUsers.map(followedUser => (
          <div
            key={followedUser.id}
            className="flex items-center justify-between p-3 rounded-md border border-border/40 hover:bg-muted/50 transition-colors"
          >
            <Link
              href={`/user/${followedUser.id}`}
              className="flex items-center gap-2 flex-grow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{followedUser.username || 'Anonymous User'}</span>
                  {false && subscriptionEnabled && followedUser.tier && (
                    <SupporterIcon
                      tier={followedUser.tier}
                      status={followedUser.subscriptionStatus}
                      size="sm"
                    />
                  )}
                </div>
                {followedUser.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{followedUser.bio}</p>
                )}
              </div>
            </Link>

            {isCurrentUser && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleUnfollow(followedUser.id)}
                disabled={unfollowingId === followedUser.id}
              >
                {unfollowingId === followedUser.id ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <UserX className="h-4 w-4" />
                )}
                <span className="sr-only">Unfollow</span>
              </Button>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={() => loadFollowedUsers(true)}
            disabled={loadingMore}
            className="w-full"
          >
            {loadingMore ? (
              <>
                <Loader className="h-4 w-4 animate-spin mr-2" />
                Loading more...
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
