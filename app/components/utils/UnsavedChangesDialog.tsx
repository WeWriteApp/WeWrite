"use client";

import React from "react";
import { Icon } from '@/components/ui/Icon';
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStayAndSave: () => void;
  onLeaveWithoutSaving: () => void;
  isSaving?: boolean;
  title?: string;
  description?: string;
}

/**
 * UnsavedChangesDialog Component
 *
 * A reusable dialog component that shows a confirmation when a user attempts to
 * navigate away from a page with unsaved changes.
 */
export default function UnsavedChangesDialog({
  isOpen,
  onClose,
  onStayAndSave,
  onLeaveWithoutSaving,
  isSaving = false,
  title = "Unsaved Changes",
  description = "You have unsaved changes. What would you like to do?"
}: UnsavedChangesDialogProps) {
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
          <Icon name="Save" size={24} className="text-amber-600 dark:text-amber-400" />
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
            <Icon name="X" size={16} />
            Leave without Saving
          </Button>
          <Button
            variant="success"
            onClick={onStayAndSave}
            disabled={isSaving}
            className="flex-1 gap-2"
          >
            {isSaving ? (
              <Icon name="Loader" size={16} />
            ) : (
              <Icon name="Save" size={16} />
            )}
            {isSaving ? "Saving..." : "Stay and Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
