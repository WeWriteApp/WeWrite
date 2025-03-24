"use client";
import { useContext, useEffect, useState } from "react";
import SlateEditor from "../components/SlateEditor";
import { createPage } from "../firebase/database";
import DashboardLayout from "../DashboardLayout";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import ReactGA from 'react-ga4';
import PageHeader from "../components/PageHeader";
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";

const New = () => {
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  const searchParams = useSearchParams();
  const isReply = searchParams.has('isReply') || (searchParams.has('title') && searchParams.get('title').startsWith('Re:'));
  
  return (
    <DashboardLayout>
      <PageHeader title={isReply ? "Replying to page" : "New page"} />
      <div className="container w-full py-6 px-4">
        <div className="w-full">
          <Form Page={Page} setPage={setPage} isReply={isReply} />
        </div>
      </div>
    </DashboardLayout>
  );
};

const Form = ({ Page, setPage, isReply }) => {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editorState, setEditorState] = useState();
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const analytics = useWeWriteAnalytics();

  let updateTime = new Date().toISOString();

  // Get initial title and content from URL parameters
  useEffect(() => {
    const titleParam = searchParams.get('title');
    const contentParam = searchParams.get('initialContent');
    
    if (titleParam) {
      try {
        const decodedTitle = decodeURIComponent(titleParam);
        setPage(prev => ({ ...prev, title: decodedTitle }));
      } catch (error) {
        console.error("Error decoding title parameter:", error);
      }
    }
    
    if (contentParam) {
      try {
        const decodedContent = decodeURIComponent(contentParam);
        const parsedContent = JSON.parse(decodedContent);
        console.log("Setting initial content:", parsedContent);
        setInitialContent(parsedContent);
        
        // Also set the editor state to ensure it's properly initialized
        if (setEditorState) {
          setEditorState(parsedContent);
        }
      } catch (error) {
        console.error("Error parsing initial content:", error);
      }
    }
  }, [searchParams, setPage, setEditorState]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    if (!Page.title) {
      setError("Please add a title");
      setIsSaving(false);
      return;
    }

    const data = {
      ...Page,
      content: JSON.stringify(editorState),
      userId: user.uid,
      username: user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
      lastModified: updateTime,
      isReply: isReply || false, // Add flag to indicate this is a reply page
    };

    const res = await createPage(data);
    if (res) {
      // Track with existing ReactGA for backward compatibility
      ReactGA.event({
        category: "Page",
        action: "Add new page",
        label: Page.title,
      });
      
      // Track with new analytics system
      analytics.trackContentEvent(CONTENT_EVENTS.PAGE_CREATED, {
        label: Page.title,
        page_id: res,
        is_reply: !!isReply,
      });
      
      setIsSaving(false);
      router.push(`/pages/${res}`);
    } else {
      setIsSaving(false);
      console.log("Error creating page");
    }
  };

  return (
    <form
      className="space-y-6 px-4 sm:px-6 md:px-8"
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        <div className="max-w-2xl">
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
            <SlateEditor setEditorState={setEditorState} initialContent={initialContent} />
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
        <button
          disabled={!Page.title || !editorState || isSaving}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => router.push("/pages")}
          className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default New;
