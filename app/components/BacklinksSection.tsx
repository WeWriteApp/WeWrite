"use client";

import React, { useEffect, useState } from "react";
import { findBacklinks } from "../firebase/database";
import { Loader, ExternalLink } from "lucide-react";
import PageList from "./PageList";
import { Button } from "./ui/button";

interface Backlink {
  id: string;
  title: string;
  lastModified: string | null;
  userId: string | null;
  isPublic: boolean;
}

interface BacklinksSectionProps {
  pageId: string;
}

export default function BacklinksSection({ pageId }: BacklinksSectionProps) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
          isPublic: link.isPublic || true, // Use the isPublic property or default to true
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
  }, [pageId, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const BacklinksEmptyState = () => (
    <div className="text-center py-4">
      <p className="text-sm text-muted-foreground">No pages link to this page yet.</p>
      <p className="text-xs text-muted-foreground mt-1">
        When other pages link to this one, they'll appear here.
      </p>
    </div>
  );

  const ErrorState = () => (
    <div className="text-center py-4">
      <p className="text-sm text-red-500 mb-2">{error}</p>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleRetry}
        className="flex items-center gap-1"
      >
        <Loader className="h-3 w-3" />
        Retry
      </Button>
    </div>
  );

  return (
    <div className="mt-6 border-t border-border pt-4 pb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          What links here {backlinks.length > 0 && `(${backlinks.length})`}
        </h3>
        {backlinks.length > 5 && (
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="flex items-center gap-1 text-xs"
          >
            <a href={`/pages/${pageId}/backlinks`}>
              View all <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        )}
      </div>
      
      {error ? (
        <ErrorState />
      ) : (
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
      )}
    </div>
  );
}
