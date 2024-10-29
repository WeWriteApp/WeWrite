"use client";
import React, { useEffect, useState, useContext } from "react";
import { saveNewVersion, updateDoc } from "../firebase/database";
import { AuthContext } from "../providers/AuthProvider";
import { GroupsContext } from "../providers/GroupsProvider";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import SlateEditor from "./SlateEditor";




const EditPage = ({
  isEditing,
  setIsEditing,
  page,
  current,
  title,
  setTitle,
}: any) => {
  const [editorState, setEditorState] = useState(JSON.parse(current));
  const [groupId, setGroupId] = useState(null);
  const [localGroups, setLocalGroups] = useState([]);
  const { user } = useContext(AuthContext);
  const { groups } = useContext(GroupsContext);
  const [isSaving, setIsSaving] = useState(false);
  // const { logError } = useLogging();

  useEffect(() => {
    if (page.groupId) {
      setGroupId(page.groupId);
    }
  }, []);

  useEffect(() => {
    if (!groups) return;
    if (groups.length > 0) {
      if (user?.groups) {
        let arr: any = [];
        Object.keys(user.groups).forEach((groupId) => {
          const group = groups.find((g: any) => g.id === groupId);
          if (group) {
            arr.push({
              id: groupId,
              name: group.name,
            });
          }
        })
        setLocalGroups(arr);
      }
    }
  }, [groups]);

  const handleSelect = (item: any) => {
    console.log("Selected item", item);
    setGroupId(item.id);
  }

  const handleSave = () => {

    if (!user) {
      console.log("User not authenticated");
      return;
    }

    if (!title || title.length === 0) {
      console.log("Title is required");
      return;
    }

    setIsSaving(true);
    // convert the editorState to JSON
    const editorStateJSON = JSON.stringify(editorState);

    // // save the new version
    saveNewVersion(page.id, {
      content: editorStateJSON,
      userId: user.uid,
    })
      .then((result) => {
        if (result) {

          let updateTime = new Date().toISOString();
          // update the page content
          updateDoc("pages", page.id, {
            title: title,
            isPublic: page.isPublic,
            groupId: groupId,
            lastModified: updateTime,
          });

          setIsEditing(false);
          setIsSaving(false);
        } else {
          console.log("Error saving new version");
          setIsSaving(false);
        }
      })
      .catch(async (error) => {
        console.log("Error saving new version", error);
        // await logError(error, "EditPage.js");
        setIsSaving(false);
      });
  };

  const removeGroup = () => {
    setGroupId(null);
  }

  const handleCancel = () => {
    // reset the editorState
    setEditorState(page.content);
    setIsEditing(false);
  };

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
        setEditorState={setEditorState}
        initialEditorState={JSON.parse(current)}
      />
      <div className="flex w-full h-1 bg-gray-200 my-4"></div>

      <label className="text-lg font-semibold">Group</label>
      <p className="text-sm text-gray-500">
        {
          groupId ? `This page belongs to a group ${groupId}` : "This page does not belong to any group"
        }
      </p>
      <ReactSearchAutocomplete
        items={localGroups}
        onSelect={handleSelect}
        autoFocus
        placeholder="Search for a group"
        className="searchbar"
        fuseOptions={{
          minMatchCharLength: 2,
        }}
        formatResult={(item: any) => {
          return <div key={item.id}>{item.name}</div>;
        }}
      />

      {
        page.groupId && (
          <div className="flex items-center gap-2 mt-4">
            <button
              className="bg-background text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-200 transition-colors"
              onClick={removeGroup}
            >
              Remove group
            </button>
          </div>
        )
      }

      <div className="flex items-center gap-2 mt-4">
        <button
          disabled={isSaving}
          className="bg-background text-button-text px-4 py-2 rounded-lg border border-gray-500 hover:bg-gray-200 transition-colors"
          onClick={() => handleSave()}
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