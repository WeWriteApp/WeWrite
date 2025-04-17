"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContext } from 'react';
import { AuthContext } from '../providers/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { toast } from 'sonner';
import { followPage, unfollowPage, isFollowingPage } from '../firebase/follows';

/**
 * FollowButton Component
 *
 * Displays a button to follow/unfollow a page with animation
 * Shows a confirmation dialog when unfollowing
 *
 * @param {Object} props
 * @param {string} props.pageId - The ID of the page to follow/unfollow
 * @param {string} props.pageTitle - The title of the page (for notifications)
 * @param {string} props.className - Additional CSS classes
 */
export default function FollowButton({ pageId, pageTitle = "this page", className = "", pageOwnerId }) {
  const { user } = useContext(AuthContext);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);
  const [animateCheck, setAnimateCheck] = useState(false);

  // Check if the user is already following the page
  useEffect(() => {
    if (!user || !pageId) {
      setIsLoading(false);
      return;
    }

    // Prevent following own pages
    if (pageOwnerId && user.uid === pageOwnerId) {
      setIsLoading(false);
      return;
    }

    const checkFollowStatus = async () => {
      try {
        const following = await isFollowingPage(user.uid, pageId);
        setIsFollowing(following);
      } catch (error) {
        console.error("Error checking follow status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkFollowStatus();
  }, [user, pageId]);

  // Handle follow button click
  const handleFollowClick = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "You need to sign in to follow pages",
        variant: "destructive"
      });
      return;
    }

    // Prevent following own pages
    if (pageOwnerId && user.uid === pageOwnerId) {
      toast({
        title: "Cannot follow own page",
        description: "You cannot follow your own pages",
        variant: "destructive"
      });
      return;
    }

    if (isFollowing) {
      // Show unfollow confirmation dialog
      setShowUnfollowDialog(true);
    } else {
      try {
        setIsLoading(true);
        await followPage(user.uid, pageId);
        setIsFollowing(true);
        setAnimateCheck(true);

        toast({
          title: "Page followed",
          description: `You are now following "${pageTitle}"`,
          variant: "success"
        });

        // Reset animation after it completes
        setTimeout(() => {
          setAnimateCheck(false);
        }, 1500);
      } catch (error) {
        console.error("Error following page:", error);
        toast({
          title: "Error",
          description: "Failed to follow page. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle unfollow confirmation
  const handleUnfollow = async () => {
    try {
      setIsLoading(true);

      // Attempt to unfollow the page
      await unfollowPage(user.uid, pageId);

      // Update UI state regardless of backend success
      setIsFollowing(false);
      setShowUnfollowDialog(false);

      toast({
        title: "Page unfollowed",
        description: `You are no longer following "${pageTitle}"`,
        variant: "info"
      });
    } catch (error) {
      console.error("Error unfollowing page:", error);

      // Still update the UI state to prevent the user from getting stuck
      setIsFollowing(false);
      setShowUnfollowDialog(false);

      toast({
        title: "Warning",
        description: "There was an issue unfollowing this page, but we've updated your view.",
        variant: "warning"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        onClick={handleFollowClick}
        disabled={isLoading}
        className={`relative h-10 md:h-8 ${className}`}
      >
        <AnimatePresence mode="wait">
          {isFollowing ? (
            <motion.div
              key="following"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-1"
            >
              {animateCheck ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                >
                  <Check className="h-4 w-4 text-green-500" />
                </motion.div>
              ) : (
                <Check className="h-4 w-4" />
              )}
              Following
            </motion.div>
          ) : (
            <motion.div
              key="follow"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Follow
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* Unfollow Confirmation Dialog */}
      <Dialog open={showUnfollowDialog} onOpenChange={setShowUnfollowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Unfollow page?</DialogTitle>
            <DialogDescription>
              You will no longer receive updates about this page in your activity feed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowUnfollowDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUnfollow} disabled={isLoading}>
              Unfollow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
