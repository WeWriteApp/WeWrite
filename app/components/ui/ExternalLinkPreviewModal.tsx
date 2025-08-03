"use client"

import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { X, ExternalLink, Users, Loader2 } from 'lucide-react';
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
        const pages = await findPagesLinkingToExternalUrl(url, 5);
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
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">External Link</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
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
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">
                    {filterByUserId && filterByUsername
                      ? `${filterByUsername}'s pages linking here`
                      : "Other WeWrite pages linking here"
                    }
                  </h4>
                </div>
                
                {loadingRelated ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </div>
                ) : relatedPages.length > 0 ? (
                  <div className="space-y-2">
                    {relatedPages.map((page) => (
                      <div key={page.id} className="flex items-center gap-2">
                        <a
                          href={`/${page.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
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
                  <p className="text-sm text-muted-foreground">
                    {filterByUserId && filterByUsername
                      ? `${filterByUsername} hasn't linked to this URL in any other pages.`
                      : "No other WeWrite pages link to this URL yet."
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-theme-medium">
              <Button variant="outline" onClick={onClose}>
                Back
              </Button>
              <Button variant="default" onClick={handleVisitLink}>
                <ExternalLink className="h-4 w-4 mr-2" />
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