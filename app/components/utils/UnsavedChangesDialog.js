"use client";

import React from "react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="sm:max-w-[425px]"
      showCloseButton={false}
    >
      <div className="flex flex-col items-center gap-4 p-6">
        {/* Icon */}
        <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Save className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-center">
          {title}
        </h2>

        {/* Description */}
        <p className="text-sm text-muted-foreground text-center">
          {description}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 w-full mt-4">
          <Button
            variant="outline"
            onClick={onLeaveWithoutSaving}
            disabled={isSaving}
            className="flex-1 gap-2"
          >
            <X className="h-4 w-4" />
            Leave without Saving
          </Button>
          <Button
            variant="default"
            onClick={onStayAndSave}
            disabled={isSaving}
            className="flex-1 gap-2"
          >
            {isSaving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Stay and Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
