"use client";

import React, { useEffect, useState } from "react";
import { findBacklinks, findBacklinksWithFirestore } from "../firebase/database";
import { Loader, ExternalLink } from "lucide-react";
import PageList, { Page } from "./PageList";
import { Button } from "./ui/button";

interface Backlink {
  id: string;
  title: string;
  lastModified: string | null;
  userId: string | null;
  isPublic: boolean;
  createdAt: string; 
}

interface BacklinksSectionProps {
  pageId: string;
}

// Test data for debugging UI
const TEST_BACKLINKS: Page[] = [
  {
    id: 'test-backlink-1',
    title: "Test Backlink Page 1",
    isPublic: true,
    userId: "test-user",
    lastModified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    authorName: "Test Author"
  },
  {
    id: 'test-backlink-2',
    title: "Test Backlink Page 2",
    isPublic: true,
    userId: "test-user",
    lastModified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    authorName: "Test Author"
  }
];

export default function BacklinksSection({ pageId }: BacklinksSectionProps) {
  const [backlinks, setBacklinks] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [useTestData, setUseTestData] = useState(false);

  useEffect(() => {
    async function loadBacklinks() {
      if (!pageId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log(`[BacklinksSection] Loading backlinks for page ${pageId}`);
        
        // First try with Firestore implementation
        let links = await findBacklinksWithFirestore(pageId);
        
        // If no results, fall back to original implementation
        if (!links || links.length === 0) {
          console.log("[BacklinksSection] No backlinks found with Firestore, trying RTDB...");
          links = await findBacklinks(pageId);
        }
        
        console.log("[BacklinksSection] Backlinks loaded:", JSON.stringify(links, null, 2));
        
        if (!links || links.length === 0) {
          console.log("[BacklinksSection] No backlinks found with either method");
          // If the real methods don't return anything, check if we should use test data
          if (useTestData) {
            console.log("[BacklinksSection] Using test backlinks data");
            setBacklinks(TEST_BACKLINKS);
          } else {
            setBacklinks([]);
          }
          setLoading(false);
          return;
        }
        
        // Convert to the format expected by PageList
        const formattedLinks: Page[] = links.map(link => ({
          id: link.id,
          title: link.title || "Untitled Page",
          isPublic: link.isPublic || true, 
          userId: link.userId || "",
          lastModified: link.lastModified,
          createdAt: link.lastModified || new Date().toISOString(),
          authorName: "" 
        }));
        
        console.log("[BacklinksSection] Formatted links:", JSON.stringify(formattedLinks, null, 2));
        setBacklinks(formattedLinks);
      } catch (error) {
        console.error("[BacklinksSection] Error loading backlinks:", error);
        setError("Failed to load backlinks");
        
        // On error, optionally use test data
        if (useTestData) {
          console.log("[BacklinksSection] Using test backlinks data after error");
          setBacklinks(TEST_BACKLINKS);
        }
      } finally {
        setLoading(false);
      }
    }

    loadBacklinks();
  }, [pageId, retryCount, useTestData]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const toggleTestData = () => {
    setUseTestData(prev => !prev);
  };

  const BacklinksEmptyState = () => (
    <div className="text-center py-4">
      <p className="text-sm text-muted-foreground">No pages link to this page yet.</p>
      <p className="text-xs text-muted-foreground mt-1">
        When other pages link to this one, they'll appear here.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleTestData}
        className="mt-3"
      >
        {useTestData ? "Hide Test Data" : "Show Test Data"}
      </Button>
    </div>
  );

  const ErrorState = () => (
    <div className="text-center py-4">
      <p className="text-sm text-red-500 mb-2">{error}</p>
      <div className="flex items-center gap-2 justify-center">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRetry}
          className="flex items-center gap-1"
        >
          <Loader className="h-3 w-3" />
          Retry
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTestData}
        >
          {useTestData ? "Hide Test Data" : "Show Test Data"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mt-6 border-t border-border pt-6 pb-6 px-4 sm:px-6">
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
