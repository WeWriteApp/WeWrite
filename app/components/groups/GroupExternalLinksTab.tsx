'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import PillLink from '../utils/PillLink';
import EmptyState from '../ui/EmptyState';
import ExternalLinkPreviewModal from '../ui/ExternalLinkPreviewModal';

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

interface GroupExternalLinksTabProps {
  groupId: string;
  groupName: string;
  currentUserId?: string | null;
}

export default function GroupExternalLinksTab({
  groupId,
  groupName,
  currentUserId,
}: GroupExternalLinksTabProps) {
  const [externalLinks, setExternalLinks] = useState<AggregatedExternalLinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<{ url: string; text: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  useEffect(() => {
    loadExternalLinks();
  }, [groupId, currentUserId, sortBy]);

  const loadExternalLinks = async () => {
    setLoading(true);
    setError(null);

    try {
      const { getGroupExternalLinksAggregated } = await import('../../firebase/database/links');
      const links = await getGroupExternalLinksAggregated(groupId, currentUserId ?? null, sortBy);
      setExternalLinks(links);
    } catch (err) {
      console.error('Error loading group external links:', err);
      setError('Failed to load external links');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClick = (e: React.MouseEvent, link: AggregatedExternalLinkData) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLink({ url: link.url, text: link.text });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedLink(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon name="Loader" />
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
        icon="Globe"
        title="No external links found"
        description="This group doesn't have any external links in its pages yet."
        size="lg"
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="Globe" size={20} className="text-muted-foreground" />
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
          External links from group pages.
        </p>
      </div>

      {/* External Links List */}
      <div className="space-y-4">
        {externalLinks.map((link, index) => (
          <div
            key={`${link.url}-${index}`}
            className="p-4 border border-border rounded-lg hover:border-border/60 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <PillLink
                href={link.url}
                isPublic={true}
                className="flex-shrink-0"
                onClick={(e) => handleLinkClick(e, link)}
              >
                {link.text !== link.url ? link.text : new URL(link.url).hostname}
              </PillLink>

              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground dark:bg-muted dark:text-muted-foreground">
                {link.globalCount} {link.globalCount === 1 ? 'link' : 'links'} across WeWrite
              </span>

              {link.userCount > 1 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {link.userCount} {link.userCount === 1 ? 'page' : 'pages'} in group
                </span>
              )}
            </div>

            {link.text !== link.url && (
              <div className="text-xs text-muted-foreground mb-2">
                URL: {link.url}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Linked from {link.pages.length === 1 ? 'page' : 'pages'}:
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

      {selectedLink && (
        <ExternalLinkPreviewModal
          isOpen={showModal}
          onClose={handleCloseModal}
          url={selectedLink.url}
          displayText={selectedLink.text}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
