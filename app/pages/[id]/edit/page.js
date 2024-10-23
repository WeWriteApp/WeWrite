"use client";
import React, { useEffect, useState } from "react";
import { getDocById,createSubcollection, getSubcollection } from "../../../firebase/database";
import DashboardLayout from "../../../DashboardLayout";
import TextView from "../../../components/TextView";
import SlateEditor from "../../../components/SlateEditor";
import {updateDoc} from "../../../firebase/database";

const Edit = ({ params }) => {
  const [page, setPage] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const [initialEditorState, setInitialEditorState] = useState(null);
  const [isPublic, setIsPublic] = useState(false);
  
  useEffect(() => {
    if (!params.id) return;
    const fetchPage = async () => {
      const page = await getDocById("pages", params.id);
      setPage(page.data());

      console.log(page.data().content);
      setInitialEditorState(page.data().content);
      setEditorState(page.data().content);
    };

    fetchPage();
  }, [params]);

  const handleSave = () => {
    // convert the editorState to JSON
    const editorStateJSON = JSON.stringify(editorState);

    // update the page content
    updateDoc("pages", params.id, { content: editorStateJSON, isPublic: page.isPublic });

  }

  const handleCancel = () => {
    // reset the editorState
    setEditorState(initialEditorState);
  }

  if (!page) {
    return <div>Loading...</div>;
  }
  return (
    <DashboardLayout>
      <div>
      <h1 className="text-2xl font-semibold">Edit Page: {page.title}</h1>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={page.isPublic}
          onChange={(e) => setPage({ ...page, isPublic: e.target.checked })}
          autoComplete="off"
        />
        <label>Public</label>
      </div>
      <SlateEditor setEditorState={setEditorState} initialEditorState={JSON.parse(initialEditorState)} />

    {/* diusplay json editor state */}
    <div className="flex w-full h-1 bg-gray-200 my-4"></div>
    </div>
      <div className="fixed bottom-0 right-0 p-4 bg-white shadow-lg">
        <button 
          onClick={handleSave}
        className="bg-blue-500 text-white px-4 py-2 rounded-md">Save</button>
        <button
          onClick={handleCancel}
        className="bg-red-500 text-white px-4 py-2 rounded-md">Cancel</button>
      </div>
        
    </DashboardLayout>
  );
}

export default Edit;