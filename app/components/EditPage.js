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
import EditModeBottomToolbar from "./EditModeBottomToolbar";
import { toast } from "./ui/use-toast";
import { validateLink } from "../utils/linkValidator";

const EditPage = ({
  isEditing,
  setIsEditing,
  page,
  current,
  title,
  setTitle,
  editorError,
  clickPosition = null
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
  const handleSave = async (inputContent) => {
    console.log("EditPage handleSave called with content:", {
      contentType: typeof inputContent,
      isArray: Array.isArray(inputContent),
      length: Array.isArray(inputContent) ? inputContent.length : 0
    });

    if (!user) {
      setError("User not authenticated");
      return;
    }

    // CRITICAL FIX: Make a deep copy of the editor content to prevent reference issues
    // Use a different variable name to avoid conflicts
    let safeContent;
    try {
      // MAJOR FIX: Completely rewritten content processing to ensure links are properly saved
      // This addresses issues with links disappearing in view mode

      // First, ensure we're working with an array
      const contentArray = Array.isArray(inputContent) ? inputContent : [inputContent];

      // Process the content to ensure all links are properly validated before saving
      const processedContent = contentArray.map(node => {
        // Skip null or undefined nodes
        if (!node) return node;

        // Process each node to ensure links are properly validated
        if (node.type === 'paragraph' && node.children) {
          // Process children to validate any links
          const processedChildren = node.children.map(child => {
            // Skip null or undefined children
            if (!child) return child;

            if (child.type === 'link') {
              // Validate the link to ensure all required properties are present
              try {
                console.log('EditPage: Processing link before save:', JSON.stringify(child));

                // CRITICAL FIX: Ensure link has all required properties
                // This is especially important for links to render correctly in view mode
                const validatedLink = validateLink(child);

                // CRITICAL FIX: Ensure the link has a unique ID to prevent React key issues
                if (!validatedLink.id) {
                  validatedLink.id = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }

                // CRITICAL FIX: Ensure the link has proper children structure
                if (!validatedLink.children || !Array.isArray(validatedLink.children) || validatedLink.children.length === 0) {
                  validatedLink.children = [{ text: validatedLink.displayText || 'Link' }];
                }

                // Log the validated link for debugging
                console.log('EditPage: Validated link for save:', JSON.stringify(validatedLink));
                return validatedLink;
              } catch (linkError) {
                console.error('EditPage - Error validating link:', linkError);
                // Create a minimal valid link as fallback
                return {
                  type: 'link',
                  url: child.url || '#',
                  children: [{ text: child.displayText || child.children?.[0]?.text || 'Link (Error)' }],
                  displayText: child.displayText || child.children?.[0]?.text || 'Link (Error)',
                  className: 'error-link',
                  linkVersion: 2,
                  isError: true,
                  id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };
              }
            }
            return child;
          }).filter(Boolean); // Remove any null/undefined children

          // Return the node with processed children
          return { ...node, children: processedChildren };
        }
        return node;
      }).filter(Boolean); // Remove any null/undefined nodes

      // CRITICAL FIX: Make a deep copy to avoid reference issues
      // Use a more robust method to ensure deep copying works correctly
      safeContent = JSON.parse(JSON.stringify(processedContent));

      // Verify the content structure after processing
      console.log('EditPage: Content structure after processing:',
        Array.isArray(safeContent) ? `Array with ${safeContent.length} items` : typeof safeContent);
    } catch (error) {
      console.error('Error processing content:', error);
      // Fallback to the original content with basic validation
      try {
        // Try to at least ensure we have a valid array
        const fallbackContent = Array.isArray(inputContent) ? inputContent : [inputContent];
        safeContent = JSON.parse(JSON.stringify(fallbackContent));
      } catch (fallbackError) {
        console.error('Critical error in content processing fallback:', fallbackError);
        // Last resort fallback - create a minimal valid content structure
        safeContent = [{ type: 'paragraph', children: [{ text: 'Content could not be processed properly.' }] }];
      }
    }

    // Ensure we have valid editor content
    if (!safeContent || !Array.isArray(safeContent) || safeContent.length === 0) {
      setError("Invalid editor content. Please try again.");
      console.error("Invalid editor content:", safeContent);
      return;
    }

    // Check if content is just an empty paragraph - less strict validation
    if (safeContent.length === 0) {
      setError("Cannot save empty content");
      return;
    }

    // Store the content we're about to save for debugging
    console.log("About to save editor content:", JSON.stringify(safeContent));

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
        console.log('Saving editor content:', safeContent);

        // CRITICAL FIX: Make another deep copy just to be extra safe
        const finalContent = JSON.parse(JSON.stringify(safeContent));

        // Convert the editorState to JSON
        const editorStateJSON = JSON.stringify(finalContent);

        // CRITICAL FIX: Log the JSON string for debugging
        console.log('Editor state JSON length:', editorStateJSON.length);

        // Log the JSON string for debugging
        console.log('Editor state JSON:', editorStateJSON);

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
            console.log('Content comparison:', { originalLength: originalContent.length, newLength: editorStateJSON.length, changed: contentChanged });

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
          // CRITICAL FIX: Ensure we're passing a valid JSON string
          // Double-check that editorStateJSON is a valid JSON string
          try {
            // Validate that it's a proper JSON string by parsing it
            const parsedContent = JSON.parse(editorStateJSON);
            console.log("Content validated before saving:", {
              isArray: Array.isArray(parsedContent),
              length: Array.isArray(parsedContent) ? parsedContent.length : 'not an array'
            });

            // Ensure content is an array
            if (!Array.isArray(parsedContent)) {
              console.warn("Content is not an array, converting to array");
              const fixedContent = Array.isArray(parsedContent) ? parsedContent : [parsedContent];
              editorStateJSON = JSON.stringify(fixedContent);
            }

            result = await saveNewVersion(page.id, {
              content: editorStateJSON,
              userId: user.uid,
              username: user.displayName || user.username,
              skipIfUnchanged: true
            });
          } catch (jsonError) {
            console.error("Error validating JSON before saving:", jsonError);
            // Try to create a new JSON string as a fallback
            try {
              // Ensure finalContent is valid
              if (!finalContent || !Array.isArray(finalContent)) {
                console.warn("Final content is invalid, creating default content");
                finalContent = [{
                  type: "paragraph",
                  children: [{ text: "Content could not be saved properly. Please try again." }]
                }];
              }

              const fallbackJSON = JSON.stringify(finalContent);
              console.log("Using fallback JSON string for save:", fallbackJSON.substring(0, 100) + "...");

              result = await saveNewVersion(page.id, {
                content: fallbackJSON,
                userId: user.uid,
                username: user.displayName || user.username,
                skipIfUnchanged: true
              });
            } catch (fallbackError) {
              console.error("Error with fallback save:", fallbackError);
              // Last resort - create a minimal valid content structure
              const emergencyContent = JSON.stringify([{
                type: "paragraph",
                children: [{ text: "Content could not be saved properly. Please try again." }]
              }]);

              result = await saveNewVersion(page.id, {
                content: emergencyContent,
                userId: user.uid,
                username: user.displayName || user.username,
                skipIfUnchanged: false // Force save in emergency case
              });
            }
          }
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

          // Reset all change tracking states to prevent unsaved changes warning
          // This is crucial to fix the issue where the warning appears after a successful save
          setHasContentChanged(false);
          setHasTitleChanged(false);
          setHasVisibilityChanged(false);
          setHasLocationChanged(false);

          // Show a success toast
          toast.success("Page saved successfully");

          // Force a refresh of the page data to ensure the latest content is displayed
          if (typeof window !== 'undefined') {
            // Dispatch a custom event to notify that the page has been updated
            window.dispatchEvent(new CustomEvent('page-updated', {
              detail: { pageId: page.id }
            }));
          }

          // CRITICAL FIX: Ensure content is properly updated in the parent component
          // before switching to view mode by adding a small delay
          setTimeout(() => {
            // Update the state to exit edit mode
            setIsEditing(false);
          }, 300);

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
          // Provide more specific error messages based on error type
          let errorMessage = "Failed to save";

          if (error.name === 'ReferenceError') {
            errorMessage = "Failed to save: Internal error with content processing";
          } else if (error.name === 'SyntaxError') {
            errorMessage = "Failed to save: Content format error";
          } else if (error.message) {
            errorMessage = "Failed to save: " + error.message;
          } else {
            errorMessage = "Failed to save: Unknown error";
          }

          setError(errorMessage);
          await logError(error, "EditPage.js");

          // Show error toast
          toast.error(errorMessage);

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
      setError("Failed to save after multiple attempts. Please refresh the page and try again.");

      // Show error toast with more specific instructions
      toast.error("Failed to save. Please refresh the page and try again.");

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
    console.log('[DEBUG] EditPage - Cancel button clicked, exiting edit mode:', page.id);

    // Simply exit edit mode without reloading the page
    setIsEditing(false);
  };

  // Handle insert link action from bottom toolbar
  const handleInsertLink = () => {
    // Trigger insert link in PageEditor component
    const insertLinkEvent = new CustomEvent('triggerInsertLink');
    window.dispatchEvent(insertLinkEvent);
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

  // Log changes state for debugging
  useEffect(() => {
    console.log('Change tracking state:', {
      hasContentChanged,
      hasTitleChanged,
      hasVisibilityChanged,
      hasLocationChanged,
      hasUnsavedChanges
    });
  }, [hasContentChanged, hasTitleChanged, hasVisibilityChanged, hasLocationChanged, hasUnsavedChanges]);

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
    // CRITICAL FIX: Log the content being received from the editor
    console.log('EditPage - handleContentChange called with content:', {
      contentType: typeof content,
      isArray: Array.isArray(content),
      length: Array.isArray(content) ? content.length : 0
    });

    // CRITICAL FIX: Make a deep copy of the content to prevent reference issues
    let contentCopy;
    try {
      contentCopy = JSON.parse(JSON.stringify(content));
    } catch (e) {
      console.error('Error making deep copy of content:', e);
      contentCopy = content; // Fall back to original content if deep copy fails
    }

    setEditorContent(contentCopy);

    // Check if content has changed from the original
    try {
      const originalContent = typeof page.content === 'string'
        ? page.content
        : JSON.stringify(page.content);
      const newContent = JSON.stringify(contentCopy);

      const hasChanged = originalContent !== newContent;
      console.log('Content changed:', hasChanged);
      setHasContentChanged(hasChanged);
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
    // Get the page URL to return to
    const returnUrl = page && page.id ? `/${page.id}` : '/';
    console.log('[DEBUG] EditPage - handleCancelWithCheck called, returnUrl:', returnUrl);

    if (hasUnsavedChanges) {
      // If there are unsaved changes, show the confirmation dialog
      // and set the return URL to the page being edited
      handleNavigation(returnUrl);
    } else {
      // If no unsaved changes, just cancel and return to the page
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
        isSaving={isSaving}
        error={error}
        isNewPage={false}
        clickPosition={clickPosition}
      />

      {/* Edit Mode Bottom Toolbar */}
      <EditModeBottomToolbar
        isPublic={isPublic}
        setIsPublic={handleVisibilityChange}
        location={location}
        setLocation={handleLocationChange}
        onInsertLink={handleInsertLink}
        onCancel={handleCancelWithCheck}
        onSave={() => handleSave(editorContent || current)}
        isSaving={isSaving}
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