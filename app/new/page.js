"use client";
import { useContext, useEffect, useState } from "react";
import SlateEditor from "../components/SlateEditor";
import { createPage } from "../firebase/database";
import DashboardLayout from "../DashboardLayout";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import ReactGA from 'react-ga4';
import PageHeader from "../components/PageHeader";

const New = () => {
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  return (
    <DashboardLayout>
      <PageHeader title="New page" />
      <div className="container py-6">
        <div className="w-full h-full flex flex-col space-y-4">
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

    const res = await createPage(data);
    if (res) {
      ReactGA.event({
        category: "Page",
        action: "Add new page",
        label: Page.title,
      });
      setIsSaving(false);
      router.push("/pages");
    } else {
      setIsSaving(false);
      console.log("Error creating page");
    }
  };

  return (
    <form
      className="w-full flex flex-col space-y-6"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
          <input
            id="title"
            type="text"
            value={Page.title}
            placeholder="Enter page title..."
            onChange={(e) => setPage({ ...Page, title: e.target.value })}
            className="border border-gray-300 rounded-md p-2 w-full bg-background text-text"
            autoComplete="off"
          />
        </div>
        
        <div>
          <label htmlFor="content" className="block text-sm font-medium mb-1">Content</label>
          <div className="min-h-[300px] border border-gray-300 rounded-md p-2 bg-background">
            <SlateEditor setEditorState={setEditorState} />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={Page.isPublic}
            onChange={(e) => setPage({ ...Page, isPublic: e.target.checked })}
            autoComplete="off"
          />
          <label htmlFor="isPublic">Public</label>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={!Page.title || !editorState || isSaving}
          className={`text-button-text bg-background rounded-lg border border-gray-500 px-4 py-2 hover:bg-gray-200 transition-colors ${!editorState || !Page.title ? "cursor-not-allowed opacity-70" : ""}`}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => router.push("/pages")}
          className="bg-background text-button-text px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default New;
