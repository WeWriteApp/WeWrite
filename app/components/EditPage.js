"use client";
import React, { useEffect, useState, useContext, useCallback } from "react";
import { saveNewVersion, updateDoc } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { GroupsContext } from "../providers/GroupsProvider";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { useLogging } from "../providers/LoggingProvider";
import { X, Loader2 } from "lucide-react";
import { usePage } from "../contexts/PageContext";
import PageEditor from "./PageEditor";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "./UnsavedChangesDialog";

const EditPage = ({
  isEditing,
  setIsEditing,
  page,
  current,
  title,
  setTitle,
  editorError
}) => {
  const { setIsEditMode } = usePage();
  const [groupId, setGroupId] = useState(null);
  const [localGroups, setLocalGroups] = useState([]);
  const [isPublic, setIsPublic] = useState(page?.isPublic === true);
  const [location, setLocation] = useState(page?.location || null);
  const { user } = useContext(AuthContext);
  const groups = useContext(GroupsContext);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(editorError);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { logError } = useLogging();

  // Set edit mode in PageContext when component mounts
  useEffect(() => {
    setIsEditMode(true);
    return () => setIsEditMode(false);
  }, [setIsEditMode]);

  useEffect(() => {
    if (page?.groupId) {
      setGroupId(page.groupId);
    }

    // Update isPublic state when page changes
    if (page) {
      setIsPublic(page.isPublic === true);
    }
  }, [page]);

  useEffect(() => {
    if (!groups) return;
    if (groups.length > 0 && user?.groups) {
      let arr = [];
      Object.keys(user.groups).forEach((groupId) => {
        const group = groups.find((g) => g.id === groupId);
        if (group) {
          arr.push({
            id: groupId,
            name: group.name,
          });
        }
      });
      setLocalGroups(arr);
    }
  }, [groups, user?.groups]);

  const handleSelect = (item) => {
    setGroupId(item.id);
  };

  // Handle save action
  const handleSave = async (editorContent) => {
    if (!user) {
      setError("User not authenticated");
      return;
    }

    // Ensure we have valid editor content
    if (!editorContent || !Array.isArray(editorContent) || editorContent.length === 0) {
      setError("Invalid editor content. Please try again.");
      return;
    }

    // Check if content is just an empty paragraph - less strict validation
    if (editorContent.length === 0) {
      setError("Cannot save empty content");
      return;
    }

    // Show loading state immediately
    setIsSaving(true);
    setError(null); // Clear any previous errors

    // Add a loading overlay to indicate saving is in progress
    const addLoadingOverlay = () => {
      if (typeof window !== 'undefined') {
        // Remove any existing loading overlays first
        const existingOverlay = document.getElementById('save-loading-overlay');
        if (existingOverlay) {
          existingOverlay.remove();
        }

        // Create and add the new overlay
        const overlay = document.createElement('div');
        overlay.id = 'save-loading-overlay';
        overlay.className = 'fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
          <div class="bg-background rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div class="flex items-center justify-center gap-3">
              <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              <p class="text-lg font-medium">Saving your changes...</p>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
    };

    // Add the loading overlay
    addLoadingOverlay();

    // Maximum number of save attempts
    const maxAttempts = 3; // Increased to 3 attempts
    let currentAttempt = 0;
    let saveSuccessful = false;

    while (currentAttempt < maxAttempts && !saveSuccessful) {
      currentAttempt++;
      console.log(`Save attempt ${currentAttempt} of ${maxAttempts}`);

      try {
        console.log('Saving editor content:', editorContent);

        // Convert the editorState to JSON
        const editorStateJSON = JSON.stringify(editorContent);

        // Check if content has actually changed by comparing with the original content
        let contentChanged = true;
        if (page.content) {
          try {
            // Parse the original content for comparison
            const originalContent = typeof page.content === 'string'
              ? page.content
              : JSON.stringify(page.content);

            // Compare the stringified content
            contentChanged = originalContent !== editorStateJSON;

            if (!contentChanged) {
              console.log('Content unchanged, skipping version creation');
            }
          } catch (e) {
            console.error('Error comparing content:', e);
            // If there's an error in comparison, assume content has changed
            contentChanged = true;
          }
        }

        // First update the page metadata and content
        let updateTime = new Date().toISOString();
        console.log(`Updating page ${page.id} with new metadata and content`);

        // Update the page document first
        await updateDoc("pages", page.id, {
          title: title,
          isPublic: isPublic,
          groupId: groupId,
          location: location,
          lastModified: updateTime,
          // Also update content directly in the page document
          content: editorStateJSON
        });

        console.log('Page metadata and content updated successfully');

        // Only create a new version if content has actually changed
        let result = true;
        if (contentChanged) {
          console.log('Content changed, creating new version');
          // Then save the new version
          result = await saveNewVersion(page.id, {
            content: editorStateJSON,
            userId: user.uid,
            username: user.displayName || user.username,
            skipIfUnchanged: true
          });
          console.log('saveNewVersion result:', result);
        }

        if (result) {
          console.log('Page saved successfully');
          saveSuccessful = true;

          // Remove the loading overlay
          if (typeof window !== 'undefined') {
            const overlay = document.getElementById('save-loading-overlay');
            if (overlay) {
              overlay.remove();
            }
          }

          // Set isSaving to false and show success message
          setIsSaving(false);
          setError(null);

          // Show a success toast
          toast.success("Page saved successfully");

          // Use a more reliable approach to ensure UI updates before navigation
          // First, update the state and let React render the changes
          setTimeout(() => {
            // Then navigate to the page after the UI has updated
            window.location.href = `/${page.id}`;
          }, 100);

          return; // Exit the function on success
        } else {
          console.error(`Error saving new version on attempt ${currentAttempt}: result was falsy`);
          if (currentAttempt >= maxAttempts) {
            setError("Error saving new version. Please try again.");
          } else {
            console.log("Retrying save operation...");
            // Longer delay before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.error(`Error saving new version on attempt ${currentAttempt}:`, error);

        if (currentAttempt >= maxAttempts) {
          setError("Failed to save: " + (error.message || "Unknown error"));
          await logError(error, "EditPage.js");

          // Show error toast
          toast.error("Failed to save: " + (error.message || "Unknown error"));

          // Ensure isSaving is set to false on final error
          setIsSaving(false);
        } else {
          console.log("Retrying save operation after error...");
          // Longer delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // If we get here, all save attempts failed
    if (!saveSuccessful) {
      console.error("All save attempts failed");
      setError("Failed to save after multiple attempts. Please try again later.");

      // Show error toast
      toast.error("Failed to save. Please try again.");

      // Remove the loading overlay
      if (typeof window !== 'undefined') {
        const overlay = document.getElementById('save-loading-overlay');
        if (overlay) {
          overlay.remove();
        }
      }

      // Always ensure isSaving is set to false to reset the UI state
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  // Display error message if provided
  if (editorError) {
    return (
      <div className="bg-destructive/10 p-4 rounded-md mb-4">
        <p className="text-destructive font-medium">{editorError}</p>
        <p className="text-sm text-muted-foreground mt-2">Try refreshing the page or contact support if this issue persists.</p>
      </div>
    );
  }

  // State to track the current editor content
  const [editorContent, setEditorContent] = useState(current);
  const [hasContentChanged, setHasContentChanged] = useState(false);
  const [hasTitleChanged, setHasTitleChanged] = useState(false);
  const [hasVisibilityChanged, setHasVisibilityChanged] = useState(false);
  const [hasLocationChanged, setHasLocationChanged] = useState(false);

  // Track if there are any unsaved changes
  const hasUnsavedChanges = hasContentChanged || hasTitleChanged || hasVisibilityChanged || hasLocationChanged;

  // Memoized save function for the useUnsavedChanges hook
  const saveChanges = useCallback(() => {
    return handleSave(editorContent || current);
  }, [editorContent, current]);

  // Use the unsaved changes hook
  const {
    showUnsavedChangesDialog,
    handleNavigation,
    handleStayAndSave,
    handleLeaveWithoutSaving,
    handleCloseDialog,
    isHandlingNavigation
  } = useUnsavedChanges(hasUnsavedChanges, saveChanges);

  // Handle content changes
  const handleContentChange = (content) => {
    setEditorContent(content);

    // Check if content has changed from the original
    try {
      const originalContent = typeof page.content === 'string'
        ? page.content
        : JSON.stringify(page.content);
      const newContent = JSON.stringify(content);

      setHasContentChanged(originalContent !== newContent);
    } catch (e) {
      console.error('Error comparing content:', e);
      setHasContentChanged(true);
    }
  };

  // Handle title changes
  const handleTitleChange = (newTitle) => {
    setTitle(newTitle);
    setHasTitleChanged(newTitle !== page.title);
  };

  // Handle visibility changes
  const handleVisibilityChange = (newIsPublic) => {
    setIsPublic(newIsPublic);
    setHasVisibilityChanged(newIsPublic !== page.isPublic);
  };

  // Handle location changes
  const handleLocationChange = (newLocation) => {
    setLocation(newLocation);

    // Compare locations
    const originalLocation = page.location || null;
    const locationChanged = JSON.stringify(originalLocation) !== JSON.stringify(newLocation);
    setHasLocationChanged(locationChanged);
  };

  // Override the cancel handler to check for unsaved changes
  const handleCancelWithCheck = () => {
    if (hasUnsavedChanges) {
      handleNavigation('/');
    } else {
      handleCancel();
    }
  };

  return (
    <>
      <PageEditor
        title={title}
        setTitle={handleTitleChange}
        initialContent={current}
        onContentChange={handleContentChange}
        isPublic={isPublic}
        setIsPublic={handleVisibilityChange}
        location={location}
        setLocation={handleLocationChange}
        onSave={(content) => handleSave(content || editorContent || current)}
        onCancel={handleCancelWithCheck}
        isSaving={isSaving}
        error={error}
        isNewPage={false}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        onClose={handleCloseDialog}
        onStayAndSave={handleStayAndSave}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        isSaving={isSaving || isHandlingNavigation}
      />
    </>
  );
};

export default EditPage;