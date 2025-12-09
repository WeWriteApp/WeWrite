"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { useProductionDataFetchJson } from '../../hooks/useProductionDataFetch';
import type { Page } from '../../types/database';
import { EmbeddedAllocationBar } from '../payments/EmbeddedAllocationBar';
import ViewableContent from '../content/ViewableContent';
import { LINE_MODES } from '../../contexts/LineSettingsContext';
import { PageProvider } from '../../contexts/PageContext';

// Simple cache for page data to prevent reloading
const pageCache = new Map<string, Page>();

interface DynamicPagePreviewCardProps {
  /** The page ID to fetch and display */
  pageId: string;
  /** Custom title to display (overrides fetched title) */
  customTitle?: string;
  /** Custom button text (defaults to "View Full Page") */
  buttonText?: string;
  /** Number of lines to show from the page content */
  maxLines?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show loading state */
  showLoading?: boolean;
  /** Whether to show embedded allocation bar */
  showAllocationBar?: boolean;
  /** Author ID for allocation bar */
  authorId?: string;
  /** Source identifier for allocation bar */
  allocationSource?: string;
  /** Whether the card is disabled (no interactions) */
  disabled?: boolean;
  /** Override the allocation interval (in cents) - used for landing page */
  allocationIntervalCents?: number;
  /** Disable opening the allocation detail modal - used for landing page */
  disableAllocationModal?: boolean;
  /** Disable long-press to change interval - used for landing page */
  disableAllocationLongPress?: boolean;
}

/**
 * DynamicPagePreviewCard Component
 * 
 * Fetches a page by ID and displays it as a preview card with:
 * - Page title
 * - First N lines of content (configurable)
 * - "View Full Page" button
 * 
 * Features:
 * - Automatic production data fetching for logged-out users
 * - Loading and error states
 * - Content processing to extract plain text
 * - Responsive design
 * - Configurable content length
 * 
 * Used for:
 * - Roadmap page preview
 * - Use cases page preview
 * - Any embedded page previews on landing page
 */
export function DynamicPagePreviewCard({
  pageId,
  customTitle,
  buttonText = "Read full page",
  maxLines = 5,
  className = "",
  showLoading = true,
  showAllocationBar = false,
  authorId = "system",
  allocationSource = "PreviewCard",
  disabled = false,
  allocationIntervalCents,
  disableAllocationModal = false,
  disableAllocationLongPress = false
}: DynamicPagePreviewCardProps) {
  const router = useRouter();
  const fetchJson = useProductionDataFetchJson();
  
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch page data with caching
  useEffect(() => {
    const fetchPage = async () => {
      try {
        // Check cache first
        const cachedPage = pageCache.get(pageId);
        if (cachedPage) {
          setPage(cachedPage);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);

        // Use production data fetch (automatically uses production data for logged-out users)
        console.log(`[DynamicPagePreviewCard] Fetching page data for pageId: ${pageId}`);
        const response = await fetchJson(`/api/pages/${pageId}`);
        console.log(`[DynamicPagePreviewCard] Response for ${pageId}:`, response);

        const pageData = response.pageData || response; // Handle different response structures
        console.log(`Page data for ${pageId}:`, pageData);

        // Cache the result
        pageCache.set(pageId, pageData);
        setPage(pageData);
      } catch (err) {
        console.error(`[DynamicPagePreviewCard] Failed to fetch page ${pageId}:`, err);
        // Don't show error for 404s - just skip this page silently
        if (err instanceof Error && err.message.includes('404')) {
          console.log(`[DynamicPagePreviewCard] Page ${pageId} not found in production, skipping`);
          setError(null);
          setPage(null);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load page');
        }
      } finally {
        setLoading(false);
      }
    };

    if (pageId) {
      fetchPage();
    }
  }, [pageId, fetchJson]);

  // Use the exact same content rendering system as the rest of the app
  // This ensures 100% consistency with how content appears on actual pages
  const renderContentPreview = (content: any, maxLines: number): React.ReactNode => {
    if (!content) return null;

    // Limit content to maxLines paragraphs for preview
    let limitedContent = content;
    if (Array.isArray(content)) {
      const paragraphs = content.filter(node => node.type === 'paragraph');
      limitedContent = paragraphs.slice(0, maxLines);
    }

    return (
      <div className="preview-content-container">
        <PageProvider>
          <ViewableContent
            content={limitedContent}
            showDiff={false}
            showLineNumbers={false} // Hide line numbers in preview
            isSearch={false}
            lineMode={LINE_MODES.NORMAL}
            className="text-sm md:text-base text-muted-foreground leading-relaxed"
          />
        </PageProvider>
      </div>
    );
  };



  // Handle navigation to full page
  const handleViewFullPage = () => {
    router.push(`/${pageId}`);
  };

  // Loading state
  if (loading && showLoading) {
    return (
      <Card className={`h-full wewrite-card ${className}`}>
        <CardContent className="p-6 flex items-center justify-center min-h-[200px]">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading preview...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`h-full wewrite-card ${className}`}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load preview</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // No page data - return null to hide the component instead of showing error
  if (!page) {
    console.log(`[DynamicPagePreviewCard] No page data for ${pageId}, hiding component`);
    return null;
  }

  const title = customTitle || page.title || 'Untitled';
  const renderedContent = renderContentPreview(page.content, maxLines);

  return (
    <Card
      className={`h-auto p-0 cursor-pointer wewrite-card transition-all duration-200 ${className}`}
      onClick={handleViewFullPage}
    >
      <CardHeader className="p-4 pb-3 md:p-6 md:pb-4">
        <CardTitle className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-center line-clamp-2">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 md:px-6 md:pb-6 flex flex-col flex-1 relative">
        {/* Preview content with 8 rendered lines limit and gradient fade using CSS mask */}
        <div
          className="flex-1 mb-4 md:mb-6 overflow-hidden relative min-h-[120px] bg-transparent"
          style={{
            maskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)'
          }}
        >
          {renderedContent ? (
            <div
              className="text-sm md:text-base text-card-foreground leading-relaxed text-left overflow-hidden [&_p]:!bg-transparent [&_div:not(.pill-link)]:!bg-transparent [&_span:not(.pill-link)]:!bg-transparent"
              style={{
                lineHeight: '1.4rem',
                maxHeight: `${maxLines * 1.4}rem`,
                background: 'transparent !important'
              }}
            >
              {renderedContent}
            </div>
          ) : (
            <p className="text-base text-card-foreground italic text-center bg-transparent">
              No content preview available
            </p>
          )}
        </div>

        {/* Embedded Allocation Bar */}
        {showAllocationBar && pageId && (
          <div
            className="relative z-20 mt-auto pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <EmbeddedAllocationBar
              pageId={pageId}
              authorId={authorId}
              pageTitle={title}
              source={allocationSource}
              overrideIntervalCents={allocationIntervalCents}
              disableDetailModal={disableAllocationModal}
              disableLongPress={disableAllocationLongPress}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DynamicPagePreviewCard;
