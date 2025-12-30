"use client";

import React, { useState, useEffect } from 'react';
import { PageLinksCard, PageLinkItem } from '../ui/PageLinksCard';
import { useRelatedPages, type RelatedPage } from '../../hooks/useRelatedPages';

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

  // Use Algolia-powered search
  const {
    relatedByOthers,
    relatedByAuthor,
    authorUsername,
    loading,
    error,
  } = useRelatedPages({
    pageId: page?.id || '',
    pageTitle: page?.title,
    pageContent: typeof page?.content === 'string' ? page.content : JSON.stringify(page?.content || ''),
    authorId: page?.userId,
    authorUsername: page?.username,
    excludePageIds: linkedPageIds,
    limitByOthers: 20, // Increased limit for load more functionality
    limitByAuthor: 20,
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

  // Convert related pages to PageLinkItem format
  const relatedByOthersItems: PageLinkItem[] = relatedByOthers.map((relatedPage) => ({
    id: relatedPage.id,
    title: relatedPage.title || 'Untitled',
    href: `/${relatedPage.id}`
  }));

  const relatedByAuthorItems: PageLinkItem[] = relatedByAuthor.map((relatedPage) => ({
    id: relatedPage.id,
    title: relatedPage.title || 'Untitled',
    href: `/${relatedPage.id}`
  }));

  const authorName = authorUsername || page?.username || 'this author';

  return (
    <div className="space-y-4">
      {/* Related Pages by Others */}
      <PageLinksCard
        icon="Users"
        title="Related pages by others"
        items={relatedByOthersItems}
        loading={loading}
        initialLimit={8}
        hideWhenEmpty={true}
        pillCounter={true}
      />

      {/* More by Same Author */}
      <PageLinksCard
        icon="User"
        title={`More by ${authorName}`}
        items={relatedByAuthorItems}
        loading={loading}
        initialLimit={5}
        hideWhenEmpty={true}
        pillCounter={true}
      />
    </div>
  );
}
