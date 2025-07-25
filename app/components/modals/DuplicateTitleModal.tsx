"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { ExistingPage } from '../../utils/duplicateTitleValidation';

interface DuplicateTitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPage: ExistingPage;
  onGoToPage: (pageId: string) => void;
  hasUnsavedContent?: boolean;
  onShowContentWarning?: () => void;
}

export function DuplicateTitleModal({
  isOpen,
  onClose,
  existingPage,
  onGoToPage,
  hasUnsavedContent = false,
  onShowContentWarning
}: DuplicateTitleModalProps) {
  const handleGoToPage = () => {
    if (hasUnsavedContent && onShowContentWarning) {
      // Show content warning modal instead of navigating directly
      onShowContentWarning();
    } else {
      // Navigate directly to the existing page
      onGoToPage(existingPage.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[90vw]">
        <DialogHeader className="relative">
          <DialogTitle className="text-lg font-semibold pr-8 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Title
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
          {/* Error Message */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border-theme-medium rounded-lg" style={{ borderColor: 'hsl(45 93% 47% / 0.3)' }}>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You already have a page titled <strong>"{existingPage.title}"</strong>
            </p>
          </div>

          {/* Explanation */}
          <div className="text-sm text-muted-foreground">
            <p>
              Each user can only have one page per title. This helps keep your content organized 
              and allows others to write pages with the same title, which will appear in "related pages."
            </p>
          </div>

          {/* Page Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <div className="font-medium text-foreground mb-1">Existing page:</div>
              <div className="text-muted-foreground">
                Title: {existingPage.title}
              </div>
              {existingPage.lastModified && (
                <div className="text-muted-foreground text-xs mt-1">
                  Last modified: {new Date(existingPage.lastModified).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleGoToPage}
              className="w-full gap-2"
              variant="default"
            >
              <ExternalLink className="h-4 w-4" />
              Go to "{existingPage.title}"
            </Button>
            
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full"
            >
              Change Title Instead
            </Button>
          </div>

          {/* Content Warning Hint */}
          {hasUnsavedContent && (
            <div className="text-xs text-muted-foreground text-center p-2 bg-blue-50 dark:bg-blue-950/20 border-theme-medium rounded" style={{ borderColor: 'hsl(217 91% 60% / 0.3)' }}>
              <p>
                💡 Since you have unsaved content, we'll check before navigating away
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
