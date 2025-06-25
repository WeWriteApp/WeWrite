"use client";

import React from 'react';
import { Button } from "../ui/button";
import { X, Check, AlertTriangle, Link } from 'lucide-react';
import { useFeatureFlag } from "../../utils/feature-flags";
import { useAuth } from "../../providers/AuthProvider";

export interface EditorActionButtonsProps {
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onInsertLink?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  className?: string;
  showInsertLink?: boolean; // Allow disabling Insert Link for specific contexts
}

/**
 * EditorActionButtons - Unified action buttons for all editing contexts
 * 
 * This component provides consistent action buttons across:
 * - New page creation (PageEditor)
 * - Existing page editing (SinglePageView)
 * - Bio editing (UserBioTab)
 * - Group about editing (GroupAboutTab)
 */
export default function EditorActionButtons({
  onSave,
  onCancel,
  onDelete,
  onInsertLink,
  isSaving = false,
  hasUnsavedChanges = false,
  className = "",
  showInsertLink = true
}: EditorActionButtonsProps) {
  const { user } = useAuth();
  
  // Link functionality is now permanently enabled

  return (
    <div className={`w-full ${className}`}>
      {/* Unsaved changes indicator - above buttons */}
      {hasUnsavedChanges && !isSaving && (
        <div className="flex justify-center mb-3">
          <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
            <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
            <span>Unsaved changes</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-center">
        
        {/* Insert Link Button - First */}
        {showInsertLink && onInsertLink && (
          <Button
            id="editor-insert-link-button"
            data-testid="editor-insert-link"
            variant="outline"
            size="lg"
            onClick={(e) => {
              console.log("🔵 [DEBUG] ===== INSERT LINK BUTTON CLICKED =====");
              console.log("🔵 [DEBUG] Event target:", e.target);
              console.log("🔵 [DEBUG] Event currentTarget:", e.currentTarget);
              console.log("🔵 [DEBUG] Button ID:", e.currentTarget.id);
              console.log("🔵 [DEBUG] EditorActionButtons Insert Link button clicked");
              console.log("🔵 [DEBUG] linkFunctionalityEnabled: true (permanently enabled)");
              console.log("🔵 [DEBUG] isSaving:", isSaving);
              console.log("🔵 [DEBUG] About to call onInsertLink from EditorActionButtons");

              // Prevent event bubbling and default behavior
              e.preventDefault();
              e.stopPropagation();

              try {
                onInsertLink();
                console.log("🔵 [DEBUG] onInsertLink call completed successfully");
              } catch (error) {
                console.error("🔴 [DEBUG] Error calling onInsertLink:", error);
              }

              console.log("🔵 [DEBUG] ===== INSERT LINK BUTTON CLICK HANDLER FINISHED =====");
            }}
            disabled={isSaving}
            className="gap-2 w-full md:w-auto rounded-2xl font-medium order-1"
          >
            <Link className="h-5 w-5" />
            <span>Insert Link</span>
          </Button>
        )}

        {/* Save Button - Second */}
        <Button
          onClick={onSave}
          disabled={isSaving}
          size="lg"
          className="gap-2 w-full md:w-auto rounded-2xl font-medium bg-green-600 hover:bg-green-700 text-white order-2"
        >
          {isSaving ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              <span>Save</span>
            </>
          )}
        </Button>

        {/* Discard Button - Third */}
        <Button
          variant="outline"
          size="lg"
          onClick={onCancel}
          disabled={isSaving}
          className="gap-2 w-full md:w-auto rounded-2xl font-medium order-3"
        >
          <X className="h-5 w-5" />
          <span>Discard</span>
        </Button>

        {/* Delete Button - Fourth (optional) */}
        {onDelete && (
          <Button
            variant="outline"
            size="lg"
            onClick={onDelete}
            disabled={isSaving}
            className="gap-2 w-full md:w-auto rounded-2xl font-medium text-destructive hover:text-destructive hover:bg-destructive/10 order-4"
          >
            <AlertTriangle className="h-5 w-5" />
            <span>Delete</span>
          </Button>
        )}
      </div>
    </div>
  );
}
