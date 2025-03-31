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
  const [editorState, setEditorState] = useState(() => {
    try {
      // Handle different types of input formats
      if (!current) {
        console.error("No current content provided");
        return [{ type: "paragraph", children: [{ text: "" }] }];
      }
      
      // If current is already an array, use it directly
      if (Array.isArray(current)) {
        return current;
      }
      
      // If current is a string, try to parse it
      if (typeof current === 'string') {
        return JSON.parse(current);
      }
      
      // If current is an object but not an array, stringify and parse it
      return JSON.parse(JSON.stringify(current));
    } catch (e) {
      console.error("Failed to parse editor state:", e, "Current value:", current);
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }
  });
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
      const editorStateJSON = JSON.stringify(editorState);

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

  // Always provide a default editor state if none exists
  if (!editorState) {
    console.error("Editor state is null or undefined, using default empty state");
    setEditorState([{ type: "paragraph", children: [{ text: "" }] }]);
  }

  return (
    <div className="space-y-8 pb-28">
      <div className="space-y-4">
        <div>
          <input
            type="text"
            defaultValue={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 text-3xl font-semibold bg-background text-foreground border border-input/30 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg px-3 py-2 transition-all"
            placeholder="Enter a title..."
            autoComplete="off"
          />
        </div>

        <div className="space-y-6 rounded-xl">
          <div className="space-y-0">
            <SlateEditor
              ref={editorRef}
              initialEditorState={editorState}
              setEditorState={setEditorState}
              onSave={handleSave}
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