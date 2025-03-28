"use client";

import React, { useEffect, useState } from "react";
import { findBacklinksSimple } from "../firebase/database";
import { Loader } from "lucide-react";
import PageList, { Page } from "./PageList";

interface BacklinksSectionProps {
  pageId: string;
}

const BacklinksEmptyState = () => (
  <div className="text-sm text-muted-foreground">
    No pages link to this page yet.
    <br />
    When other pages link to this one, they'll appear here.
  </div>
);

const ErrorState = () => (
  <div className="text-sm text-muted-foreground">
    Error loading backlinks. Please try again later.
  </div>
);

export default function BacklinksSection({ pageId }: BacklinksSectionProps) {
  const [backlinks, setBacklinks] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    async function loadBacklinks() {
      if (!pageId) {
        console.log("[BacklinksSection] No pageId provided");
        setLoading(false);
        return;
      }
      
      try {
        console.log(`[BacklinksSection] Loading backlinks for page ${pageId}`);
        const links = await findBacklinksSimple(pageId);
        console.log("[BacklinksSection] Found backlinks:", links);
        
        if (!links || links.length === 0) {
          console.log("[BacklinksSection] No backlinks found");
          setBacklinks([]);
        } else {
          setBacklinks(links);
        }
        
      } catch (err) {
        console.error("[BacklinksSection] Error loading backlinks:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    
    loadBacklinks();
  }, [pageId]);
  
  if (error) {
    return <ErrorState />;
  }
  
  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">What links here</h2>
      <PageList 
        pages={backlinks}
        mode="wrapped"
        loading={loading}
        emptyState={<BacklinksEmptyState />}
        maxItems={5}
        showViewAll={backlinks.length > 5}
        viewAllHref={`/pages/${pageId}/backlinks`}
        viewAllText="View all backlinks"
      />
    </div>
  );
}
