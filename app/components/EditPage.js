"use client";
import React, { useEffect, useState, useContext } from "react";
import { saveNewVersion, updateDoc } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { GroupsContext } from "../providers/GroupsProvider";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { useLogging } from "../providers/LoggingProvider";
import { X, Loader2 } from "lucide-react";
import { usePage } from "../contexts/PageContext";
import PageEditor from "./PageEditor";

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

          // Add a minimal delay before redirecting to ensure Firebase has time to update
          await new Promise(resolve => setTimeout(resolve, 300));

          // Force reload the page to show the updated content
          window.location.href = `/${page.id}`;
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

      // Remove the loading overlay
      if (typeof window !== 'undefined') {
        const overlay = document.getElementById('save-loading-overlay');
        if (overlay) {
          overlay.remove();
        }
      }
    }

    setIsSaving(false);
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

  return (
    <PageEditor
      title={title}
      setTitle={setTitle}
      initialContent={current}
      onContentChange={(content) => {
        // Store the updated content in state
        console.log('Content updated in EditPage');
        setEditorContent(content);
      }}
      isPublic={isPublic}
      setIsPublic={setIsPublic}
      location={location}
      setLocation={setLocation}
      onSave={(content) => handleSave(content || editorContent || current)}
      onCancel={handleCancel}
      isSaving={isSaving}
      error={error}
      isNewPage={false}
    />
  );
};

export default EditPage;