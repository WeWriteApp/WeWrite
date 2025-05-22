"use client";
import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { Button } from "./ui/button";
import { Edit, Save, X, Loader, AlertTriangle, Link } from "lucide-react";
import { rtdb } from "../firebase/rtdb";
import { ref, update, get } from "firebase/database";
import { toast } from "./ui/use-toast";
import { recordBioEditActivity } from "../firebase/bioActivity";
import dynamic from "next/dynamic";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { AuthContext } from "../providers/AuthProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import EmptyContentState from "./EmptyContentState";
import { UserBioSkeleton } from "./ui/page-skeleton";
import { useFeatureFlag } from "../utils/feature-flags";
import DisabledLinkModal from "./DisabledLinkModal";

// Import the unified editor dynamically to avoid SSR issues
const Editor = dynamic(() => import("./Editor"), { ssr: false });

export default function UserBioTab({ profile }) {
  const { user } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [bioContent, setBioContent] = useState(profile.bio || "");
  const [originalContent, setOriginalContent] = useState(profile.bio || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastEditor, setLastEditor] = useState(null);
  const [lastEditTime, setLastEditTime] = useState(null);
  const editorRef = useRef(null);

  // Check if link functionality is enabled
  const linkFunctionalityEnabled = useFeatureFlag('link_functionality', user?.email);

  // State for disabled link modal
  const [showDisabledLinkModal, setShowDisabledLinkModal] = useState(false);

  // Check if current user is the profile owner
  const isProfileOwner = user && profile && user.uid === profile.uid;

  // Track if content has changed
  const hasUnsavedChanges = isEditing && bioContent !== originalContent;

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
      setIsEditing(false);
      setLastEditor(editorName);
      setLastEditTime(new Date().toISOString());

      toast.success("Bio updated successfully");
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
      setIsEditing(false);
    }
  };

  // Handle content change in the editor
  const handleContentChange = (content) => {
    // Ensure we're storing the content in the correct format
    // If it's already an object/array, use it directly; otherwise stringify it
    setBioContent(content);
    console.log("Bio content updated:", content);
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
            source: 'insert-link-button-bio'
          }
        });
        document.dispatchEvent(event);
        console.log("[DEBUG] Directly dispatched show-link-editor event from bio button");

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
      console.error("[DEBUG] Editor ref not available");
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
      {/* Header with edit button */}
      <div className="flex justify-end items-center">
        {/* Only show Edit button when there is content and not in edit mode */}
        {isProfileOwner && !isEditing && bioContent && (
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
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="gap-1"
              disabled={isLoading}
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Saving..." : "Save"}
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
                initialContent={bioContent}
                onChange={handleContentChange}
                placeholder="Write about yourself..."
                contentType="bio"
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {bioContent ? (
              <div>
                {typeof bioContent === 'string' ? (
                  // If it's a string, render it as HTML (legacy format)
                  <div dangerouslySetInnerHTML={{ __html: bioContent }} />
                ) : Array.isArray(bioContent) ? (
                  // If it's an array (Slate format), render it properly
                  <div className="unified-editor-content">
                    {bioContent.map((node, i) => {
                      if (node.type === 'paragraph') {
                        return (
                          <p key={i} className="mb-4">
                            {node.children.map((child, j) => {
                              if (child.type === 'link') {
                                return (
                                  <a
                                    key={j}
                                    href={child.url}
                                    className="slate-pill-link"
                                    target={child.isExternal ? "_blank" : undefined}
                                    rel={child.isExternal ? "noopener noreferrer" : undefined}
                                  >
                                    {child.children[0]?.text || child.url}
                                  </a>
                                );
                              }
                              return <span key={j}>{child.text}</span>;
                            })}
                          </p>
                        );
                      }
                      return null;
                    })}
                  </div>
                ) : (
                  // If it's an object but not in the expected format, display a message
                  <div className="text-muted-foreground">
                    Content format not recognized. Please edit to update.
                  </div>
                )}
              </div>
            ) : (
              <EmptyContentState
                onActivate={() => setIsEditing(true)}
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

      {/* Disabled Link Modal */}
      <DisabledLinkModal
        isOpen={showDisabledLinkModal}
        onClose={() => setShowDisabledLinkModal(false)}
      />
    </div>
  );
}
