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

    // Check if content is just an empty paragraph
    if (editorContent.length === 1 &&
        editorContent[0].children &&
        editorContent[0].children.length === 1 &&
        editorContent[0].children[0].text === '') {
      setError("Cannot save empty content");
      return;
    }

    setIsSaving(true);
    try {
      console.log('Saving editor content:', editorContent);

      // Convert the editorState to JSON
      const editorStateJSON = JSON.stringify(editorContent);

      // First update the page metadata and content
      let updateTime = new Date().toISOString();
      await updateDoc("pages", page.id, {
        title: title,
        isPublic: isPublic,
        groupId: groupId,
        lastModified: updateTime,
        // Also update content directly in the page document
        content: editorStateJSON
      });

      // Then save the new version
      const result = await saveNewVersion(page.id, {
        content: editorStateJSON,
        userId: user.uid,
        username: user.displayName || user.username,
      });

      if (result) {
        console.log('Page saved successfully');

        // Force reload the page to show the updated content
        window.location.href = `/${page.id}`;
      } else {
        console.error('Error saving new version: result was falsy');
        setError("Error saving new version");
      }
    } catch (error) {
      console.error("Error saving new version", error);
      setError("Failed to save: " + (error.message || "Unknown error"));
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
      onSave={(content) => handleSave(content || editorContent || current)}
      onCancel={handleCancel}
      isSaving={isSaving}
      error={error}
      isNewPage={false}
    />
  );
};

export default EditPage;