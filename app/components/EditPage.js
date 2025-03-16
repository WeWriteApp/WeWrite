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

const EditPage = ({
  isEditing,
  setIsEditing,
  page,
  current,
  title,
  setTitle,
}) => {
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
  }, []);

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

  if (!editorState) {
    return <div>Error loading editor state</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Title</label>
          <input
            type="text"
            defaultValue={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 text-3xl font-semibold bg-background text-foreground border-none focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg transition-all"
            placeholder="Enter a title..."
            autoComplete="off"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 to-background pointer-events-none h-[1px] -top-4" />
          <SlateEditor
            ref={editorRef}
            setEditorState={setEditorState}
            initialEditorState={editorState}
          />
        </div>
      </div>

      <div className="space-y-6 bg-muted/10 rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Group Access</label>
            <p className="text-sm text-muted-foreground/80">
              {groupId
                ? `This page belongs to group ${groupId}`
                : "This page does not belong to any group"}
            </p>
          </div>
          
          <div className="relative">
            <ReactSearchAutocomplete
              items={localGroups}
              onSelect={handleSelect}
              placeholder="Search for a group..."
              className="searchbar"
              fuseOptions={{
                minMatchCharLength: 2,
              }}
              formatResult={(item) => {
                return <div key={item.id}>{item.name}</div>;
              }}
            />
          </div>

          {page.groupId && (
            <button
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={removeGroup}
            >
              <X className="w-4 h-4 mr-1" />
              Remove group
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          onClick={handleSave}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </div>
  );
};

export default EditPage;