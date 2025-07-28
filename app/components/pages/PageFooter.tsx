"use client";

import React, { useState, useEffect } from "react";
import { PageActions } from "./PageActions";
import WordCounter from "../editor/WordCounter";
import PageStats from "./PageStats";
import CustomDateField from "./CustomDateField";
import LocationField from "./LocationField";
import dynamic from "next/dynamic";
import { Button } from "../ui/button";
import { Reply, Save, RotateCcw, Trash2, Check, Link } from "lucide-react";


// Dynamically import AddToPageButton to avoid SSR issues
const AddToPageButton = dynamic(() => import('../utils/AddToPageButton'), {
  ssr: false,
  loading: () => <div className="h-8 w-24 bg-muted animate-pulse rounded-md"></div>
});
// Removed old stats imports - now using UnifiedStatsService via PageStats component
import { useAuth } from '../../providers/AuthProvider';

interface PageData {
  id: string;
  title: string;
  userId: string;
  [key: string]: any;
}

interface PageFooterProps {
  page: PageData;
  content: any;
  isOwner: boolean;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onInsertLink: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  saveSuccess?: boolean;
  canEdit: boolean;
}

/**
 * PageFooter Component
 *
 * This component serves as a container for the PageActions component,
 * providing consistent styling and layout for the footer section of a page.
 *
 * UPDATED 2024: Now uses standardized page padding system
 *
 * The footer includes:
 * - A border at the top for visual separation
 * - Standardized px-4 padding to match page content alignment
 * - Consistent spacing with title and body elements
 * - Responsive padding that adjusts to different screen sizes
 * - Increased button sizes for better mobile usability
 *
 * STYLING STANDARDS:
 * - Uses px-4 horizontal padding (16px) to match page content
 * - All child elements inherit consistent page-level alignment
 * - Follows unified border and spacing system
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
 * @param {boolean} saveSuccess - Whether save was successful (for animation)
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
  saveSuccess = false,
  canEdit
}: PageFooterProps) {
  const { user } = useAuth();

  // Animation state for save card
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Handle save success animation
  useEffect(() => {
    if (saveSuccess && !hasUnsavedChanges) {
      // Start the minimize animation
      setIsAnimatingOut(true);

      // Reset animation state after animation completes
      const timer = setTimeout(() => {
        setIsAnimatingOut(false);
      }, 300); // Match the animation duration

      return () => clearTimeout(timer);
    } else {
      setIsAnimatingOut(false);
    }
  }, [saveSuccess, hasUnsavedChanges]);
  // Removed old stats fetching logic - now handled by UnifiedStatsService in PageStats component

  // Allow PageFooter to render for new pages and bios (where page is null)
  // Only return null if we're missing essential props
  if (!canEdit && !hasUnsavedChanges) return null;

  return (
    <div className="mt-10 border-t-only pt-6 pb-6 px-4">
      {/* Insert Link button - shown when editing */}
      {canEdit && isEditing && onInsertLink && (
        <div className="mb-4 flex justify-center w-full">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onInsertLink}
            disabled={isSaving}
          >
            <Link className="h-4 w-4" />
            Insert Link
          </Button>
        </div>
      )}



      {/* Show PageActions only for existing pages (not for new pages or bios) */}
      {page && (
        <div className="mb-6 flex flex-col w-full md:flex-row md:flex-wrap md:items-center md:justify-between gap-4">
          <PageActions
            page={page}
            content={content}
            isOwner={isOwner}
            isEditing={isEditing} // Pass actual editing state for consistency
            setIsEditing={setIsEditing}
            className="action-buttons-container"
            showFollowButton={user && !isOwner}
          />
        </div>
      )}

      {/* Similar pages section removed to conserve resources */}

      {/* Custom Date Field - show in both edit and view modes for existing pages only */}
      {page && (
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
                page.customDate = newDate;

                console.log('Custom date updated successfully to:', newDate);
              } catch (error) {
                console.error('Error updating custom date:', error);
                // TODO: Show user-friendly error message
              }
            }}
          />
        </div>
      )}

      {/* Location Field - show in both edit and view modes for existing pages only */}
      {page && (
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
                page.location = newLocation;

                console.log('Location updated successfully');
              } catch (error) {
                console.error('Error updating location:', error);
                // TODO: Show user-friendly error message
              }
            }}
          />
        </div>
      )}



      {/* Page stats section - show in view mode OR for page owners (who are always in edit mode) - existing pages only */}
      {page && (!isEditing || isOwner) && (
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