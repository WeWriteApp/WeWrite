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
}) => {
  const { setIsEditMode } = usePage();
  const [editorState, setEditorState] = useState(() => {
    try {
      return JSON.parse(current);
    } catch (e) {
      console.error("Failed to parse editor state:", e);
      return null;
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

  if (!editorState) {
    return <div>Error loading editor state</div>;
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
            />
          </div>
        </div>
      </div>

      <div>
        <Button
          variant="outline"
          onClick={handleInsertLink}
          className="ml-auto flex"
        >
          Insert Link
        </Button>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 w-full bg-background/80 backdrop-blur-md border-t border-border py-4 px-4 z-50">
        <div className="w-full flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditPage;