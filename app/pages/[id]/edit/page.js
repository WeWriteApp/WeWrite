"use client";
import React, { useEffect, useState } from "react";
import { getDocById,createSubcollection, getSubcollection } from "../../../firebase/database";
import Editor from "../../../components/Editor";
import DashboardLayout from "../../../DashboardLayout";
import TextView from "../../../components/TextView";

const Edit = ({ params }) => {
  const [page, setPage] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const [initialEditorState, setInitialEditorState] = useState(null);
  const [versions, setVersions] = useState([]);
  useEffect(() => {
    if (!params.id) return;
    const fetchPage = async () => {
      const page = await getDocById("pages", params.id);
      setPage(page.data());

      setInitialEditorState(page.data().content);
      setEditorState(page.data().content);

      // get all versions of the page
      const versions = await getSubcollection("pages", params.id, "versions");
      setVersions(versions.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };

    fetchPage();
  }, [params]);

  const handleSave = () => {
    // convert the editorState to JSON
    const editorStateJSON = JSON.stringify(editorState);

    // save a versino in the subcollection of the page record
    createSubcollection("pages", params.id, "versions", {
      content: editorStateJSON,
      isActive: true,
      createdAt: new Date().toISOString()
    });
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
      <div className="container mx-auto">
      <h1 className="text-2xl font-semibold">Edit Page: {page.title}</h1>
      <div className="flex w-full h-1 bg-gray-200 my-4"></div>
      {page ? (
        <Editor initialEditorState={editorState} setEditorState={setEditorState} />
      ) : (
        <div>Loading...</div>
      )}


      <div className="fixed bottom-0 right-0 p-4 bg-white shadow-lg">
        <button 
          onClick={handleSave}
        className="bg-blue-500 text-white px-4 py-2 rounded-md">Save</button>
        <button
          onClick={handleCancel}
        className="bg-red-500 text-white px-4 py-2 rounded-md">Cancel</button>
      </div>
      </div>
        
    </DashboardLayout>
  );
}

export default Edit;