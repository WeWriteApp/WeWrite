"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { findBacklinks } from "../firebase/database";
import { Loader } from "lucide-react";

interface Backlink {
  id: string;
  title: string;
  lastModified: string | null;
  userId: string | null;
}

interface BacklinksSectionProps {
  pageId: string;
}

export default function BacklinksSection({ pageId }: BacklinksSectionProps) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBacklinks() {
      if (!pageId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log(`Loading backlinks for page ${pageId}`);
        const links = await findBacklinks(pageId);
        setBacklinks(links);
      } catch (error) {
        console.error("Error loading backlinks:", error);
        setError("Failed to load backlinks");
      } finally {
        setLoading(false);
      }
    }

    loadBacklinks();
  }, [pageId]);

  if (loading) {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">What links here</h3>
        <div className="flex items-center justify-center py-4">
          <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">What links here</h3>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">What links here</h3>
        <p className="text-sm text-muted-foreground">No pages link to this page yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">What links here</h3>
      <div className="flex flex-wrap gap-2">
        {backlinks.map((link) => (
          <Link 
            key={link.id} 
            href={`/pages/${link.id}`}
            className="text-sm px-2 py-1 bg-muted hover:bg-muted/80 rounded-md text-foreground"
          >
            {link.title || "Untitled Page"}
          </Link>
        ))}
      </div>
    </div>
  );
}
