"use client";
import React, { useEffect, useState, useContext } from "react";
import { saveNewVersion, updateDoc } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { GroupsContext } from "../providers/GroupsProvider";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { useLogging } from "../providers/LoggingProvider";
import { X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
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
  const [isPublic, setIsPublic] = useState(page?.isPublic !== false);
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
      setIsPublic(page.isPublic !== false);
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

    setIsSaving(true);
    try {
      // Convert the editorState to JSON
      const editorStateJSON = JSON.stringify(editorContent);

      // Save the new version
      const result = await saveNewVersion(page.id, {
        content: editorStateJSON,
        userId: user.uid,
      });

      if (result) {
        let updateTime = new Date().toISOString();
        // Update the page content
        await updateDoc("pages", page.id, {
          title: title,
          isPublic: isPublic,
          groupId: groupId,
          lastModified: updateTime,
        });

        setIsEditing(false);
      } else {
        setError("Error saving new version");
      }
    } catch (error) {
      console.error("Error saving new version", error);
      setError("Failed to save: " + error.message);
      await logError(error, "EditPage.js");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  // Display error message if provided
  if (editorError) {
    return (
      <div className="bg-destructive/10 dark:bg-destructive/20 p-6 rounded-lg mb-6 border border-destructive/30 shadow-sm">
        <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Editor</h3>
        <p className="text-destructive/90 font-medium mb-4">{editorError}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleCancel}
          >
            Cancel Editing
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4">If this issue persists, please contact support.</p>
      </div>
    );
  }

  return (
    <PageEditor
      title={title}
      setTitle={setTitle}
      initialContent={current}
      onContentChange={(content) => {
        // Store the updated content in a ref or state if needed
        console.log('Content updated in EditPage');
      }}
      isPublic={isPublic}
      setIsPublic={setIsPublic}
      onSave={(editorContent) => handleSave(editorContent || current)}
      onCancel={handleCancel}
      isSaving={isSaving}
      error={error}
      isNewPage={false}
    />
  );
};

export default EditPage;