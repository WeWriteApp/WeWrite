"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { Icon } from '@/components/ui/Icon';
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
import { followPage, unfollowPage, isFollowingPage } from "../../firebase/follows";

interface FollowButtonProps {
  pageId: string;
  pageTitle?: string;
  className?: string;
  pageOwnerId?: string;
  size?: "sm" | "default" | "lg" | "icon";
}

export default function FollowButton({
  pageId,
  pageTitle = "this page",
  className = "",
  pageOwnerId,
  size = "sm"
}: FollowButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);
  const [animateCheck, setAnimateCheck] = useState(false);

  useEffect(() => {
    if (!user || !pageId) {
      setIsLoading(false);
      return;
    }

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
  }, [user, pageId, pageOwnerId]);

  const handleFollowClick = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "You need to sign in to follow pages",
        variant: "destructive"
      });
      return;
    }

    if (pageOwnerId && user.uid === pageOwnerId) {
      toast({
        title: "Cannot follow own page",
        description: "You cannot follow your own pages",
        variant: "destructive"
      });
      return;
    }

    if (isFollowing) {
      setShowUnfollowDialog(true);
    } else {
      try {
        setIsLoading(true);
        await followPage(user.uid, pageId);
        setIsFollowing(true);
        setAnimateCheck(true);

        toast({
          title: "Following page",
          description: `You are now following "${pageTitle}"`,
          variant: "success"
        });

        setTimeout(() => {
          setAnimateCheck(false);
        }, 1500);
      } catch (error) {
        console.error("Error following page:", error);

        let errorMessage = "Failed to follow page. Please try again.";
        const firebaseError = error as { code?: string };
        if (firebaseError.code === 'permission-denied') {
          errorMessage = "Permission denied. Please make sure you're signed in and try again.";
        } else if (firebaseError.code === 'not-found') {
          errorMessage = "Page not found. It may have been deleted.";
        } else if (firebaseError.code === 'unauthenticated') {
          errorMessage = "Please sign in to follow pages.";
        }

        toast({
          title: "Follow failed",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUnfollow = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      await unfollowPage(user.uid, pageId);
      setIsFollowing(false);
      setShowUnfollowDialog(false);

      toast({
        title: "Unfollowed page",
        description: `You are no longer following "${pageTitle}"`,
        variant: "info"
      });
    } catch (error) {
      console.error("Error unfollowing page:", error);
      setIsFollowing(false);
      setShowUnfollowDialog(false);

      toast({
        title: "Unfollow completed",
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
                  <Icon name="Check" size={size === "lg" ? 20 : 16} className="text-green-500" />
                </motion.div>
              ) : (
                <Icon name="Check" size={size === "lg" ? 20 : 16} />
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
              <Icon name="Plus" size={size === "lg" ? 20 : 16} />
              Follow
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

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
