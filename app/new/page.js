"use client";
import { useContext, useEffect, useState } from "react";
import Editor from "../components/Editor";
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
      <div className="w-full h-full flex flex-col space-y-4">
        <div>
          <h1 className="text-2xl font-semibold mb-4">New Page</h1>
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
      className="w-full flex flex-col space-y-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="text"
        value={Page.title}
        placeholder="Title"
        onChange={(e) => setPage({ ...Page, title: e.target.value })}
        className="border border-gray-300 rounded p-2 w-full bg-background text-text"
        autoComplete="off"
      />
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={Page.isPublic}
          onChange={(e) => setPage({ ...Page, isPublic: e.target.checked })}
          autoComplete="off"
        />
        <label>Public</label>
      </div>

      <Editor setEditorState={setEditorState} />

      <div className="flex w-full h-1 bg-gray-200 my-4"></div>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={!Page.title || !editorState || isSaving}
          className={`text-button-text bg-background rounded-lg border border-gray-500 px-4 py-2 hover:bg-gray-200 transition-colors ${!editorState ? "cursor-not-allowed" : ""}`}
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

      <pre className="bg-gray-100 p-2 hidden">

      </pre>
    </form>
  );
};

export default New;
