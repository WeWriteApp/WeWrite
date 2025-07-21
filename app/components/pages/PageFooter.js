"use client";

import React, { useState, useEffect } from "react";
import { PageActions } from "./PageActions";
import WordCounter from "../editor/WordCounter";
import PageStats from "./PageStats";
import CustomDateField from "./CustomDateField";
import LocationField from "./LocationField";
import dynamic from "next/dynamic";
import { Button } from "../ui/button";
import { Reply, Save, RotateCcw, Trash2, Check } from "lucide-react";


// Dynamically import AddToPageButton to avoid SSR issues
const AddToPageButton = dynamic(() => import('../utils/AddToPageButton'), {
  ssr: false,
  loading: () => <div className="h-8 w-24 bg-muted animate-pulse rounded-md"></div>
});
// Removed old stats imports - now using UnifiedStatsService via PageStats component
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';

/**
 * PageFooter Component
 *
 * This component serves as a container for the PageActions component,
 * providing consistent styling and layout for the footer section of a page.
 *
 * The footer includes:
 * - A border at the top for visual separation
 * - Proper padding and margins for spacing
 * - Responsive padding that adjusts to different screen sizes
 * - Increased button sizes for better mobile usability
 *
 * This component is used in SinglePageView and replaces the previous
 * combination of PageInteractionButtons and ActionRow components.
 *
 * @param {Object} page - The page data object
 * @param {Object} content - The content to be passed to PageActions
 * @param {boolean} isOwner - Whether the current user owns the page
 * @param {boolean} isEditing - Whether the page is currently in edit mode
 * @param {Function} setIsEditing - Function to toggle edit mode
 * @param {Function} onSave - Function to save page changes (for edit mode)
 * @param {Function} onCancel - Function to cancel editing (for edit mode)
 * @param {Function} onDelete - Function to delete page (for edit mode)
 * @param {Function} onInsertLink - Function to insert link (for edit mode)
 * @param {boolean} isSaving - Whether page is currently being saved
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 */
export default function PageFooter({
  page,
  content,
  isOwner,
  isEditing,
  setIsEditing,
  onSave,
  onCancel,
  onDelete,
  onInsertLink,
  isSaving,
  hasUnsavedChanges,
  canEdit
}) {
  const { currentAccount } = useCurrentAccount();
  // Removed old stats fetching logic - now handled by UnifiedStatsService in PageStats component

  if (!page) return null;

  return (
    <div className="mt-10 border-t-only pt-6 pb-6">
      {/* Save/Revert buttons - shown at top when there are unsaved changes */}
      {canEdit && hasUnsavedChanges && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex flex-col gap-3 w-full md:flex-row md:justify-center">
            <Button
              variant="default"
              size="lg"
              className="gap-2 w-full md:w-auto rounded-2xl font-medium bg-green-600 hover:bg-green-700 text-white"
              onClick={onSave}
              disabled={isSaving}
            >
              <Check className="h-5 w-5" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 w-full md:w-auto rounded-2xl font-medium border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              onClick={onCancel}
              disabled={isSaving}
            >
              <RotateCcw className="h-5 w-5" />
              Revert Changes
            </Button>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300 mt-2 text-center">
            You have unsaved changes. Save them or revert to the last saved version.
          </p>
        </div>
      )}

      {/* Word and character count - centered above action buttons */}
      {content && (
        <div className="mb-4 flex justify-center w-full">
          <WordCounter content={content} />
        </div>
      )}

      {/* Show PageActions - always visible now since pages are always editable */}
      <div className="mb-6 flex flex-col w-full md:flex-row md:flex-wrap md:items-center md:justify-between gap-4">
        <PageActions
          page={page}
          content={content}
          isOwner={isOwner}
          isEditing={isEditing} // Pass actual editing state for consistency
          setIsEditing={setIsEditing}
          className="action-buttons-container"
          showFollowButton={currentAccount && !isOwner}
        />
      </div>

      {/* Similar pages section removed to conserve resources */}

      {/* Custom Date Field - show in both edit and view modes for all pages */}
      <div className="mb-6">
        <CustomDateField
          customDate={page.customDate}
          canEdit={isOwner}
          onCustomDateChange={async (newDate) => {
            try {
              const response = await fetch(`/api/pages/${page.id}/custom-date`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ customDate: newDate }),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update custom date');
              }

              // Update the page object to reflect the change
              if (page) {
                page.customDate = newDate;
              }

              console.log('Custom date updated successfully to:', newDate);
            } catch (error) {
              console.error('Error updating custom date:', error);
              // TODO: Show user-friendly error message
            }
          }}
        />
      </div>

      {/* Location Field - show in both edit and view modes for all pages */}
      <div className="mb-6">
        <LocationField
          location={page.location}
          canEdit={isOwner}
          onLocationChange={async (newLocation) => {
            try {
              const response = await fetch(`/api/pages/${page.id}/location`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ location: newLocation }),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update location');
              }

              // Update the page object to reflect the change
              if (page) {
                page.location = newLocation;
              }

              console.log('Location updated successfully');
            } catch (error) {
              console.error('Error updating location:', error);
              // TODO: Show user-friendly error message
            }
          }}
        />
      </div>



      {/* Page stats section - show in view mode OR for page owners (who are always in edit mode) */}
      {(!isEditing || isOwner) && (
        <PageStats
          pageId={page.id}
          realTime={true}
          showSparklines={true}
        />
      )}

      {/* Construction chip removed */}
    </div>
  );
}