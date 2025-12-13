"use client";

import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2, Globe, Link, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import PillLink from './PillLink';
import EmptyState from '../ui/EmptyState';
import ExternalLinkPreviewModal from '../ui/ExternalLinkPreviewModal';

interface ExternalLinkData {
  url: string;
  text: string;
  pageId: string;
  pageTitle: string;
}

interface AggregatedExternalLinkData {
  url: string;
  text: string;
  globalCount: number;
  userCount: number;
  pages: Array<{
    pageId: string;
    pageTitle: string;
    lastModified?: any;
  }>;
  mostRecentModified?: any;
  oldestModified?: any;
}

type SortOption = 'recent' | 'oldest' | 'most_linked' | 'least_linked';

interface ExternalLinksTabProps {
  userId: string;
  username?: string;
  currentUserId?: string | null;
}

export default function ExternalLinksTab({
  userId,
  username = 'this user',
  currentUserId
}: ExternalLinksTabProps) {
  const [externalLinks, setExternalLinks] = useState<AggregatedExternalLinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<{
    url: string;
    text: string;
  } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  useEffect(() => {
    loadExternalLinks();
  }, [userId, currentUserId, sortBy]);

  const loadExternalLinks = async () => {
    setLoading(true);
    setError(null);

    try {
      // Import the function dynamically to avoid SSR issues
      const { getUserExternalLinksAggregated } = await import('../../firebase/database/links');
      const links = await getUserExternalLinksAggregated(userId, currentUserId, sortBy);
      setExternalLinks(links);
    } catch (err) {
      console.error('Error loading external links:', err);
      setError('Failed to load external links');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClick = (e: React.MouseEvent, link: AggregatedExternalLinkData) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedLink({
      url: link.url,
      text: link.text
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedLink(null);
  };

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case 'recent': return 'Most Recent';
      case 'oldest': return 'Oldest';
      case 'most_linked': return 'Most Linked';
      case 'least_linked': return 'Least Linked';
      default: return 'Most Recent';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading external links...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-2">Error loading external links</div>
        <button 
          onClick={loadExternalLinks}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!externalLinks || externalLinks.length === 0) {
    return (
      <EmptyState
        icon={Globe}
        title="No external links found"
        description={`${username} hasn't added any external links to their pages yet.`}
        size="lg"
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">External Links</h3>
          <span className="text-sm text-muted-foreground">
            ({externalLinks?.length || 0})
          </span>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border border-border rounded px-2 py-1 bg-background"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest</option>
            <option value="most_linked">Most Linked</option>
            <option value="least_linked">Least Linked</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <p className="text-muted-foreground">
          These are external links that {username} has added to their pages.
        </p>
      </div>

      {/* External Links List */}
      <div className="space-y-4">
        {externalLinks && externalLinks.map((link, index) => (
          <div
            key={`${link.url}-${index}`}
            className="p-4 border border-border rounded-lg hover:border-border/60 transition-colors"
          >
            {/* External Link Header */}
            <div className="flex items-center gap-2 mb-3">
              {/* External Link Pill */}
              <PillLink
                href={link.url}
                isPublic={true}
                className="flex-shrink-0"
                onClick={(e) => handleLinkClick(e, link)}
              >
                {link.text !== link.url ? link.text : new URL(link.url).hostname}
              </PillLink>

              {/* Global Count Badge */}
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground dark:bg-muted dark:text-muted-foreground">
                {link.globalCount} {link.globalCount === 1 ? 'link' : 'links'} across WeWrite
              </span>

              {/* User Count Badge (if more than one page) */}
              {link.userCount > 1 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {link.userCount} {link.userCount === 1 ? 'page' : 'pages'} by {username}
                </span>
              )}
            </div>

            {/* Show URL if different from text */}
            {link.text !== link.url && (
              <div className="text-xs text-muted-foreground mb-2">
                URL: {link.url}
              </div>
            )}

            {/* Pages List */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Linked from {username}'s {link.pages.length === 1 ? 'page' : 'pages'}:
              </div>
              <div className="flex flex-wrap gap-2">
                {link.pages.map((page, pageIndex) => (
                  <PillLink
                    key={`${page.pageId}-${pageIndex}`}
                    href={`/${page.pageId}`}
                    isPublic={true}
                    className="flex-shrink-0 text-sm"
                  >
                    {page.pageTitle}
                  </PillLink>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* External Link Modal */}
      {selectedLink && (
        <ExternalLinkPreviewModal
          isOpen={showModal}
          onClose={handleCloseModal}
          url={selectedLink.url}
          displayText={selectedLink.text}
          filterByUserId={userId}
          filterByUsername={username}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}