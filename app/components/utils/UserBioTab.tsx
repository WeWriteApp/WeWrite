"use client";
import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { Button } from "../ui/button";
import { Edit, Save, X, Loader, AlertTriangle } from "lucide-react";
import { getUserProfile } from "../../firebase/database/users";
import { toast } from "../ui/use-toast";
import { recordBioEditActivity } from "../../firebase/bioActivity";
import dynamic from "next/dynamic";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { useAuth } from '../../providers/AuthProvider';

import EmptyContentState from './EmptyContentState';
import { UserBioSkeleton } from "../ui/page-skeleton";

import TextView from "../editor/TextView";
import HoverEditContent from './HoverEditContent';
import PageFooter from "../pages/PageFooter";
import StickySaveHeader from "../layout/StickySaveHeader";
import type { UserBioTabProps } from "../../types/components";
import type { EditorContent, User } from "../../types/database";
import { PageProvider } from "../../contexts/PageContext";

// Import the unified ContentDisplay component
const ContentDisplay = dynamic(() => import("../content/ContentDisplay"), { ssr: false });

const UserBioTab: React.FC<UserBioTabProps> = ({ profile }) => {
  const { user } = useAuth();
  // Always editing mode - bio is always editable for the owner
  const isProfileOwner = user?.uid === profile.uid;
  const [isEditing, setIsEditing] = useState<boolean>(isProfileOwner); // Always true for owner
  const [bioContent, setBioContent] = useState<EditorContent | string>("");
  const [originalContent, setOriginalContent] = useState<EditorContent | string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEditor, setLastEditor] = useState<string | null>(null);
  const [lastEditTime, setLastEditTime] = useState<string | null>(null);

  // Link insertion trigger function
  const [linkInsertionTrigger, setLinkInsertionTrigger] = useState<(() => void) | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);

  // Track if content has changed
  const hasUnsavedChanges = isEditing && bioContent !== originalContent;

  // Enhanced setIsEditing function that captures click position
  // For always-editing mode, this doesn't change the editing state for owners
  const handleSetIsEditing = (editing: boolean, position: { x: number; y: number; clientX: number; clientY: number } | null = null) => {
    if (!isProfileOwner) {
      setIsEditing(editing); // Only change for non-owners (visitors)
    }
    if (editing && position) {
      setClickPosition(position);
    } else if (!editing) {
      setClickPosition(null); // Clear position when exiting edit mode
    }
  };

  // Load the bio content from the database using API route
  useEffect(() => {
    const fetchBioContent = async () => {
      try {
        setIsLoading(true);

        // Use API route for bio loading to handle environment-aware operations
        const response = await fetch(`/api/users/${profile.uid}/bio`);

        if (response.ok) {
          const bioResponse = await response.json();
          const bioData = bioResponse.data; // Extract data from API response

          if (bioData.bio) {
            setBioContent(bioData.bio);
            setOriginalContent(bioData.bio);
          }
          if (bioData.bioLastEditor) {
            setLastEditor(bioData.bioLastEditor);
          }
          if (bioData.bioLastEditTime) {
            setLastEditTime(bioData.bioLastEditTime);
          }
        } else {
          // Fallback to getUserProfile if API route fails
          console.warn('API route failed, falling back to getUserProfile');
          const userData = await getUserProfile(profile.uid);

          if (userData) {
            if (userData.bio) {
              setBioContent(userData.bio);
              setOriginalContent(userData.bio);
            }
            if (userData.bioLastEditor) {
              setLastEditor(userData.bioLastEditor);
            }
            if (userData.bioLastEditTime) {
              setLastEditTime(userData.bioLastEditTime);
            }
          } else {
            console.warn(`No user data found for uid: ${profile.uid}`);
            setError("User profile not found. This may be a development environment issue.");
          }
        }
      } catch (err) {
        console.error("Error fetching user bio content:", err);
        setError("Failed to load user information. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBioContent();
  }, [profile.uid]);

  // Handle saving the bio content
  const handleSave = async () => {
    try {
      setIsLoading(true);

      // Ensure we're saving the content in the correct format
      // The Editor returns an array of nodes, which we want to preserve
      const contentToSave = bioContent;
      const editorName = user?.username || user?.displayName || user?.email || "Unknown";

      console.log("Saving bio content:", contentToSave);

      // Use API route for bio updates to handle environment-aware operations
      const response = await fetch(`/api/users/${profile.uid}/bio`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bio: contentToSave,
          editorName: editorName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save bio');
      }

      const result = await response.json();

      // Record the bio edit activity for the activity feed
      if (user) {
        try {
          await recordBioEditActivity(
            profile.uid,
            user.uid,
            editorName,
            contentToSave,
            originalContent
          );
          console.log("Bio edit activity recorded successfully");
        } catch (activityError) {
          console.error("Error recording bio edit activity:", activityError);
          // Continue even if activity recording fails
        }
      }

      setOriginalContent(contentToSave);
      // Don't exit editing mode for owners (always-editing mode)
      if (!isProfileOwner) {
        handleSetIsEditing(false);
      }
      setLastEditor(editorName);
      setLastEditTime(new Date().toISOString());

      return true; // Indicate success for the useUnsavedChanges hook
    } catch (err) {
      console.error("Error updating user bio content:", err);
      setError("Failed to save changes. Please try again.");
      toast.error("Failed to update bio");
      return false; // Indicate failure for the useUnsavedChanges hook
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized save function for the useUnsavedChanges hook
  const saveChanges = useCallback(() => {
    return handleSave();
  }, [bioContent]);

  // Use the unsaved changes hook
  const {
    showUnsavedChangesDialog,
    handleNavigation,
    handleStayAndSave,
    handleLeaveWithoutSaving,
    handleCloseDialog,
    isHandlingNavigation
  } = useUnsavedChanges(hasUnsavedChanges, saveChanges);

  // Handle canceling edits with unsaved changes check
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      // Show confirmation dialog
      handleNavigation('/');
    } else {
      // No changes, just revert content (stay in editing mode for owners)
      setBioContent(originalContent);
      if (!isProfileOwner) {
        handleSetIsEditing(false);
      }
    }
  };

  // Handle content change in the editor
  const handleContentChange = (content) => {
    // Ensure we're storing the content in the correct format
    // If it's already an object/array, use it directly; otherwise stringify it
    setBioContent(content);
    console.log("Bio content updated:", content);
  };

  // Keyboard shortcuts for bio editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isProfileOwner && hasUnsavedChanges && !isLoading) {
          handleSave();
        }
      }

      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isProfileOwner && hasUnsavedChanges && !isLoading) {
          handleSave();
        }
      }

      // Escape to cancel (revert changes)
      if (e.key === 'Escape' && isProfileOwner) {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProfileOwner, hasUnsavedChanges, isLoading, handleSave, handleCancel]);

  // Handle link insertion request - memoized to prevent infinite loops
  const handleInsertLinkRequest = useCallback((triggerFn) => {
    setLinkInsertionTrigger(() => triggerFn);
  }, []);

  if (isLoading && !bioContent) {
    return (
      <div className="py-8">
        <UserBioSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Something went wrong</h3>
        <p className="text-muted-foreground text-center mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Sticky Save Header - slides down from top when there are unsaved changes */}
      <StickySaveHeader
        hasUnsavedChanges={hasUnsavedChanges && isProfileOwner}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={isLoading}
        isAnimatingOut={false}
      />

      <div className="space-y-4">
        {/* Header - no standalone edit icon or duplicate buttons */}
        <div className="flex justify-end items-center">
          {/* Edit icon removed - now handled by hover-reveal in content area */}
          {/* Save/Cancel buttons removed - handled by PageEditor at bottom */}
        </div>

      {/* Content display or editor - unified container structure */}
      <div className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none">
        {isProfileOwner ? (
          <div className="animate-in fade-in-0 duration-300">
            <PageProvider>
              <ContentDisplay
                  content={bioContent}
                  isEditable={true}
                  onChange={handleContentChange}
                  isSaving={isLoading}
                  error={error || ""}
                  placeholder="Write your bio..."
                  showToolbar={false}
                  onInsertLinkRequest={handleInsertLinkRequest}
                  // Remove onSave and onCancel - handled by bottom save bar
                />

              {/* Page Footer with bottom save bar */}
              <PageFooter
                page={null} // Bio doesn't have page data
                content={bioContent}
                linkedPageIds={[]} // Bio doesn't have linked pages
                isEditing={isEditing}
                canEdit={isProfileOwner}
                isOwner={isProfileOwner}
                title="" // Bio doesn't have a title
                location={null} // Bio doesn't have location
                onTitleChange={() => {}} // Bio doesn't have title
                onLocationChange={() => {}} // Bio doesn't have location
                onSave={async () => {
                  const success = await handleSave();
                  return success;
                }}
                onCancel={handleCancel}
                onDelete={null} // Bio doesn't have delete
                onInsertLink={() => linkInsertionTrigger && linkInsertionTrigger()}
                isSaving={isLoading}
                error={error}
                titleError={false}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            </PageProvider>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {bioContent ? (
              <HoverEditContent
                content={bioContent}
                canEdit={isProfileOwner}
                setIsEditing={handleSetIsEditing}
                showLineNumbers={false} // Bio doesn't need line numbers
              />
            ) : (
              <EmptyContentState
                onActivate={() => handleSetIsEditing(true)}
                isOwner={isProfileOwner}
                ownerMessage="You haven't added a bio yet."
                visitorMessage={`${profile.username || "This user"} hasn't added a bio yet.`}
                placeholder="Share information about yourself, your interests, or your background."
              />
            )}
          </div>
        )}
      </div>

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          isOpen={showUnsavedChangesDialog}
          onClose={handleCloseDialog}
          onStayAndSave={handleStayAndSave}
          onLeaveWithoutSaving={handleLeaveWithoutSaving}
          isSaving={isLoading || isHandlingNavigation}
        />

      </div>
    </>
  );
};

export default UserBioTab;