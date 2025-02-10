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
    title: "New page",
    isPublic: true,
  });

  return (
    <DashboardLayout>
      <div className="w-full h-full flex flex-col bg-background p-6">
        <Form Page={Page} setPage={setPage} />
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
      className="w-full h-full flex flex-col bg-background p-6"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Title and Author */}
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={Page.title}
          placeholder="New page"
          onChange={(e) => setPage({ ...Page, title: e.target.value })}
          className="text-xl font-bold text-text px-2 py-1 rounded-lg bg-background focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-300"
          autoComplete="off"
        />
        <span className="text-gray-500 text-sm">by 🇺🇸 
          {user?.username || "Anonymous"}
        </span>
      </div>

      {/* Slate Editor */}
      <SlateEditor setEditorState={setEditorState} />

      {/* Button Section */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 bg-background p-2 shadow-lg rounded-full">
        <button
          className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          onClick={() => router.push("/pages")}
        >
          Insert
        </button>
        <button
          className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          onClick={() => router.push("/pages")}
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={!Page.title || !editorState || isSaving}
          className={`text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-500 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed`}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
};

export default New;