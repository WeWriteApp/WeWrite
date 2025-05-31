"use client";
import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { Button } from "../ui/button";
import { Edit, Save, X, Loader, AlertTriangle, History, Link } from "lucide-react";
import { rtdb } from "../../firebase/rtdb";
import { ref, update, get, push, child } from "firebase/database";
import { toast } from "../ui/use-toast";
import { recordGroupAboutEditActivity } from "../../firebase/bioActivity";
import dynamic from "next/dynamic";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "../utils/UnsavedChangesDialog";
import { AuthContext } from "../../providers/AuthProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import EmptyContentState from '../utils/EmptyContentState';
import { GroupAboutSkeleton } from "../ui/page-skeleton";
import { useFeatureFlag } from "../../utils/feature-flags";
import DisabledLinkModal from "../utils/DisabledLinkModal";
import TextView from "../editor/TextView";
import type { GroupAboutTabProps } from "../../types/components";
import type { SlateContent, Group } from "../../types/database";

// Import the unified editor dynamically to avoid SSR issues
const Editor = dynamic(() => import("../editor/Editor"), { ssr: false });

const GroupAboutTab: React.FC<GroupAboutTabProps> = ({ group, canEdit: propCanEdit }) => {
  // Check if the user is a member of the group
  const { user } = useContext(AuthContext);
  const [canEdit, setCanEdit] = useState<boolean>(propCanEdit);

  // Check if link functionality is enabled
  const linkFunctionalityEnabled = useFeatureFlag('link_functionality', user?.email);

  // State for disabled link modal
  const [showDisabledLinkModal, setShowDisabledLinkModal] = useState<boolean>(false);

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
  const editorRef = useRef<any>(null);

  // Track if content has changed
  const hasUnsavedChanges = isEditing && aboutContent !== originalContent;

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
      setIsEditing(false);

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
      setIsEditing(false);
    }
  };

  // Handle content change in the editor
  const handleContentChange = (content) => {
    setAboutContent(content);
  };

  // Handle inserting a link
  const handleInsertLink = () => {
    // Check if link functionality is enabled
    if (!linkFunctionalityEnabled) {
      console.log('[DEBUG] Link functionality is disabled, showing modal');
      setShowDisabledLinkModal(true);
      return;
    }

    if (editorRef.current) {
      console.log("[DEBUG] Editor ref exists, attempting to open link editor");

      // Focus the editor first
      try {
        editorRef.current.focus();
        console.log("[DEBUG] Editor focused successfully");
      } catch (focusError) {
        console.error("[DEBUG] Error focusing editor:", focusError);
      }

      // CRITICAL FIX: Try multiple approaches to ensure the link editor appears

      // 1. Try direct method call if available
      if (typeof editorRef.current.setShowLinkEditor === 'function') {
        console.log("[DEBUG] Using direct setShowLinkEditor method");
        editorRef.current.setShowLinkEditor(true);
      }

      // 2. Directly dispatch the custom event to show the link editor
      try {
        const event = new CustomEvent('show-link-editor', {
          detail: {
            position: {
              top: window.innerHeight / 2,
              left: window.innerWidth / 2,
            },
            initialTab: 'page',
            showLinkEditor: true,
            source: 'insert-link-button-group'
          }
        });
        document.dispatchEvent(event);
        console.log("[DEBUG] Directly dispatched show-link-editor event from group button");

        // 3. Force a global event as well
        window.dispatchEvent(new CustomEvent('linkEditorStateChange', {
          detail: {
            showLinkEditor: true
          }
        }));
      } catch (eventError) {
        console.error("[DEBUG] Error dispatching event:", eventError);

        // 4. Fallback to using the openLinkEditor method if available
        if (editorRef.current.openLinkEditor) {
          console.log("[DEBUG] Falling back to openLinkEditor method");
          try {
            // Open the link editor directly without creating a temporary link first
            // Pass "page" as the initial tab to show
            const result = editorRef.current.openLinkEditor("page");
            console.log("[DEBUG] openLinkEditor result:", result);
          } catch (error) {
            console.error("[DEBUG] Error opening link editor:", error);
            toast.error("Could not open link editor. Please try again.");
          }
        } else {
          console.error("[DEBUG] openLinkEditor method not available");
          toast.error("Link insertion is not available. Please try again later.");
        }
      }
    } else {
      console.error("Editor ref not available");
      toast.error("Editor is not ready. Please try again later.");
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (event) => {
    // Save on Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSave();
      toast.info("Saving changes...");
    }
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
      {/* Header with edit button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">About this group</h2>
        {/* Only show Edit button when there is content and not in edit mode */}
        {canEdit && !isEditing && aboutContent && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-1"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        )}
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
      <div className="bg-card rounded-lg border border-border p-4">
        {isEditing ? (
          <div>
            {/* Editor toolbar */}
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              {/* Insert Link button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleInsertLink}
                      variant="outline"
                      className={`flex items-center gap-1.5 bg-background/90 border-input ${
                        !linkFunctionalityEnabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={!linkFunctionalityEnabled}
                    >
                      <Link className="h-4 w-4" />
                      <span className="text-sm font-medium">Insert Link</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{linkFunctionalityEnabled ? 'Insert a link to a page or external site' : 'Link functionality is temporarily disabled'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Keyboard shortcut hint */}
              <div className="text-xs text-muted-foreground">
                Press <kbd className="px-1 py-0.5 bg-muted rounded border border-border">⌘</kbd>+<kbd className="px-1 py-0.5 bg-muted rounded border border-border">Enter</kbd> to save
              </div>
            </div>

            {/* Editor */}
            <div className="min-h-[300px]">
              <Editor
                ref={editorRef}
                initialContent={aboutContent}
                onChange={handleContentChange}
                placeholder="Write about this group..."
                contentType="about"
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {aboutContent ? (
              <div className="group">
                {/* Use TextView for the same interactive experience as normal pages */}
                <TextView
                  content={aboutContent}
                  canEdit={canEdit}
                  onActiveLine={() => {
                    // Enable editing when user clicks on a line
                    setIsEditing(true);
                  }}
                  showLineNumbers={false} // Group about doesn't need line numbers
                />
              </div>
            ) : (
              <EmptyContentState
                onActivate={() => setIsEditing(true)}
                isOwner={canEdit}
                ownerMessage="This group doesn't have a description yet."
                visitorMessage="This group doesn't have a description yet."
                message="to add a description"
                placeholder="Describe the purpose of this group, its goals, or guidelines for members."
              />
            )}
          </div>
        )}
      </div>

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

      {/* Disabled Link Modal */}
      <DisabledLinkModal
        isOpen={showDisabledLinkModal}
        onClose={() => setShowDisabledLinkModal(false)}
      />
    </div>
  );
};

export default GroupAboutTab;
