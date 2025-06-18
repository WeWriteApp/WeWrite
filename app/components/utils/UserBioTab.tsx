"use client";
import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { Button } from "../ui/button";
import { Edit, Save, X, Loader, AlertTriangle } from "lucide-react";
import { rtdb } from "../../firebase/rtdb";
import { ref, update, get } from "firebase/database";
import { toast } from "../ui/use-toast";
import { recordBioEditActivity } from "../../firebase/bioActivity";
import dynamic from "next/dynamic";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { AuthContext } from "../../providers/AuthProvider";

import EmptyContentState from './EmptyContentState';
import { UserBioSkeleton } from "../ui/page-skeleton";

import TextView from "../editor/TextView";
import HoverEditContent from './HoverEditContent';
import type { UserBioTabProps } from "../../types/components";
import type { SlateContent, User } from "../../types/database";
import { PageProvider } from "../../contexts/PageContext";

// Import the unified PageEditor component
const PageEditor = dynamic(() => import("../editor/PageEditor"), { ssr: false });

const UserBioTab: React.FC<UserBioTabProps> = ({ profile }) => {
  const { user } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [bioContent, setBioContent] = useState<SlateContent | string>(profile.bio || "");
  const [originalContent, setOriginalContent] = useState<SlateContent | string>(profile.bio || "");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEditor, setLastEditor] = useState<string | null>(null);
  const [lastEditTime, setLastEditTime] = useState<string | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);

  // Check if current user is the profile owner
  const isProfileOwner = user && profile && user.uid === profile.uid;

  // Track if content has changed
  const hasUnsavedChanges = isEditing && bioContent !== originalContent;

  // Enhanced setIsEditing function that captures click position
  const handleSetIsEditing = (editing: boolean, position: { x: number; y: number; clientX: number; clientY: number } | null = null) => {
    setIsEditing(editing);
    if (editing && position) {
      setClickPosition(position);
    } else if (!editing) {
      setClickPosition(null); // Clear position when exiting edit mode
    }
  };

  // Load the bio content from the database
  useEffect(() => {
    const fetchBioContent = async () => {
      try {
        setIsLoading(true);
        const userRef = ref(rtdb, `users/${profile.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();
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
      const userRef = ref(rtdb, `users/${profile.uid}`);

      // Ensure we're saving the content in the correct format
      // The Editor returns an array of nodes, which we want to preserve
      const contentToSave = bioContent;
      const editorName = user?.username || user?.displayName || user?.email || "Unknown";

      console.log("Saving bio content:", contentToSave);

      await update(userRef, {
        bio: contentToSave,
        bioLastEditor: editorName,
        bioLastEditTime: new Date().toISOString()
      });

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
      handleSetIsEditing(false);
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
      // No changes, just exit edit mode
      setBioContent(originalContent);
      handleSetIsEditing(false);
    }
  };

  // Handle content change in the editor
  const handleContentChange = (content) => {
    // Ensure we're storing the content in the correct format
    // If it's already an object/array, use it directly; otherwise stringify it
    setBioContent(content);
    console.log("Bio content updated:", content);
  };



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
    <div className="space-y-4">
      {/* Header - no standalone edit icon or duplicate buttons */}
      <div className="flex justify-end items-center">
        {/* Edit icon removed - now handled by hover-reveal in content area */}
        {/* Save/Cancel buttons removed - handled by PageEditor at bottom */}
      </div>

      {/* Content display or editor - unified container structure */}
      <div className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none">
        {isEditing ? (
          <div className="animate-in fade-in-0 duration-300">
            <PageProvider>
              <PageEditor
                  title="" // Bio doesn't have a title
                  setTitle={() => {}} // Bio doesn't have a title
                  initialContent={bioContent}
                  onContentChange={handleContentChange}
                  isPublic={true} // Bio is always public
                  setIsPublic={() => {}} // Bio doesn't have privacy settings
                  location={null} // Bio doesn't have location
                  setLocation={() => {}} // Bio doesn't have location
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onDelete={null} // Bio doesn't have delete functionality
                  isSaving={isLoading}
                  error={error || ""}
                  isNewPage={false}
                  clickPosition={clickPosition}
                  page={null} // Bio is not a page
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

      {/* Last edit info */}
      {lastEditor && lastEditTime && (
        <div className="text-xs text-muted-foreground mt-4">
          <p>Last edited by: {lastEditor} on {new Date(lastEditTime).toLocaleString()}</p>
        </div>
      )}

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        onClose={handleCloseDialog}
        onStayAndSave={handleStayAndSave}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        isSaving={isLoading || isHandlingNavigation}
      />


    </div>
  );
};

export default UserBioTab;
