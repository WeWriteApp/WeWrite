"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Loader, UserX, Users } from 'lucide-react';
import { InlineError } from '../ui/InlineError';
import { followsApi } from "../../utils/apiClient";
import { useAuth } from '../../providers/AuthProvider';
import Link from 'next/link';
import { UsernameBadge } from '../ui/UsernameBadge';

import { useAlert } from '../../hooks/useAlert';
import AlertModal from './AlertModal';

interface UserFollowingListProps {
  userId: string;
  isCurrentUser?: boolean;
}

export default function UserFollowingList({ userId, isCurrentUser = false }: UserFollowingListProps) {
  const { user } = useAuth();
  const [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Custom modal hooks
  const { alertState, showError, closeAlert } = useAlert();

  useEffect(() => {
    if (!userId) return;

    // Privacy restriction: Only load followed users for the current user
    if (!isCurrentUser) return;

    loadFollowedUsers();
  }, [user, isCurrentUser]);

  const loadFollowedUsers = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPage(1);
      }

      setError(null);

      // Get the users that the profile user follows using the API
      const response = await followsApi.getFollowedUsers(userId);

      if (!response.success || !response.data?.following) {
        setFollowedUsers([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const followedUsersData = response.data.following;

      if (followedUsersData.length === 0) {
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
      const paginatedUsers = followedUsersData.slice(startIndex, endIndex);

      // Check if there are more users to load
      setHasMore(followedUsersData.length > endIndex);

      // Fetch additional user details using batch API (more efficient)
      let userResults = paginatedUsers;
      try {
        const userIds = paginatedUsers.map(user => user.id).filter(Boolean);
        if (userIds.length > 0) {
          const { getBatchUserData } = await import('../../utils/apiClient');
          const userData = await getBatchUserData(userIds);

          userResults = paginatedUsers.map(followedUser => ({
            ...followedUser,
            tier: userData[followedUser.id]?.tier,
            subscriptionStatus: userData[followedUser.id]?.subscriptionStatus,
            subscriptionAmount: userData[followedUser.id]?.subscriptionAmount
          }));
        }
      } catch (err) {
        console.error('Error fetching batch user details:', err);
        // Fallback to basic user data from follows API
        userResults = paginatedUsers;
      }

      if (loadMore) {
        setFollowedUsers(prev => [...prev, ...userResults]);
        setPage(currentPage);
      } else {
        setFollowedUsers(userResults);
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

      // Call the unfollow function using the API
      const response = await followsApi.unfollowUser(followedId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to unfollow user');
      }

      // Update the local state
      setFollowedUsers(prev => prev.filter(u => u.id !== followedId));
    } catch (err) {
      console.error('Error unfollowing user:', err);
      await showError('Unfollow Failed', 'Failed to unfollow user. Please try again.');
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
      <InlineError
        variant="card"
        message={error}
      />
    );
  }

  if (followedUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-medium mb-2">No followed users yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {isCurrentUser
            ? "When you follow users, they'll appear here so you can easily find them later."
            : "This user isn't following anyone yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        {followedUsers.map(followedUser => {
          const bioText = typeof followedUser.bio === 'string'
            ? followedUser.bio
            : Array.isArray(followedUser.bio)
              ? followedUser.bio.map((n: any) => n.text || '').join(' ')
              : '';

          return (
          <div
            key={followedUser.id}
            className="flex items-center justify-between p-3 rounded-md border border-border/40 hover:bg-muted/50 transition-colors"
          >
            <Link
              href={`/user/${followedUser.id}`}
              className="flex items-center gap-2 flex-grow"
            >
              <div className="flex flex-col">
                <UsernameBadge
                  userId={followedUser.id}
                  username={followedUser.username || 'Anonymous User'}
                  tier={followedUser.tier}
                  subscriptionStatus={followedUser.subscriptionStatus}
                  subscriptionAmount={followedUser.subscriptionAmount}
                  size="sm"
                  showBadge={true}
                  className="font-medium"
                />
                {bioText && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{bioText}</p>
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
        );})}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            variant="secondary"
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

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        variant={alertState.variant}
        icon={alertState.icon}
      />
    </div>
  );
}
