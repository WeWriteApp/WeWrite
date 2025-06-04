"use client";
import React, { useContext, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import { Loader, Settings, ChevronLeft, FileText, Users, Eye, Share2, Globe, Lock, LogOut, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import VisibilityDropdown from "../utils/VisibilityDropdown";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/database";
import { rtdb } from "../../firebase/rtdb";
import { ref, update, set } from "firebase/database";
import { toast } from "../ui/use-toast";
import GroupProfileTabs from "./GroupProfileTabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "../ui/dialog";

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
  const [showLeaveGroupDialog, setShowLeaveGroupDialog] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');

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

  // Handle leaving the group
  const handleLeaveGroup = async () => {
    if (!user || !user.uid || !group || !group.id) return;

    try {
      setIsLeavingGroup(true);

      // Remove the user from the group's members list
      const memberRef = ref(rtdb, `groups/${group.id}/members/${user.uid}`);
      await set(memberRef, null);

      // Show success toast
      toast({
        title: "Success",
        description: `You have left ${group.name}`,
      });

      // Redirect to groups page
      router.push('/groups');
    } catch (error) {
      console.error("Error leaving group:", error);
      toast({
        title: "Error",
        description: "Failed to leave the group. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLeavingGroup(false);
      setShowLeaveGroupDialog(false);
    }
  };

  // Handle deleting the group
  const handleDeleteGroup = async () => {
    if (!user || !user.uid || !group || !group.id) return;

    // Verify confirmation text matches group name
    if (deleteConfirmText !== group.name) {
      setDeleteError("Please type the exact group name to confirm deletion");
      return;
    }

    try {
      setIsDeletingGroup(true);
      setDeleteError('');

      // Get all pages in the group
      const groupPages = group.pages || {};

      // For each page, transfer ownership back to the original creator
      if (Object.keys(groupPages).length > 0) {
        // Get all pages data
        const pagesPromises = Object.keys(groupPages).map(async (pageId) => {
          try {
            // Get the page document from Firestore
            const pageDoc = await getDoc(doc(db, "pages", pageId));

            if (pageDoc.exists()) {
              const pageData = pageDoc.data();

              // Update the page to remove group association
              await update(doc(db, "pages", pageId), {
                groupId: null,
                lastModified: new Date().toISOString()
              });
            }
          } catch (pageError) {
            console.error(`Error processing page ${pageId}:`, pageError);
          }
        });

        // Wait for all page updates to complete
        await Promise.all(pagesPromises);
      }

      // Delete the group
      const groupRef = ref(rtdb, `groups/${group.id}`);
      await set(groupRef, null);

      // Show success toast
      toast({
        title: "Success",
        description: `Group '${group.name}' has been deleted`,
      });

      // Redirect to groups page
      router.push('/groups');
    } catch (error) {
      console.error("Error deleting group:", error);
      setDeleteError("Failed to delete the group. Please try again.");
      toast({
        title: "Error",
        description: "Failed to delete the group. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeletingGroup(false);
      setShowDeleteGroupDialog(false);
    }
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Navigation bar - avoiding position:sticky/fixed to prevent Next.js scroll issues */}
      <div className="flex items-center mb-6">
        <div className="flex-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => window.location.href = '/'}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>

        {/* Right side buttons */}
        <div className="flex-1 flex justify-end gap-2">
          {/* Share button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1 rounded-2xl"
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

          {/* Leave Group button - only visible for members who are not owners */}
          {isMember && !isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 rounded-2xl"
              onClick={() => setShowLeaveGroupDialog(true)}
            >
              <LogOut className="h-4 w-4" />
              <span>Leave Group</span>
            </Button>
          )}

          {/* Settings button - only visible for group owner */}
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 rounded-2xl"
              onClick={() => router.push(`/group/${group.id}/settings`)}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Button>
          )}

          {/* Delete Group button - only visible for group owner */}
          {isOwner && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1 rounded-2xl"
              onClick={() => setShowDeleteGroupDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Group</span>
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

        {/* Visibility dropdown - always visible, but only interactive for owners */}
        {isOwner ? (
          <VisibilityDropdown
            isPublic={isPublic}
            onVisibilityChange={handleVisibilityToggle}
            disabled={isLoading}
          />
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
            {isPublic ? (
              <Globe className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium">
              {isPublic ? "Public Group" : "Private Group"}
            </span>
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

      {/* Leave Group confirmation dialog */}
      <Dialog open={showLeaveGroupDialog} onOpenChange={setShowLeaveGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this group? This action cannot be undone.
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md text-amber-800 dark:text-amber-300">
                <p>You will lose access to all group-exclusive content.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleLeaveGroup}
              disabled={isLeavingGroup}
              className="rounded-2xl"
            >
              {isLeavingGroup ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Leave Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group confirmation dialog */}
      <Dialog open={showDeleteGroupDialog} onOpenChange={setShowDeleteGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this group? This action cannot be undone.
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md text-red-800 dark:text-red-300">
                <ul className="list-disc pl-5 space-y-1">
                  <li>The group will be permanently deleted</li>
                  <li>All group pages will be returned to their original creators</li>
                  <li>All members will lose group access</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="my-4">
            <label htmlFor="confirm-delete" className="text-sm font-medium">
              Type <span className="font-bold">{group.name}</span> to confirm deletion:
            </label>
            <input
              id="confirm-delete"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type group name here"
            />
            {deleteError && (
              <p className="text-sm text-red-500 mt-1">{deleteError}</p>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={isDeletingGroup || deleteConfirmText !== group.name}
              className="rounded-2xl"
            >
              {isDeletingGroup ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupProfileView;
