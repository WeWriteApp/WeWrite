"use client";

import React, { useState } from 'react';
import { Button } from "../ui/button";
import { Check, Plus, UserPlus, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../providers/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../ui/dialog";
import { useToast } from "../ui/use-toast";
import { useUserFollowing } from '../../hooks/useUserFollowing';

interface UserFollowButtonProps {
  userId: string;
  username?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "secondary";
}

/**
 * UserFollowButton Component
 *
 * Displays a button to follow/unfollow a user with animation
 * Shows a confirmation dialog when unfollowing
 */
export function UserFollowButton({ 
  userId, 
  username = "this user", 
  className = "", 
  size = "sm",
  variant = "outline"
}: UserFollowButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);
  const [animateCheck, setAnimateCheck] = useState(false);

  const {
    isFollowing,
    isLoading,
    followUser,
    unfollowUser
  } = useUserFollowing(userId);

  // Don't show button if not authenticated or trying to follow self
  if (!user || user.uid === userId) {
    return null;
  }

  // Handle follow button click
  const handleFollowClick = async () => {
    if (isFollowing) {
      // Show unfollow confirmation dialog
      setShowUnfollowDialog(true);
    } else {
      try {
        await followUser(userId);
        setAnimateCheck(true);

        toast({
          title: "Following user",
          description: `You are now following ${username}`,
          variant: "default"
        });

        // Reset animation after delay
        setTimeout(() => setAnimateCheck(false), 2000);
      } catch (error) {
        console.error('Error following user:', error);
        toast({
          title: "Error",
          description: "Failed to follow user. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // Handle unfollow confirmation
  const handleUnfollowConfirm = async () => {
    try {
      await unfollowUser(userId);
      setShowUnfollowDialog(false);

      toast({
        title: "Unfollowed user",
        description: `You are no longer following ${username}`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error unfollowing user:', error);
      toast({
        title: "Error",
        description: "Failed to unfollow user. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Button
        onClick={handleFollowClick}
        disabled={isLoading}
        variant={isFollowing ? "secondary" : variant}
        size={size}
        className={`gap-2 transition-all duration-200 px-4 py-2 min-w-[100px] ${className}`}
      >
        <AnimatePresence mode="wait">
          {animateCheck ? (
            <motion.div
              key="check"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <Check className="h-4 w-4 text-green-600" />
            </motion.div>
          ) : isFollowing ? (
            <motion.div
              key="following"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <UserMinus className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="follow"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <UserPlus className="h-4 w-4" />
            </motion.div>
          )}
        </AnimatePresence>
        
        <span>
          {isLoading ? "Loading..." : isFollowing ? "Unfollow" : "Follow"}
        </span>
      </Button>

      {/* Unfollow confirmation dialog */}
      <Dialog open={showUnfollowDialog} onOpenChange={setShowUnfollowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unfollow {username}?</DialogTitle>
            <DialogDescription>
              You will no longer see updates from {username} in your following feed.
              You can follow them again at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUnfollowDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnfollowConfirm}
              disabled={isLoading}
            >
              {isLoading ? "Unfollowing..." : "Unfollow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
