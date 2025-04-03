"use client";
import React, { useEffect, useState, useContext, useRef } from "react";
import { saveNewVersion, updateDoc } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { GroupsContext } from "../providers/GroupsProvider";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import SlateEditor from "./SlateEditor";
import { useLogging } from "../providers/LoggingProvider";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { usePage } from "../contexts/PageContext";

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
  // Ensure initial state is always a valid Slate structure
  const [currentEditorValue, setCurrentEditorValue] = useState(() =>
    current || [{ type: 'paragraph', children: [{ text: '' }] }]
  );
  const [groupId, setGroupId] = useState(null);
  const [localGroups, setLocalGroups] = useState([]);
  const { user } = useContext(AuthContext);
  const groups = useContext(GroupsContext);
  const [isSaving, setIsSaving] = useState(false);
  const { logError } = useLogging();
  const editorRef = useRef(null);

  // Use keyboard shortcuts
  useKeyboardShortcuts({
    isEditing,
    setIsEditing,
    canEdit: false, // Disable "Enter to edit" in edit mode
    handleSave: !isSaving ? handleSave : null, // Only allow save when not already saving
    isSaving
  });

  useEffect(() => {
    if (page?.groupId) {
      setGroupId(page.groupId);
    }
  }, [page?.groupId]);

  useEffect(() => {
    // Focus the editor when entering edit mode
    if (editorRef.current) {
      editorRef.current.focus();
    }

    // Set edit mode in PageContext
    setIsEditMode(true);

    // Cleanup when component unmounts
    return () => {
      setIsEditMode(false);
    };
  }, [setIsEditMode]);

  useEffect(() => {
    // Update currentEditorValue when the `current` prop changes (e.g., initial load)
    if (current) { // Only update if `current` is truthy
      // Consider adding a deep comparison here if needed to avoid unnecessary updates
      setCurrentEditorValue(current);
    }
  }, [current]);

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

  async function handleSave() {
    if (!user) {
      console.log("User not authenticated");
      return;
    }

    if (!title || title.length === 0) {
      console.log("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      // convert the editorState to JSON
      // Use the latest value from the editor captured in `currentEditorValue`
      const editorStateJSON = JSON.stringify(currentEditorValue);

      // save the new version
      const result = await saveNewVersion(page.id, {
        content: editorStateJSON,
        userId: user.uid,
      });

      if (result) {
        let updateTime = new Date().toISOString();
        // update the page content
        await updateDoc("pages", page.id, {
          title: title,
          isPublic: page.isPublic,
          groupId: groupId,
          lastModified: updateTime,
        });

        setIsEditing(false);
      } else {
        console.log("Error saving new version");
      }
    } catch (error) {
      console.log("Error saving new version", error);
      await logError(error, "EditPage.js");
    } finally {
      setIsSaving(false);
    }
  }

  const removeGroup = () => {
    setGroupId(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleInsertLink = () => {
    // Simulate @ key press to trigger link editor
    if (editorRef.current) {
      editorRef.current.focus();
      const atEvent = new KeyboardEvent('keydown', {
        key: '@',
        code: 'KeyAT',
        keyCode: 50,
        which: 50,
        bubbles: true
      });
      document.activeElement.dispatchEvent(atEvent);
    }
  };

  // Display the error message if provided, otherwise check for editorState
  if (editorError) {
    return (
      <div className="bg-destructive/10 p-4 rounded-md mb-4">
        <p className="text-destructive font-medium">{editorError}</p>
        <p className="text-sm text-muted-foreground mt-2">Try refreshing the page or contact support if this issue persists.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32">
      <div className="space-y-4">
        <div>
          <input
            type="text"
            defaultValue={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 text-3xl font-semibold bg-background text-foreground border border-input/30 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg px-3 py-2 transition-all break-words overflow-wrap-normal whitespace-normal"
            placeholder="Enter a title..."
            autoComplete="off"
            style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
          />
        </div>

        <div className="space-y-6 rounded-xl">
          <div className="space-y-0">
            <SlateEditor
              ref={editorRef}
              initialContent={currentEditorValue} // Pass the guaranteed-valid state
              onContentChange={setCurrentEditorValue} // Update local state on change
              onSave={!isSaving ? handleSave : null}
              onDiscard={handleCancel}
              onInsert={handleInsertLink}
            />
          </div>
        </div>
      </div>
      {/* Removed the fixed footer - now using the floating toolbar from SlateEditor */}
    </div>
  );
};

export default EditPage;