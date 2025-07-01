"use client";

import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2, Globe, Link } from 'lucide-react';
import { PillLink } from './PillLink';
import ExternalLinkPreviewModal from '../ui/ExternalLinkPreviewModal';

interface ExternalLinkData {
  url: string;
  text: string;
  pageId: string;
  pageTitle: string;
}

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
  const [externalLinks, setExternalLinks] = useState<ExternalLinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<{
    url: string;
    text: string;
  } | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadExternalLinks();
  }, [userId, currentUserId]);

  const loadExternalLinks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Import the function dynamically to avoid SSR issues
      const { getUserExternalLinks } = await import('../../firebase/database/links');
      const links = await getUserExternalLinks(userId, currentUserId);
      setExternalLinks(links);
    } catch (err) {
      console.error('Error loading external links:', err);
      setError('Failed to load external links');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClick = (e: React.MouseEvent, link: ExternalLinkData) => {
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
      <div className="text-center py-12">
        <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          No external links found
        </h3>
        <p className="text-sm text-muted-foreground">
          {username} hasn't added any external links to their pages yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Description */}
      <div className="mb-6">
        <p className="text-muted-foreground">
          These are external links that {username} has added to their pages.
        </p>
      </div>

      {/* External Links List */}
      <div className="space-y-3">
        {externalLinks && externalLinks.map((link, index) => (
          <div
            key={`${link.url}-${link.pageId}-${index}`}
            className="flex items-center gap-2 p-3 border border-border rounded-lg hover:border-border/60 transition-colors"
          >
            {/* External Link Display */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* External Link Pill */}
              <PillLink
                href={link.url}
                isPublic={true}
                className="flex-shrink-0"
                onClick={(e) => handleLinkClick(e, link)}
              >
                {link.text !== link.url ? link.text : new URL(link.url).hostname}
              </PillLink>

              {/* Show URL if different from text */}
              {link.text !== link.url && (
                <span className="text-xs text-muted-foreground">
                  ({link.url})
                </span>
              )}

              {/* "linked to from" text */}
              <span className="text-muted-foreground text-sm flex-shrink-0">linked to from</span>

              {/* Page Title Pill */}
              <PillLink
                href={`/${link.pageId}`}
                isPublic={true}
                className="flex-shrink-0"
              >
                {link.pageTitle}
              </PillLink>
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