"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { db } from "../../firebase/config";
import { collection, addDoc } from "firebase/firestore";
import PageHeader from "../../components/PageHeader";
import Button from "../../components/Button";

export default function NewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const doc = await addDoc(collection(db, "pages"), {
        title: title || "Untitled",
        content: "",
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