"use client"

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from './button';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
// Removed PillLink import to break circular dependency
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';

interface ExternalLinkPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  displayText?: string;
  className?: string;
  // Optional: Show only pages by a specific user
  filterByUserId?: string;
  filterByUsername?: string;
  currentUserId?: string | null;
}

interface RelatedPage {
  id: string;
  title: string;
  username?: string;
  lastModified: any;
  matchType: 'exact' | 'partial';
  matchedUrl?: string;
}

export function ExternalLinkPreviewModal({
  isOpen,
  onClose,
  url,
  displayText,
  className,
  filterByUserId,
  filterByUsername,
  currentUserId
}: ExternalLinkPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [relatedPages, setRelatedPages] = useState<RelatedPage[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const analytics = useWeWriteAnalytics();

  // Ensure we're mounted on the client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load related pages when modal opens
  useEffect(() => {
    if (isOpen && url) {
      loadRelatedPages();
    }
  }, [isOpen, url, filterByUserId]);

  const loadRelatedPages = async () => {
    setLoadingRelated(true);
    try {
      if (filterByUserId) {
        // Import the user-specific function for filtered results
        const { findUserPagesLinkingToExternalUrl } = await import('../../firebase/database/links');
        const pages = await findUserPagesLinkingToExternalUrl(url, filterByUserId, currentUserId);
        setRelatedPages(pages);
      } else {
        // Import the general function for all pages
        const { findPagesLinkingToExternalUrl } = await import('../../firebase/database/links');
        const pages = await findPagesLinkingToExternalUrl(url, 10);
        setRelatedPages(pages);
      }
    } catch (error) {
      console.error('Error loading related pages:', error);
      setRelatedPages([]);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleVisitLink = () => {
    // Track external link click
    analytics.trackInteractionEvent(ANALYTICS_EVENTS.EXTERNAL_LINK_CLICKED, {
      url,
      source: 'preview_modal',
      display_text: displayText
    });

    // Open link
    if (window.navigator.standalone) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  // Don't render anything on server side or if not mounted
  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
          onClick={handleBackdropClick}
          aria-modal="true"
          role="dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100
          }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Compact Modal Content */}
          <motion.div
            className={cn(
              "relative bg-background border-theme-strong rounded-lg shadow-lg max-w-md w-full mx-4",
              "max-h-[80vh] overflow-y-auto",
              className
            )}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-theme-medium">
              <div className="flex items-center gap-2">
                <Icon name="ExternalLink" size={16} className="text-muted-foreground" />
                <h3 className="text-lg font-semibold">External Link</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                aria-label="Close"
              >
                <Icon name="X" size={16} />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Link Details */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">You're about to visit:</p>
                <div className="bg-muted p-3 rounded text-sm break-all">
                  <code>{url}</code>
                </div>
                {displayText && displayText !== url && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Display text: <span className="font-medium">{displayText}</span>
                  </p>
                )}
              </div>

              {/* Related Pages Section */}
              <div>
                {loadingRelated ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon name="Loader" />
                    Loading related pages...
                  </div>
                ) : (
                  <>
                    {/* Exact Matches */}
                    {(() => {
                      const exactMatches = relatedPages.filter(p => p.matchType === 'exact');
                      const partialMatches = relatedPages.filter(p => p.matchType === 'partial');

                      return (
                        <>
                          {/* Exact matches section */}
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon name="Link" size={16} className="text-muted-foreground" />
                              <h4 className="text-sm font-medium">
                                {filterByUserId && filterByUsername
                                  ? `${filterByUsername}'s pages linking to this exact URL`
                                  : "Pages linking to this exact URL"
                                }
                              </h4>
                            </div>
                            {exactMatches.length > 0 ? (
                              <div className="space-y-2 pl-6">
                                {exactMatches.map((page) => (
                                  <div key={page.id} className="flex items-center gap-2">
                                    <a
                                      href={`/${page.id}`}
                                      className="text-xs text-primary hover:text-foreground underline"
                                    >
                                      {page.title}
                                    </a>
                                    {page.username && (
                                      <span className="text-xs text-muted-foreground">
                                        by {page.username}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground pl-6">
                                {filterByUserId && filterByUsername
                                  ? `${filterByUsername} hasn't linked to this exact URL.`
                                  : "No pages link to this exact URL yet."
                                }
                              </p>
                            )}
                          </div>

                          {/* Partial matches section (same domain) */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Icon name="Globe" size={16} className="text-muted-foreground" />
                              <h4 className="text-sm font-medium">
                                {filterByUserId && filterByUsername
                                  ? `${filterByUsername}'s pages linking to this domain`
                                  : "Pages linking to this domain"
                                }
                              </h4>
                            </div>
                            {partialMatches.length > 0 ? (
                              <div className="space-y-2 pl-6">
                                {partialMatches.map((page) => (
                                  <div key={page.id} className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={`/${page.id}`}
                                        className="text-xs text-primary hover:text-foreground underline"
                                      >
                                        {page.title}
                                      </a>
                                      {page.username && (
                                        <span className="text-xs text-muted-foreground">
                                          by {page.username}
                                        </span>
                                      )}
                                    </div>
                                    {page.matchedUrl && (
                                      <span className="text-[10px] text-muted-foreground/70 truncate max-w-full">
                                        → {page.matchedUrl}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground pl-6">
                                {filterByUserId && filterByUsername
                                  ? `${filterByUsername} hasn't linked to this domain.`
                                  : "No pages link to this domain yet."
                                }
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-theme-medium">
              <Button variant="secondary" onClick={onClose}>
                Back
              </Button>
              <Button variant="default" onClick={handleVisitLink}>
                <Icon name="ExternalLink" size={16} className="mr-2" />
                Visit link
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body);
}

export default ExternalLinkPreviewModal;