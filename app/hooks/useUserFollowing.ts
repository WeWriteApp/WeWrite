"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { followsApi } from '../utils/apiClient';

interface UseUserFollowingReturn {
  isFollowing: boolean;
  isLoading: boolean;
  followingList: string[];
  followUser: (targetUserId: string) => Promise<void>;
  unfollowUser: (targetUserId: string) => Promise<void>;
  checkFollowStatus: (targetUserId: string) => Promise<boolean>;
  refreshFollowing: () => Promise<void>;
}

/**
 * Hook to manage user following functionality
 * Provides follow/unfollow actions and following status
 */
export function useUserFollowing(targetUserId?: string): UseUserFollowingReturn {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [followingList, setFollowingList] = useState<string[]>([]);

  // Check if current user is following the target user
  const checkFollowStatus = async (userId: string): Promise<boolean> => {
    if (!user?.uid || !userId || user.uid === userId) {
      return false;
    }

    try {
      const following = await isFollowingUser(user.uid, userId);
      if (userId === targetUserId) {
        setIsFollowing(following);
      }
      return following;
    } catch (error) {
      console.error('Error checking follow status:', error);
      return false;
    }
  };

  // Get the list of users the current user is following
  const refreshFollowing = async () => {
    if (!user?.uid) {
      setFollowingList([]);
      return;
    }

    try {
      const following = await getUserFollowing(user.uid);
      setFollowingList(following);
    } catch (error) {
      console.error('Error fetching following list:', error);
      setFollowingList([]);
    }
  };

  // Follow a user
  const handleFollowUser = async (userId: string) => {
    if (!user?.uid || !userId || user.uid === userId) {
      throw new Error('Cannot follow this user');
    }

    try {
      setIsLoading(true);
      await followUser(user.uid, userId);
      
      if (userId === targetUserId) {
        setIsFollowing(true);
      }
      
      // Refresh the following list
      await refreshFollowing();
    } catch (error) {
      console.error('Error following user:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Unfollow a user
  const handleUnfollowUser = async (userId: string) => {
    if (!user?.uid || !userId) {
      throw new Error('Cannot unfollow this user');
    }

    try {
      setIsLoading(true);
      await unfollowUser(user.uid, userId);
      
      if (userId === targetUserId) {
        setIsFollowing(false);
      }
      
      // Refresh the following list
      await refreshFollowing();
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load - check follow status and get following list
  useEffect(() => {
    const initialize = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        // Get following list
        await refreshFollowing();
        
        // Check follow status for target user if provided
        if (targetUserId && targetUserId !== user.uid) {
          await checkFollowStatus(targetUserId);
        }
      } catch (error) {
        console.error('Error initializing user following:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [user?.uid, targetUserId]);

  return {
    isFollowing,
    isLoading,
    followingList,
    followUser: handleFollowUser,
    unfollowUser: handleUnfollowUser,
    checkFollowStatus,
    refreshFollowing
  };
}
