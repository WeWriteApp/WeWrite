"use client";

import React, { useState, useEffect } from 'react';
import { PillLink } from "../utils/PillLink";
import { Loader2, User, Users } from 'lucide-react';
import { useRelatedPagesV2, type RelatedPage } from '../../hooks/useRelatedPagesV2';

interface RelatedPagesSectionProps {
  page: {
    id: string;
    title: string;
    content?: string;
    username?: string;
    userId?: string;
    isPublic?: boolean;
  };
  linkedPageIds?: string[];
}

// Sub-component for rendering a list of related pages
function RelatedPagesList({ pages, emptyMessage }: { pages: RelatedPage[]; emptyMessage: string }) {
  if (pages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pages.map((relatedPage) => (
        <PillLink key={relatedPage.id} href={`/${relatedPage.id}`}>
          {relatedPage.title || "Untitled"}
        </PillLink>
      ))}
    </div>
  );
}

export default function RelatedPagesSection({ page, linkedPageIds = [] }: RelatedPagesSectionProps) {
  const [mounted, setMounted] = useState(false);

  // Use the v2 hook with Algolia-powered search
  const {
    relatedByOthers,
    relatedByAuthor,
    authorUsername,
    loading,
    error,
  } = useRelatedPagesV2({
    pageId: page?.id || '',
    pageTitle: page?.title,
    pageContent: typeof page?.content === 'string' ? page.content : JSON.stringify(page?.content || ''),
    authorId: page?.userId,
    authorUsername: page?.username,
    excludePageIds: linkedPageIds,
    limitByOthers: 8,
    limitByAuthor: 5,
  });

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Don't render if no results and not loading
  const hasAnyResults = relatedByOthers.length > 0 || relatedByAuthor.length > 0;
  if (!loading && !hasAnyResults) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Related Pages by Others */}
      <div className="wewrite-card">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Related pages by others</h3>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Finding related content...</span>
          </div>
        ) : (
          <RelatedPagesList
            pages={relatedByOthers}
            emptyMessage="No related pages found"
          />
        )}
      </div>

      {/* More by Same Author */}
      {(loading || relatedByAuthor.length > 0) && (
        <div className="wewrite-card">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">
              More by {authorUsername || page?.username || 'this author'}
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading author's pages...</span>
            </div>
          ) : (
            <RelatedPagesList
              pages={relatedByAuthor}
              emptyMessage="No other public pages by this author"
            />
          )}
        </div>
      )}
    </div>
  );
}
