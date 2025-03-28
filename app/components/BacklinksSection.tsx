"use client";

import React, { useEffect, useState } from "react";
import { findBacklinks } from "../firebase/database";
import { Loader } from "lucide-react";
import PageList from "./PageList";

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
        console.log("Backlinks loaded:", links);
        
        // Convert to the format expected by PageList
        const formattedLinks = links.map(link => ({
          id: link.id,
          title: link.title || "Untitled Page",
          isPublic: true, // Assume public since we can see it
          userId: link.userId || "",
          lastModified: link.lastModified,
          createdAt: link.lastModified || new Date().toISOString()
        }));
        
        setBacklinks(formattedLinks);
      } catch (error) {
        console.error("Error loading backlinks:", error);
        setError("Failed to load backlinks");
      } finally {
        setLoading(false);
      }
    }

    loadBacklinks();
  }, [pageId]);

  const BacklinksEmptyState = () => (
    <div className="text-center py-4">
      <p className="text-sm text-muted-foreground">No pages link to this page yet.</p>
    </div>
  );

  return (
    <div className="mt-6 border-t border-border pt-4 pb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        What links here {backlinks.length > 0 && `(${backlinks.length})`}
      </h3>
      
      {error ? (
        <p className="text-sm text-red-500 py-2">{error}</p>
      ) : (
        <PageList 
          pages={backlinks}
          mode="wrapped"
          loading={loading}
          emptyState={<BacklinksEmptyState />}
          maxItems={10}
          showViewAll={backlinks.length > 10}
          viewAllHref={`/pages/${pageId}/backlinks`}
          viewAllText="View all backlinks"
        />
      )}
    </div>
  );
}
