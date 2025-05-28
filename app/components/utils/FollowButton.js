"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContext } from 'react';
import { AuthContext } from "../../providers/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../ui/dialog";
import { toast } from "../ui/use-toast";
import { followPage, unfollowPage, isFollowingPage } from "../../firebase/follows";
import { createFollowNotification } from "../../firebase/notifications";

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
 * @param {string} props.size - Button size (sm, md, lg)
 */
export default function FollowButton({ pageId, pageTitle = "this page", className = "", pageOwnerId, size = "sm" }) {
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
      toast.error("You need to sign in to follow pages");
      return;
    }

    // Prevent following own pages
    if (pageOwnerId && user.uid === pageOwnerId) {
      toast.error("You cannot follow your own pages");
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

        toast.success(`You are now following "${pageTitle}"`);

        // Create a notification for the page owner
        if (pageOwnerId && pageOwnerId !== user.uid) {
          try {
            await createFollowNotification(pageOwnerId, user.uid, pageId, pageTitle);
          } catch (notificationError) {
            console.error("Error creating follow notification:", notificationError);
            // Don't show an error to the user, as the follow action succeeded
          }
        }

        // Reset animation after it completes
        setTimeout(() => {
          setAnimateCheck(false);
        }, 1500);
      } catch (error) {
        console.error("Error following page:", error);
        toast.error("Failed to follow page. Please try again.");
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

      toast.info(`You are no longer following "${pageTitle}"`);
    } catch (error) {
      console.error("Error unfollowing page:", error);

      // Still update the UI state to prevent the user from getting stuck
      setIsFollowing(false);
      setShowUnfollowDialog(false);

      toast.warning("There was an issue unfollowing this page, but we've updated your view.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={isFollowing ? "outline" : "default"}
        size={size}
        onClick={handleFollowClick}
        disabled={isLoading}
        className={`relative ${className}`}
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
                  <Check className={size === "lg" ? "h-5 w-5 text-green-500" : "h-4 w-4 text-green-500"} />
                </motion.div>
              ) : (
                <Check className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
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
              <Plus className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
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
