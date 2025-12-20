"use client";

import React, { useState, useEffect } from "react";
import ContentPageActions from "./ContentPageActions";
import WordCounter from "../editor/WordCounter";
import ContentPageStats from "./ContentPageStats";
import SameTitlePages from "./SameTitlePages";
import CustomDateField from "./CustomDateField";
import LocationField from "./LocationField";
import dynamic from "next/dynamic";
import { Button } from "../ui/button";
import { Reply, Save, RotateCcw, Trash2, Check, Link } from "lucide-react";
import { useToast } from "../ui/use-toast";


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
  isNewPage?: boolean;
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
  onLocationChange?: (location: any) => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  saveSuccess?: boolean;
  canEdit: boolean;
  showLinkSuggestions?: boolean;
  isLoadingSuggestions?: boolean;
  onToggleLinkSuggestions?: (enabled: boolean) => void;
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
export default function ContentPageFooter({
  page,
  content,
  isOwner,
  isEditing,
  setIsEditing,
  onSave,
  onCancel,
  onDelete,
  onInsertLink,
  onLocationChange,
  isSaving,
  hasUnsavedChanges,
  saveSuccess = false,
  canEdit,
  showLinkSuggestions = false,
  isLoadingSuggestions = false,
  onToggleLinkSuggestions
}: PageFooterProps) {
  const { user } = useAuth();
  const { toast } = useToast();

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
  // Don't return null - we want to show location card and stats even for non-owners

  return (
    <div className="pb-4 px-4 space-y-4">
      {/* Show PageActions for editors (when editing) */}
      {page && canEdit && (
        <ContentPageActions
          page={page}
          content={content}
          isOwner={isOwner}
          isEditing={isEditing} // Pass actual editing state for consistency
          setIsEditing={setIsEditing}
          className="action-buttons-container"
          showFollowButton={user && !isOwner}
          onInsertLink={onInsertLink} // Pass insert link callback
          isSaving={isSaving} // Pass saving state
          showLinkSuggestions={showLinkSuggestions}
          isLoadingSuggestions={isLoadingSuggestions}
          onToggleLinkSuggestions={onToggleLinkSuggestions}
        />
      )}

      {/* Show Reply and Add to Page actions for non-owners ABOVE the stats */}
      {page && !isOwner && !canEdit && (
        <ContentPageActions
          page={page}
          content={content}
          isOwner={false}
          isEditing={false}
          setIsEditing={() => {}}
          className="action-buttons-container"
          showFollowButton={!!user}
        />
      )}

      {/* Page metadata and stats section - show for all existing pages */}
      {page && (
        <>
          {/* Custom Date and Location in a grid - hide on others' pages if both are empty */}
          {(isOwner || page.customDate || page.location) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Show custom date if owner OR if it has a value */}
              {(isOwner || page.customDate) && (
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
                      toast({
                        title: "Failed to update date",
                        description: "There was a problem saving the date. Please try again.",
                        variant: "destructive"
                      });
                    }
                  }}
                />
              )}
              {/* Show location if owner OR if it has a value */}
              {(isOwner || page.location) && (
                <LocationField
                  location={page.location}
                  canEdit={isOwner}
                  onLocationChange={onLocationChange}
                  pageId={page.id}
                />
              )}
            </div>
          )}

          {/* Page stats section - hide for new unsaved pages */}
          {!page.isNewPage && (
            <ContentPageStats
              pageId={page.id}
              realTime={true}
              showSparklines={true}
            />
          )}

          {/* Same title pages section - show other users who wrote about this topic */}
          {!page.isNewPage && page.title && (
            <SameTitlePages
              pageId={page.id}
              pageTitle={page.title}
            />
          )}
        </>
      )}

      {/* Construction chip removed */}
    </div>
  );
}