"use client";
import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { Button } from "./ui/button";
import { Edit, Save, X, Loader, AlertTriangle, Link } from "lucide-react";
import { rtdb } from "../firebase/rtdb";
import { ref, update, get } from "firebase/database";
import { toast } from "./ui/use-toast";
import dynamic from "next/dynamic";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { AuthContext } from "../providers/AuthProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

// Import the unified editor dynamically to avoid SSR issues
const UnifiedEditor = dynamic(() => import("./UnifiedEditor"), { ssr: false });

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
      // The UnifiedEditor returns an array of nodes, which we want to preserve
      const contentToSave = bioContent;

      console.log("Saving bio content:", contentToSave);

      await update(userRef, {
        bio: contentToSave,
        bioLastEditor: user?.username || user?.displayName || user?.email || "Unknown",
        bioLastEditTime: new Date().toISOString()
      });

      setOriginalContent(contentToSave);
      setIsEditing(false);
      setLastEditor(user?.username || user?.displayName || user?.email || "Unknown");
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
    if (editorRef.current) {
      console.log("[DEBUG] Editor ref exists, attempting to open link editor");

      // Focus the editor first
      try {
        editorRef.current.focus();
        console.log("[DEBUG] Editor focused successfully");
      } catch (focusError) {
        console.error("[DEBUG] Error focusing editor:", focusError);
      }

      // Use the openLinkEditor method we added to the UnifiedEditor
      if (editorRef.current.openLinkEditor) {
        console.log("[DEBUG] Using openLinkEditor method");
        try {
          // Open the link editor directly without creating a temporary link first
          const result = editorRef.current.openLinkEditor();
          console.log("[DEBUG] openLinkEditor result:", result);

          // Force a custom event to ensure the link editor appears
          setTimeout(() => {
            try {
              const event = new CustomEvent('show-link-editor', {
                detail: {
                  source: 'insert-link-button-bio'
                }
              });
              document.dispatchEvent(event);
              console.log("[DEBUG] Dispatched show-link-editor event from bio button");
            } catch (eventError) {
              console.error("[DEBUG] Error dispatching event:", eventError);
            }
          }, 50);
        } catch (error) {
          console.error("[DEBUG] Error opening link editor:", error);
          toast.error("Could not open link editor. Please try again.");
        }
      } else {
        console.error("[DEBUG] openLinkEditor method not available");
        toast.error("Link insertion is not available. Please try again later.");
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
      <div className="flex justify-center items-center py-12">
        <Loader className="h-8 w-8 animate-spin text-primary" />
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
        <h2 className="text-xl font-semibold">About {profile.username || "this user"}</h2>
        {isProfileOwner && !isEditing && (
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
                      className="flex items-center gap-1.5 bg-background/90 border-input"
                    >
                      <Link className="h-4 w-4" />
                      <span className="text-sm font-medium">Insert Link</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Insert a link to a page or external site</p>
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
              <UnifiedEditor
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
              <div className="text-muted-foreground italic">
                {isProfileOwner
                  ? "You haven't added a bio yet. Click Edit to add one."
                  : "This user hasn't added a bio yet."}
              </div>
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
}
