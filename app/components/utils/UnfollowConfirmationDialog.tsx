"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../ui/dialog";
import { Button } from "../ui/button";

interface UnfollowConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  type: 'user' | 'page';
  name?: string;
}

/**
 * Reusable confirmation dialog for unfollowing users or pages
 */
export default function UnfollowConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  type,
  name = type === 'user' ? 'this user' : 'this page'
}: UnfollowConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Unfollow {type === 'user' ? 'user' : 'page'}?
          </DialogTitle>
          <DialogDescription>
            {type === 'user' 
              ? `You will no longer see updates from ${name} in your activity feed.`
              : `You will no longer receive updates about "${name}" in your activity feed.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            Unfollow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}