"use client";
import { useContext, useEffect, useState } from "react";
import SlateEditor from "../components/SlateEditor";
import { createPage } from "../firebase/database";
import DashboardLayout from "../DashboardLayout";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import ReactGA from 'react-ga4';
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";

const New = () => {
  const { user } = useContext(AuthContext);
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  
  return (
    <DashboardLayout>
      <PageHeader 
        title="New page" 
        username={user?.username || "Anonymous"} 
        userId={user?.uid}
        hideLink={true}
      />
      <div className="container py-6">
        <div className="max-w-3xl mx-auto">
          <Form Page={Page} setPage={setPage} />
        </div>
      </div>
    </DashboardLayout>
  );
};

const Form = ({ Page, setPage }) => {
  const router = useRouter();
  const [editorState, setEditorState] = useState();
  const { user } = useContext(AuthContext);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!Page.title || Page.title.trim().length === 0) {
      return;
    }

    setIsSaving(true);
    let data = {
      ...Page,
      content: JSON.stringify(editorState),
      userId: user.uid,
      lastModified: new Date().toISOString(),
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
      className="space-y-6"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">Title</label>
          <input
            id="title"
            type="text"
            value={Page.title}
            placeholder="Enter page title..."
            onChange={(e) => setPage({ ...Page, title: e.target.value })}
            className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            autoComplete="off"
          />
        </div>
        
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-foreground mb-1">Content</label>
          <div className="min-h-[300px] border border-input rounded-md bg-background">
            <SlateEditor setEditorState={setEditorState} />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={Page.isPublic}
            onChange={(e) => setPage({ ...Page, isPublic: e.target.checked })}
            className="h-4 w-4 text-primary border-input rounded focus:ring-primary"
            autoComplete="off"
          />
          <label htmlFor="isPublic" className="text-sm text-foreground">Public</label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={!Page.title || isSaving}
          variant="default"
          className="w-full"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button
          onClick={() => router.push("/pages")}
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default New;
