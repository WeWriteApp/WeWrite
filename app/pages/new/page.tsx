"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { db } from "../../firebase/config";
import { collection, addDoc } from "firebase/firestore";
import PageHeader from "../../components/PageHeader";
import Button from "../../components/Button";
import { PillLink } from "../../components/PillLink";

export default function NewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [title, setTitle] = React.useState("");
  const [initialContent, setInitialContent] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Check for query parameters when component mounts
  React.useEffect(() => {
    const titleParam = searchParams.get("title");
    const contentParam = searchParams.get("initialContent");
    
    if (titleParam) {
      setTitle(titleParam);
    }
    
    if (contentParam) {
      try {
        const decodedContent = JSON.parse(decodeURIComponent(contentParam));
        setInitialContent(decodedContent);
      } catch (error) {
        console.error("Error parsing initial content:", error);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const doc = await addDoc(collection(db, "pages"), {
        title: title || "Untitled",
        content: initialContent ? JSON.stringify(initialContent) : "",
        userId: user.uid,
        username: user.displayName || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      router.push(`/pages/${doc.id}`);
    } catch (error) {
      console.error("Error creating page:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInitialContent = () => {
    if (!initialContent || !Array.isArray(initialContent)) return null;
    
    return (
      <div className="border rounded-md bg-card p-4">
        <h3 className="text-sm font-medium mb-2">Initial Content</h3>
        <div className="text-sm space-y-2">
          {initialContent.map((node, index) => {
            if (node.type === "paragraph") {
              return (
                <div key={index} className="flex gap-1 items-start flex-wrap">
                  {node.children?.map((child, childIndex) => {
                    if (child.type === "link") {
                      return (
                        <PillLink 
                          key={childIndex} 
                          href={child.url || "#"}
                          isPublic={true}
                          groupId={null}
                          className=""
                          isOwned={true}
                          byline={null}
                          isLoading={false}
                        >
                          {child.displayText || child.children?.[0]?.text || "Link"}
                        </PillLink>
                      );
                    }
                    return <span key={childIndex}>{child.text}</span>;
                  })}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="New Page" />
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
          
          {initialContent && renderInitialContent()}
          
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