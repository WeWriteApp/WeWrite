"use client";
import { useContext, useEffect, useState } from "react";
import SlateEditor from "../components/SlateEditor";
import { createPage } from "../firebase/database";
import DashboardLayout from "../DashboardLayout";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import ReactGA from 'react-ga4';

const New = () => {
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });

  return (
    <DashboardLayout>
      <div className="w-full h-full flex flex-col space-y-6 bg-white p-6">
        <div>
          <h1 className="text-2xl font-semibold mb-4 text-gray-900">New Page</h1>
          <Form Page={Page} setPage={setPage} />
        </div>
      </div>
    </DashboardLayout>
  );
};

const Form = ({ Page, setPage }) => {
  const router = useRouter();
  const [editorState, setEditorState] = useState();
  const { user, loading } = useContext(AuthContext);
  const [isSaving, setIsSaving] = useState(false);

  let updateTime = new Date().toISOString();

  const handleSave = async () => {
    setIsSaving(true);
    let data = {
      ...Page,
      content: JSON.stringify(editorState),
      userId: user.uid,
      lastModified: updateTime,
    };
  
    const res = await createPage(data); // Save the page
  
    if (res?.id) { // Ensure we got an ID back
      ReactGA.event({
        category: "Page",
        action: "Add new page",
        label: Page.title,
      });
      setIsSaving(false);
  
      // Redirect to the new page's editable route
      router.push(`/pages/${res.id}`);
    } else {
      setIsSaving(false);
      console.error("Error creating page");
    }
  };

  return (
    <form
      className="w-full flex flex-col space-y-4 bg-white p-6 border border-gray-300 rounded-lg shadow-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Title Input */}
      <input
        type="text"
        value={Page.title}
        placeholder="Title"
        onChange={(e) => setPage({ ...Page, title: e.target.value })}
        className="border border-gray-300 rounded p-3 w-full text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        autoComplete="off"
      />

      {/* Public Checkbox */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={Page.isPublic}
          onChange={(e) => setPage({ ...Page, isPublic: e.target.checked })}
          className="cursor-pointer"
          autoComplete="off"
        />
        <label className="text-gray-800">Public</label>
      </div>

      {/* Slate Editor */}
      <SlateEditor setEditorState={setEditorState} />

      {/* Divider */}
      <div className="flex w-full h-1 bg-gray-200 my-4"></div>

      {/* Save & Cancel Buttons */}
      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={handleSave}
          disabled={!Page.title || !editorState || isSaving}
          className={`text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-500 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed`}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => router.push("/pages")}
          className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default New;