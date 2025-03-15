"use client";
import React, { useEffect, useState, useContext, useRef } from "react";
import { saveNewVersion, updateDoc } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { GroupsContext } from "../providers/GroupsProvider";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import SlateEditor from "./SlateEditor";
import { useLogging } from "../providers/LoggingProvider";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

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
    <div>
      <label className="text-lg font-semibold text-text">Title</label>
      <input
        type="text"
        defaultValue={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border border-gray-200 p-2 text-3xl w-full bg-background text-text"
        autoComplete="off"
      />

      <div className="flex w-full h-1 bg-gray-200 my-4"></div>
      <SlateEditor
        ref={editorRef}
        setEditorState={setEditorState}
        initialEditorState={editorState}
      />
      <div className="flex w-full h-1 bg-gray-200 my-4"></div>

      <label className="text-lg font-semibold">Group</label>
      <p className="text-sm text-gray-500">
        {groupId
          ? `This page belongs to a group ${groupId}`
          : "This page does not belong to any group"}
      </p>
      <ReactSearchAutocomplete
        items={localGroups}
        onSelect={handleSelect}
        placeholder="Search for a group"
        className="searchbar"
        fuseOptions={{
          minMatchCharLength: 2,
        }}
        formatResult={(item) => {
          return <div key={item.id}>{item.name}</div>;
        }}
      />

      {page.groupId && (
        <div className="flex items-center gap-2 mt-4">
          <button
            className="bg-background text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-200 transition-colors"
            onClick={removeGroup}
          >
            Remove group
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          disabled={isSaving}
          className="bg-background text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-200 transition-colors"
          onClick={handleSave}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          className="bg-background text-button-text px-4 py-2"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EditPage;