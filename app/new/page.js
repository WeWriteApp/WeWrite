"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "../DashboardLayout";
import { createPage } from "../firebase/database";
import PageHeader from "../components/PageHeader";
import ReactGA from 'react-ga4';
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";
import Cookies from 'js-cookie';
import PageEditor from "../components/PageEditor";
import { Button } from "../components/ui/button";
import { ChevronLeft } from "lucide-react";
import { createReplyAttribution } from "../utils/linkUtils";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "../components/UnsavedChangesDialog";
import HydrationSafetyWrapper from "../components/HydrationSafetyWrapper";
import dynamic from 'next/dynamic';

// Dynamically import PageEditor to prevent SSR issues
const DynamicPageEditor = dynamic(() => import("../components/PageEditor"), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-none">
      <div className="flex justify-center py-8">
        <div className="loader loader-md"></div>
      </div>
    </div>
  )
});

export default function NewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState({
    uid: 'anonymous',
    email: 'anonymous@example.com',
    username: 'Anonymous',
    displayName: 'Anonymous'
  });
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [location, setLocation] = useState(null);
  const [editorContent, setEditorContent] = useState([{ type: "paragraph", children: [{ text: "" }] }]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const [error, setError] = useState(null);
  const analytics = useWeWriteAnalytics();
  const isReply = searchParams.has('replyTo');

  // Track changes for unsaved changes warning
  const [hasContentChanged, setHasContentChanged] = useState(false);
  const [hasTitleChanged, setHasTitleChanged] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Account switcher logic
  useEffect(() => {
    let userData = null;
    try {
      const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
      if (wewriteAccounts) {
        const accounts = JSON.parse(wewriteAccounts);
        const currentAccount = accounts.find(acc => acc.isCurrent);
        if (currentAccount) userData = currentAccount;
      }
    } catch {}
    if (!userData) {
      try {
        const wewriteUserId = Cookies.get('wewrite_user_id');
        if (wewriteUserId) {
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const account = accounts.find(acc => acc.uid === wewriteUserId);
            if (account) userData = account;
          }
        }
      } catch {}
    }
    if (!userData) {
      try {
        const userSessionCookie = Cookies.get('userSession');
        if (userSessionCookie) {
          const userSession = JSON.parse(userSessionCookie);
          if (userSession && userSession.uid) userData = userSession;
        }
      } catch {}
    }
    if (userData) setUser(userData);
  }, []);

  // Handle reply mode
  useEffect(() => {
    if (isReply) {
      const page = searchParams.get('page') || '';
      const username = searchParams.get('username') || '';
      const replyToId = searchParams.get('replyTo') || '';
      const contentParam = searchParams.get('initialContent');

      setTitle("");

      // First try to use the initialContent from URL if available
      if (contentParam) {
        try {
          const parsedContent = JSON.parse(decodeURIComponent(contentParam));

          // Ensure we have at least 2 paragraphs (attribution and cursor position)
          let completeContent = [...parsedContent];
          if (completeContent.length < 2) {
            completeContent.push({ type: "paragraph", children: [{ text: "" }], placeholder: "Start typing your reply..." });
          }

          setInitialContent(completeContent);
          setEditorContent(completeContent);
          return;
        } catch (error) {
          console.error("Error parsing content from URL:", error);
          // Fall through to create new attribution
        }
      }

      // If no valid content from URL, create new attribution
      const attribution = createReplyAttribution({
        pageId: replyToId,
        pageTitle: page,
        userId: null,
        username: username
      });

      // Create a properly structured reply content with attribution and one empty paragraph
      const replyContent = [
        attribution, // This already has the isAttribution flag from createReplyAttribution
        { type: "paragraph", children: [{ text: "" }], placeholder: "Start typing your reply..." } // Where cursor will be positioned
      ];

      // Set both initial content and editor content to ensure consistency
      setInitialContent(replyContent);
      setEditorContent(replyContent);

      // Force a re-render of the editor with the new content
      setTimeout(() => {
        setInitialContent([...replyContent]);
      }, 100);
    } else {
      // Not a reply - handle normal page creation
      const titleParam = searchParams.get('title');
      const contentParam = searchParams.get('initialContent');
      if (titleParam) {
        try { setTitle(decodeURIComponent(titleParam)); } catch {}
      }
      if (contentParam) {
        try {
          const parsedContent = JSON.parse(decodeURIComponent(contentParam));
          setInitialContent(parsedContent);
          setEditorContent(parsedContent);
        } catch {}
      }
    }
  }, [isReply, searchParams]);

  const handleSave = async (content) => {
    setIsSaving(true);
    setError(null);
    if (!title && !isReply) {
      setError("Please add a title");
      setIsSaving(false);
      return;
    }
    try {
      const urlUsername = searchParams.get('username');
      const username = urlUsername || user?.username || user?.displayName || 'Anonymous';
      const userId = user?.uid || 'anonymous';
      if (!content || !Array.isArray(content) || content.length === 0) {
        setError("Error: Invalid content format");
        setIsSaving(false);
        return;
      }
      const data = {
        title: isReply ? "" : title,
        isPublic,
        location,
        content: JSON.stringify(content),
        userId,
        username,
        lastModified: new Date().toISOString(),
        isReply: !!isReply,
      };
      const res = await createPage(data);
      if (res) {
        ReactGA.event({ category: "Page", action: "Add new page", label: title });
        analytics.trackContentEvent(CONTENT_EVENTS.PAGE_CREATED, { label: title, page_id: res, is_reply: !!isReply });

        // Reset all change tracking states after a successful save
        setHasContentChanged(false);
        setHasTitleChanged(false);
        setHasUnsavedChanges(false);

        setIsSaving(false);
        router.push(`/pages/${res}`);
        return true; // Return true to indicate success for the useUnsavedChanges hook
      } else {
        setIsSaving(false);
        return false; // Return false to indicate failure for the useUnsavedChanges hook
      }
    } catch (error) {
      setIsSaving(false);
      setError("Failed to create page: " + (error.message || 'Unknown error'));
      return false; // Return false to indicate failure for the useUnsavedChanges hook
    }
  };

  // Update hasUnsavedChanges whenever content or title changes
  useEffect(() => {
    setHasUnsavedChanges(hasContentChanged || hasTitleChanged);
  }, [hasContentChanged, hasTitleChanged]);

  // Handle content changes
  const handleContentChange = (content) => {
    setEditorContent(content);

    // Check if content has changed from the initial content
    try {
      const originalContent = initialContent ? JSON.stringify(initialContent) : JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]);
      const newContent = JSON.stringify(content);

      setHasContentChanged(originalContent !== newContent);
    } catch (e) {
      console.error('Error comparing content:', e);
      setHasContentChanged(true);
    }
  };

  // Handle title changes
  const handleTitleChange = (newTitle) => {
    setTitle(newTitle);
    setHasTitleChanged(newTitle !== "");
  };

  // Memoized save function for the useUnsavedChanges hook
  const saveChanges = useCallback(() => {
    return handleSave(editorContent);
  }, [editorContent]);

  // Use the unsaved changes hook
  const {
    showUnsavedChangesDialog,
    handleNavigation,
    handleStayAndSave,
    handleLeaveWithoutSaving,
    handleCloseDialog,
    isHandlingNavigation
  } = useUnsavedChanges(hasUnsavedChanges, saveChanges);

  // Handle back button with unsaved changes check
  const handleBack = () => {
    // Get the URL to navigate to
    let backUrl = '/';

    // If replying, go back to the original page if possible
    if (isReply) {
      const replyToId = searchParams.get('replyTo');
      if (replyToId) {
        backUrl = `/pages/${replyToId}`;
      }
    } else if (window.history.length > 1) {
      // We can't directly use router.back() with the unsaved changes dialog
      // So we'll just go to the home page if there are unsaved changes
      backUrl = '/';
    }

    // Check for unsaved changes
    if (hasUnsavedChanges) {
      // If there are unsaved changes, show the confirmation dialog
      handleNavigation(backUrl);
    } else {
      // If no unsaved changes, just navigate
      if (isReply) {
        const replyToId = searchParams.get('replyTo');
        if (replyToId) {
          router.push(`/pages/${replyToId}`);
          return;
        }
      }

      // Otherwise, go back in history or to home
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    }
  };

  // Username for display
  const urlUsername = searchParams.get('username');
  const [displayUsername, setDisplayUsername] = useState('Loading...');
  useEffect(() => {
    let foundUsername = urlUsername || user?.displayName || user?.username || '';
    if (!foundUsername) foundUsername = 'Anonymous';
    setDisplayUsername(foundUsername);
  }, [urlUsername, user]);

  return (
    <DashboardLayout>
      {/* Use full-width layout on desktop, container on mobile */}
      <div className="w-full py-6 px-4 sm:px-6 lg:px-8 max-w-none">
        <div className="flex flex-col items-center w-full">
          <div className="flex flex-row items-center justify-center w-full mb-4 gap-2 max-w-4xl">
            <Button variant="outline" size="sm" onClick={handleBack} className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-semibold text-center flex-1">{isReply ? "Replying to page" : "New page"}</h1>
          </div>
          {/* Full-width editor container on desktop */}
          <HydrationSafetyWrapper>
            <div className="w-full max-w-none">
              <DynamicPageEditor
                title={isReply ? "" : title}
                setTitle={handleTitleChange}
                initialContent={initialContent || editorContent}
                onContentChange={handleContentChange}
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                location={location}
                setLocation={setLocation}
                onSave={handleSave}
                onCancel={handleBack}
                isSaving={isSaving}
                error={error}
                isNewPage={true}
                isReply={isReply}
              />
            </div>
          </HydrationSafetyWrapper>
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        onClose={handleCloseDialog}
        onStayAndSave={handleStayAndSave}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        isSaving={isSaving || isHandlingNavigation}
      />
    </DashboardLayout>
  );
}

