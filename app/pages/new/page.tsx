"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { db } from "../../firebase/config";
import { collection, addDoc } from "firebase/firestore";
import PageHeader from "../../components/PageHeader";
import Button from "../../components/Button";
import { PillLink } from "../../components/PillLink";
import dynamic from 'next/dynamic';
import { useHotkeys } from "react-hotkeys-hook";

// Import SlateEditor dynamically to avoid TypeScript errors with forwardRef
const SlateEditor = dynamic(() => import('../../components/SlateEditor'), { ssr: false });

export default function NewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [title, setTitle] = React.useState("");
  const [initialContent, setInitialContent] = React.useState<any>(null);
  const [editorState, setEditorState] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const editorRef = React.useRef(null);

  // Check for query parameters when component mounts
  React.useEffect(() => {
    // Parse the initialContent from the URL if available
    if (searchParams && searchParams.get("initialContent")) {
      try {
        const parsedContent = JSON.parse(decodeURIComponent(searchParams.get("initialContent")));
        setInitialContent(parsedContent);
      } catch (error) {
        console.error("Error parsing initial content:", error);
        // If parsing fails, set a default empty paragraph
        setInitialContent([{ type: "paragraph", children: [{ text: "" }] }]);
      }
    } else {
      // Set default empty content if none provided
      setInitialContent([{ type: "paragraph", children: [{ text: "" }] }]);
    }

    // Set the title from URL if available
    if (searchParams && searchParams.get("title")) {
      try {
        setTitle(decodeURIComponent(searchParams.get("title")));
      } catch (error) {
        console.error("Error decoding title:", error);
        setTitle("");
      }
    }
  }, [searchParams]);

  // Add keyboard shortcut for submitting the form
  useHotkeys('meta+enter', () => {
    handleSubmit(new Event('submit') as any);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      // Ensure we have content to save
      const contentToSave = editorState ? JSON.stringify(editorState) : JSON.stringify([
        { type: "paragraph", children: [{ text: "" }] }
      ]);

      // Create the page document
      const doc = await addDoc(collection(db, "pages"), {
        title: title || "Untitled",
        content: contentToSave,
        userId: user.uid,
        username: user.username || user.displayName || user.email?.split('@')[0] || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: true, // Default to public
      });
      
      console.log("Page created successfully with ID:", doc.id);
      
      // Redirect to the newly created page
      router.replace(`/pages/${doc.id}`);
    } catch (error) {
      console.error("Error creating page:", error);
      alert("Failed to create page. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="New Page" username={user?.displayName || user?.email?.split('@')[0] || "Anonymous"} />
      <main className="container py-6">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Page Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter page title..."
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>
          
          <div className="border rounded-md bg-card p-4">
            {initialContent && (
              <SlateEditor 
                // @ts-ignore - SlateEditor accepts these props but TypeScript doesn't recognize them with dynamic import
                initialEditorState={initialContent} 
                setEditorState={setEditorState}
                ref={editorRef}
              />
            )}
          </div>
          
          <Button
            type="submit"
            disabled={isLoading}
            variant="secondary"
            className="w-full"
          >
            {isLoading ? "Creating..." : "Create Page"}
          </Button>
        </form>
      </main>
    </div>
  );
}