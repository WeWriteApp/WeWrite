"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Save, X } from "lucide-react";

/**
 * UnsavedChangesDialog Component
 * 
 * A reusable dialog component that shows a confirmation when a user attempts to
 * navigate away from a page with unsaved changes.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the dialog is open
 * @param {Function} props.onClose - Function to call when the dialog is closed
 * @param {Function} props.onStayAndSave - Function to call when the user chooses to stay and save
 * @param {Function} props.onLeaveWithoutSaving - Function to call when the user chooses to leave without saving
 * @param {boolean} props.isSaving - Whether the content is currently being saved
 * @param {string} props.title - Custom title for the dialog (optional)
 * @param {string} props.description - Custom description for the dialog (optional)
 */
export default function UnsavedChangesDialog({
  isOpen,
  onClose,
  onStayAndSave,
  onLeaveWithoutSaving,
  isSaving = false,
  title = "Unsaved Changes",
  description = "You have unsaved changes. What would you like to do?"
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onLeaveWithoutSaving}
            className="gap-1"
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
            Leave without Saving
          </Button>
          <Button
            variant="default"
            onClick={onStayAndSave}
            className="gap-1"
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Stay and Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
