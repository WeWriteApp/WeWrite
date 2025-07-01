"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { AlertTriangle, Lock, Globe } from "lucide-react";

interface PrivacyWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isGroupPublic: boolean;
  isLoading?: boolean;
}

/**
 * Modal that warns users about privacy implications when adding a private page to a group
 */
export default function PrivacyWarningModal({
  isOpen,
  onClose,
  onConfirm,
  isGroupPublic,
  isLoading = false
}: PrivacyWarningModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader className="space-y-3">
          <div className="mx-auto bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center">Privacy Warning</DialogTitle>
          <DialogDescription>
            {isGroupPublic ? (
              <div className="flex flex-col items-center gap-2">
                <p>
                  This page is currently private. Adding it to this public group will make it visible to everyone.
                </p>
                <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded-lg mt-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>Private Page</span>
                  <span className="mx-1">→</span>
                  <Globe className="h-4 w-4 text-green-500" />
                  <span>Public Group</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p>
                  This page is currently private. Adding it to this private group will make it visible to all group members.
                </p>
                <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded-lg mt-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>Private Page</span>
                  <span className="mx-1">→</span>
                  <Lock className="h-4 w-4 text-amber-500" />
                  <span>Private Group</span>
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-2xl"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            className="rounded-2xl"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}