"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
  isSaving: boolean;
}

/**
 * Dialog that warns users about unsaved changes when they try to navigate away
 */
export default function UnsavedChangesDialog({
  isOpen,
  onClose,
  onDiscard,
  onSave,
  isSaving = false
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
          </div>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes that will be lost if you leave this page. What would you like to do?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={onDiscard} 
            className="sm:order-1 order-2"
            disabled={isSaving}
          >
            Discard Changes
          </Button>
          <Button 
            variant="default" 
            onClick={onSave} 
            className="sm:order-2 order-1"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                <span>Saving...</span>
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
