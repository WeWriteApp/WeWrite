"use client";
import React, { useContext, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { Loader, Settings, ChevronLeft, FileText, Users, Eye, Share2, Globe, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/database";
import { rtdb } from "../firebase/rtdb";
import { ref, update } from "firebase/database";
import { toast } from "./ui/use-toast";
import GroupProfileTabs from "./GroupProfileTabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "./ui/dialog";

const GroupProfileView = ({ group }) => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [memberCount, setMemberCount] = useState(Object.keys(group.members || {}).length);
  const [pageCount, setPageCount] = useState(Object.keys(group.pages || {}).length);
  const [viewCount, setViewCount] = useState(group.viewCount || 0);
  const [isPublic, setIsPublic] = useState(group.isPublic || false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingVisibilityChange, setPendingVisibilityChange] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if this user is the group owner or a member
  const isOwner = user && user.uid === group.owner;
  const isMember = user && group.members && group.members[user.uid];
  const canEdit = isOwner || (isMember && group.members[user.uid].role === 'admin');

  // Handle visibility toggle
  const handleVisibilityToggle = (newValue) => {
    setPendingVisibilityChange(newValue);
    setShowConfirmDialog(true);
  };

  const confirmVisibilityChange = () => {
    if (pendingVisibilityChange !== null) {
      setIsLoading(true);
      const groupRef = ref(rtdb, `groups/${group.id}`);
      update(groupRef, { isPublic: pendingVisibilityChange })
        .then(() => {
          setIsPublic(pendingVisibilityChange);
          toast({
            title: "Group visibility updated",
            description: `The group is now ${pendingVisibilityChange ? "public" : "private"}.`,
          });
        })
        .catch((error) => {
          console.error("Error updating group visibility:", error);
          toast({
            title: "Error",
            description: "Failed to update group visibility. Please try again.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoading(false);
          setPendingVisibilityChange(null);
          setShowConfirmDialog(false);
        });
    }
  };

  const cancelVisibilityChange = () => {
    setShowConfirmDialog(false);
    setPendingVisibilityChange(null);
  };

  return (
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

        {/* Right side buttons */}
        <div className="flex-1 flex justify-end gap-2">
          {/* Share button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              const groupUrl = window.location.href;
              const shareText = `${group.name} group on @WeWriteApp ${groupUrl}`;

              // Check if the Web Share API is available
              if (navigator.share) {
                navigator.share({
                  title: `${group.name} on WeWrite`,
                  text: shareText,
                  url: groupUrl,
                }).catch((error) => {
                  console.error('Error sharing:', error);
                });
              } else {
                try {
                  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
                  window.open(twitterShareUrl, '_blank', 'noopener,noreferrer');
                } catch (error) {
                  console.error('Error opening Twitter share:', error);
                  try {
                    navigator.clipboard.writeText(groupUrl);
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

          {/* Settings button - only visible for group owner */}
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => router.push(`/group/${group.id}/settings`)}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Button>
          )}
        </div>
      </div>

      {/* Group name row */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center justify-center mb-3">
          <Link href={`/group/${group.id}`} className="hover:underline">
            <h1 className="text-3xl font-semibold">{group.name}</h1>
          </Link>
        </div>

        {/* Visibility badge */}
        {isOwner && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
            {isPublic ? (
              <Globe className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium">
              {isPublic ? "Public Group" : "Private Group"}
            </span>
            <Switch
              checked={isPublic}
              onCheckedChange={handleVisibilityToggle}
              disabled={isLoading}
              aria-label="Toggle group visibility"
            />
          </div>
        )}
      </div>

      {/* Group stats */}
      <div className="flex flex-wrap gap-6 items-center justify-center mb-6">
        <div className="flex flex-col items-center">
          <span className="text-lg font-semibold">{pageCount}</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>pages</span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-lg font-semibold">{memberCount}</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>members</span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-lg font-semibold">{viewCount}</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            <span>views</span>
          </div>
        </div>
      </div>

      {!user && (
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

      <GroupProfileTabs group={group} isOwner={isOwner} isMember={isMember} canEdit={canEdit} />

      {/* Visibility change confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => {
        setShowConfirmDialog(open);
        if (!open) {
          setPendingVisibilityChange(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Group Visibility</DialogTitle>
            <DialogDescription>
              {pendingVisibilityChange
                ? "Making this group public will allow anyone to see it and its pages. Continue?"
                : "Making this group private will hide it and its pages from non-members. Continue?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline" onClick={cancelVisibilityChange}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={confirmVisibilityChange} disabled={isLoading}>
              {isLoading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupProfileView;
