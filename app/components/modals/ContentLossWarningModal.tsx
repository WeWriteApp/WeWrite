"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle, X, Save, ExternalLink } from 'lucide-react';
import { ExistingPage } from '../../utils/duplicateTitleValidation';

interface ContentLossWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPage: ExistingPage;
  onGoToPageAnyway: (pageId: string) => void;
  onStayAndRename?: () => void;
}

export function ContentLossWarningModal({
  isOpen,
  onClose,
  existingPage,
  onGoToPageAnyway,
  onStayAndRename
}: ContentLossWarningModalProps) {
  const handleGoAnyway = () => {
    onGoToPageAnyway(existingPage.id);
  };

  const handleStayAndRename = () => {
    if (onStayAndRename) {
      onStayAndRename();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[90vw]">
        <DialogHeader className="relative">
          <DialogTitle className="text-lg font-semibold pr-8 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Unsaved Content Warning
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Message */}
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>You have unsaved content!</strong>
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              If you navigate to the existing page, your current content will be lost.
            </p>
          </div>

          {/* Recommendation */}
          <div className="p-3 bg-muted/50 dark:bg-muted/20 border border-border dark:border-border rounded-lg">
            <div className="flex items-start gap-2">
              <Save className="h-4 w-4 text-primary dark:text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-foreground dark:text-muted-foreground mb-1">
                  Recommended: Save your content first
                </div>
                <div className="text-primary dark:text-muted-foreground">
                  Change the title to something unique, then save your page. You can always visit 
                  the existing page afterward.
                </div>
              </div>
            </div>
          </div>

          {/* Existing Page Info */}
          <div className="text-sm text-muted-foreground">
            <p>
              Existing page: <strong>"{existingPage.title}"</strong>
            </p>
            {existingPage.lastModified && (
              <p className="text-xs mt-1">
                Last modified: {new Date(existingPage.lastModified).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {/* Recommended action */}
            <Button
              onClick={handleStayAndRename}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              variant="default"
            >
              <Save className="h-4 w-4" />
              Stay & Rename Title (Recommended)
            </Button>
            
            {/* Destructive action */}
            <Button
              onClick={handleGoAnyway}
              variant="destructive"
              className="w-full gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Go Anyway (Lose Content)
            </Button>
            
            {/* Cancel */}
            <Button
              onClick={onClose}
              variant="secondary"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
