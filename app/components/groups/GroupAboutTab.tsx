"use client";
import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { Button } from "../ui/button";
import { Edit, Save, X, Loader, AlertTriangle, History } from "lucide-react";
import { rtdb } from "../../firebase/rtdb";
import { ref, update, get, push, child } from "firebase/database";
import { toast } from "../ui/use-toast";
import { recordGroupAboutEditActivity } from "../../firebase/bioActivity";
import dynamic from "next/dynamic";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "../utils/UnsavedChangesDialog";
import { AuthContext } from "../../providers/AuthProvider";

import EmptyContentState from '../utils/EmptyContentState';
import { GroupAboutSkeleton } from "../ui/page-skeleton";

import TextView from "../editor/TextView";
import HoverEditContent from '../utils/HoverEditContent';
import type { GroupAboutTabProps } from "../../types/components";
import type { SlateContent, Group } from "../../types/database";
import { PageProvider } from "../../contexts/PageContext";
import { LineSettingsProvider } from "../../contexts/LineSettingsContext";

// Import the unified PageEditor component
const PageEditor = dynamic(() => import("../editor/PageEditor"), { ssr: false });

const GroupAboutTab: React.FC<GroupAboutTabProps> = ({ group, canEdit: propCanEdit }) => {
  // Check if the user is a member of the group
  const { user } = useContext(AuthContext);
  const [canEdit, setCanEdit] = useState<boolean>(propCanEdit);



  // Check if the user is a member of the group
  useEffect(() => {
    if (user && group && group.members && group.members[user.uid]) {
      // User is a member of the group, allow editing
      setCanEdit(true);
    } else {
      // Use the prop value for admins/owners
      setCanEdit(propCanEdit);
    }
  }, [user, group, propCanEdit]);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [aboutContent, setAboutContent] = useState<SlateContent | string>(group.about || "");
  const [originalContent, setOriginalContent] = useState<SlateContent | string>(group.about || "");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEditor, setLastEditor] = useState<string | null>(group.aboutLastEditor || null);
  const [lastEditTime, setLastEditTime] = useState<string | null>(group.aboutLastEditTime || null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);

  // Track if content has changed
  const hasUnsavedChanges = isEditing && aboutContent !== originalContent;

  // Enhanced setIsEditing function that captures click position
  const handleSetIsEditing = (editing: boolean, position: { x: number; y: number; clientX: number; clientY: number } | null = null) => {
    setIsEditing(editing);
    if (editing && position) {
      setClickPosition(position);
    } else if (!editing) {
      setClickPosition(null); // Clear position when exiting edit mode
    }
  };

  // Load the about content from the database
  useEffect(() => {
    const fetchAboutContent = async () => {
      try {
        setIsLoading(true);
        const groupRef = ref(rtdb, `groups/${group.id}`);
        const snapshot = await get(groupRef);

        if (snapshot.exists()) {
          const groupData = snapshot.val();
          if (groupData.about) {
            setAboutContent(groupData.about);
            setOriginalContent(groupData.about);
          }
          if (groupData.aboutLastEditor) {
            setLastEditor(groupData.aboutLastEditor);
          }
          if (groupData.aboutLastEditTime) {
            setLastEditTime(groupData.aboutLastEditTime);
          }
        }
      } catch (err) {
        console.error("Error fetching group about content:", err);
        setError("Failed to load group information. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAboutContent();
  }, [group.id]);

  // Handle saving the about content
  const handleSave = async () => {
    try {
      setIsLoading(true);
      const groupRef = ref(rtdb, `groups/${group.id}`);
      const currentTime = new Date().toISOString();
      const editorName = user?.username || user?.displayName || user?.email || "Unknown";

      // Save the current version to history
      if (originalContent) {
        const historyRef = child(groupRef, "aboutHistory");
        await push(historyRef, {
          content: originalContent,
          editor: lastEditor || "Unknown",
          timestamp: lastEditTime || group.createdAt || currentTime
        });
      }

      // Update the group with new content and metadata
      await update(groupRef, {
        about: aboutContent,
        aboutLastEditor: editorName,
        aboutLastEditTime: currentTime
      });

      // Record the group about edit activity for the activity feed
      if (user) {
        try {
          // Get the group's privacy setting
          const groupSnapshot = await get(groupRef);
          const isPublic = groupSnapshot.exists() ?
            (groupSnapshot.val().isPublic === true) : false;

          await recordGroupAboutEditActivity(
            group.id,
            user.uid,
            editorName,
            aboutContent,
            originalContent,
            isPublic
          );
          console.log("Group about edit activity recorded successfully");
        } catch (activityError) {
          console.error("Error recording group about edit activity:", activityError);
          // Continue even if activity recording fails
        }
      }

      setOriginalContent(aboutContent);
      setLastEditor(editorName);
      setLastEditTime(currentTime);
      handleSetIsEditing(false);

      toast.success("Group information updated successfully");
      return true; // Indicate success for the useUnsavedChanges hook
    } catch (err) {
      console.error("Error updating group about content:", err);
      setError("Failed to save changes. Please try again.");
      toast.error("Failed to update group information");
      return false; // Indicate failure for the useUnsavedChanges hook
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized save function for the useUnsavedChanges hook
  const saveChanges = useCallback(() => {
    return handleSave();
  }, [aboutContent, user, lastEditor, lastEditTime]);

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
      setAboutContent(originalContent);
      handleSetIsEditing(false);
    }
  };

  // Handle content change in the editor
  const handleContentChange = (content) => {
    setAboutContent(content);
  };



  if (isLoading && !aboutContent) {
    return (
      <div className="py-8">
        <GroupAboutSkeleton />
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
      {/* Header - no standalone edit icon */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">About this group</h2>
        {/* Edit icon removed - now handled by hover-reveal in content area */}
        {isEditing && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="gap-1"
              disabled={isLoading || isHandlingNavigation}
            >
              {isLoading || isHandlingNavigation ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Content display or editor */}
      {isEditing ? (
        <div className="animate-in fade-in-0 duration-300">
          <PageProvider>
            <LineSettingsProvider>
              <PageEditor
                title="" // Group about doesn't have a title
                setTitle={() => {}} // Group about doesn't have a title
                initialContent={aboutContent}
                onContentChange={handleContentChange}
                isPublic={group.isPublic || false} // Use group's privacy setting
                setIsPublic={() => {}} // Group about doesn't have privacy settings
                location={null} // Group about doesn't have location
                setLocation={() => {}} // Group about doesn't have location
                onSave={handleSave}
                onCancel={handleCancel}
                onDelete={null} // Group about doesn't have delete functionality
                isSaving={isLoading}
                error={error || ""}
                isNewPage={false}
                clickPosition={clickPosition}
                page={null} // Group about is not a page
              />
            </LineSettingsProvider>
          </PageProvider>
        </div>
      ) : (
        <div className="prose dark:prose-invert max-w-none">
          {aboutContent ? (
            <HoverEditContent
              content={aboutContent}
              canEdit={canEdit}
              setIsEditing={handleSetIsEditing}
              showLineNumbers={false} // Group about doesn't need line numbers
            />
          ) : (
            <EmptyContentState
              onActivate={() => handleSetIsEditing(true)}
              isOwner={canEdit}
              ownerMessage="This group doesn't have a description yet."
              visitorMessage="This group doesn't have a description yet."
              message="to add a description"
              placeholder="Describe the purpose of this group, its goals, or guidelines for members."
            />
          )}
        </div>
      )}

      {/* Group info and last editor */}
      <div className="text-xs text-muted-foreground mt-4 space-y-1">
        <p>Group created: {new Date(group.createdAt).toLocaleDateString()}</p>
        {lastEditor && lastEditTime && (
          <p>Last edited by: {lastEditor} on {new Date(lastEditTime).toLocaleString()}</p>
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
  );
};

export default GroupAboutTab;
