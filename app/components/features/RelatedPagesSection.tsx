"use client";

import React, { useState, useEffect } from 'react';
import { PillLink } from "../utils/PillLink";
import { Icon } from '@/components/ui/Icon';
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
      {/* Related Pages by Others - only show if loading or has results */}
      {(loading || relatedByOthers.length > 0) && (
        <div className="wewrite-card">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Users" size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-medium">Related pages by others</h3>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Loader" />
              <span>Finding related content...</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {relatedByOthers.map((relatedPage) => (
                <PillLink key={relatedPage.id} href={`/${relatedPage.id}`}>
                  {relatedPage.title || "Untitled"}
                </PillLink>
              ))}
            </div>
          )}
        </div>
      )}

      {/* More by Same Author - only show if loading or has results */}
      {(loading || relatedByAuthor.length > 0) && (
        <div className="wewrite-card">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="User" size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-medium">
              More by {authorUsername || page?.username || 'this author'}
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Loader" />
              <span>Loading author's pages...</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {relatedByAuthor.map((relatedPage) => (
                <PillLink key={relatedPage.id} href={`/${relatedPage.id}`}>
                  {relatedPage.title || "Untitled"}
                </PillLink>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
