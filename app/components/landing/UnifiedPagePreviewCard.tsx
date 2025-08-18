"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { useProductionDataFetchJson } from '../../hooks/useProductionDataFetch';
import type { Page } from '../../types/database';
import { PillLink } from '../utils/PillLink';
import { EmbeddedAllocationBar } from '../payments/EmbeddedAllocationBar';

// Simple cache for page data to prevent reloading
const pageCache = new Map<string, Page>();

interface UnifiedPagePreviewCardProps {
  /** The page ID to fetch and display (for dynamic content) */
  pageId?: string;
  /** Static title to display */
  title?: string;
  /** Static content to display (alternative to fetching from pageId) */
  content?: string | React.ReactNode;
  /** Custom button text (defaults to "Read full page") */
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
  /** Custom click handler (overrides default navigation) */
  onClick?: () => void;
  /** Whether this card is disabled/non-interactive */
  disabled?: boolean;
}

/**
 * UnifiedPagePreviewCard Component
 * 
 * A flexible card component that can display either:
 * 1. Dynamic content fetched from a pageId
 * 2. Static content passed as props
 * 
 * Features:
 * - Automatic production data fetching for logged-out users (when pageId provided)
 * - Loading and error states
 * - Content processing to extract plain text
 * - Responsive design
 * - Configurable content length with 8 rendered lines limit
 * - Consistent styling across all use cases
 * - Proper overflow handling to prevent content bleeding
 * 
 * Used for:
 * - Write/Share/Earn hero cards
 * - Roadmap page preview
 * - Use cases page preview
 * - Any embedded page previews
 */
export function UnifiedPagePreviewCard({
  pageId,
  title,
  content,
  buttonText = "Read full page",
  maxLines = 8,
  className = "",
  showLoading = true,
  showAllocationBar = false,
  authorId = "system",
  allocationSource = "PreviewCard",
  onClick,
  disabled = false
}: UnifiedPagePreviewCardProps) {
  const router = useRouter();
  const fetchJson = useProductionDataFetchJson();
  
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch page data with caching (only if pageId is provided)
  useEffect(() => {
    if (!pageId) return;

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
        const response = await fetchJson(`/api/pages/${pageId}`);
        const pageData = response.pageData || response; // Handle different response structures

        // Cache the result
        pageCache.set(pageId, pageData);
        setPage(pageData);
      } catch (err) {
        console.error(`Failed to fetch page ${pageId}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [pageId, fetchJson]);

  // Render content with inline links as JSX elements but with better text flow
  const renderContentWithInlineLinks = (content: any, maxLines: number): React.ReactNode => {
    if (!content) return null;

    // Handle React node content (static)
    if (React.isValidElement(content)) {
      return content;
    }

    // Handle string content
    if (typeof content === 'string') {
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      const previewLines = lines.slice(0, maxLines);
      return previewLines.join('\n');
    }

    // Handle editor content (array of nodes) - from fetched pages
    if (Array.isArray(content)) {
      const elements: React.ReactNode[] = [];
      let textContent = '';

      for (const node of content) {
        if (node.children) {
          for (const child of node.children) {
            // Handle link elements
            if (child.type === 'link' && child.url) {
              const linkText = child.children?.map((c: any) => c.text || '').join('') || child.url;

              // Add any accumulated text before the link
              if (textContent.trim()) {
                elements.push(textContent + ' ');
                textContent = '';
              }

              elements.push(
                <PillLink
                  key={`link-${elements.length}`}
                  href={child.url}
                  isPublic={true}
                  className="mx-0.5 text-xs scale-90 inline-block"
                  clickable={false}
                >
                  {linkText}
                </PillLink>
              );
              elements.push(' '); // Add space after link
            }
            // Handle regular text
            else if (child.text) {
              textContent += child.text;
            }
            // Handle nested children
            else if (child.children) {
              for (const nestedChild of child.children) {
                if (nestedChild.type === 'link' && nestedChild.url) {
                  const linkText = nestedChild.children?.map((c: any) => c.text || '').join('') || nestedChild.url;

                  // Add any accumulated text before the link
                  if (textContent.trim()) {
                    elements.push(textContent + ' ');
                    textContent = '';
                  }

                  elements.push(
                    <PillLink
                      key={`nested-link-${elements.length}`}
                      href={nestedChild.url}
                      isPublic={true}
                      className="mx-0.5 text-xs scale-90 inline-block"
                      clickable={false}
                    >
                      {linkText}
                    </PillLink>
                  );
                  elements.push(' '); // Add space after link
                } else if (nestedChild.text) {
                  textContent += nestedChild.text;
                }
              }
            }
          }
        }
      }

      // Add any remaining text
      if (textContent.trim()) {
        elements.push(textContent);
      }

      return elements;
    }

    // Handle object content
    if (typeof content === 'object' && content.children) {
      return renderContentWithInlineLinks(content.children, maxLines);
    }

    return null;
  };

  // Handle navigation to full page
  const handleViewFullPage = () => {
    if (onClick) {
      onClick();
    } else if (pageId) {
      router.push(`/${pageId}`);
    }
  };

  // Loading state
  if (loading && showLoading) {
    return (
      <Card className={`h-full border-theme-medium ${className}`}>
        <CardContent className="p-6">
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
      <Card className={`h-full border-theme-medium border-destructive/20 ${className}`}>
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

  // Determine title and content to display - prioritize static content
  const displayTitle = title || page?.title || 'Untitled';
  const displayContent = content || page?.content;
  const renderedContent = renderContentWithInlineLinks(displayContent, maxLines);

  // No content available
  if (!displayContent && !content) {
    return (
      <Card className={`h-full border-theme-medium ${className}`}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <span className="text-sm">No content available</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`min-h-[500px] h-full border-theme-medium hover:shadow-lg transition-all duration-200 p-0 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <CardHeader className="p-4 pb-3 md:p-6 md:pb-4">
        <CardTitle className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-center line-clamp-2">
          {displayTitle}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 md:px-6 md:pb-6 flex flex-col flex-1 relative">
        {/* Preview content with 8 rendered lines limit and gradient fade */}
        <div className="flex-1 mb-4 md:mb-6 overflow-hidden relative min-h-[120px]">
          {renderedContent ? (
            <div
              className="text-sm md:text-base text-muted-foreground leading-relaxed text-left overflow-hidden"
              style={{
                lineHeight: '1.4rem',
                maxHeight: `${maxLines * 1.4}rem`
              }}
            >
              {typeof renderedContent === 'string' ? (
                <div
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: maxLines,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {renderedContent}
                </div>
              ) : (
                <div
                  className="space-y-1 overflow-hidden"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: maxLines,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {renderedContent}
                </div>
              )}
            </div>
          ) : (
            <p className="text-base text-muted-foreground italic text-center">
              No content preview available
            </p>
          )}

          {/* Gradient fade overlay at bottom of content */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        </div>

        {/* Ghost "Read more" button blending with gradient */}
        {!disabled && (
          <div className="mb-3 md:mb-4 relative z-10">
            <Button
              onClick={handleViewFullPage}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground hover:bg-transparent border-none shadow-none"
              size="sm"
            >
              Read more...
            </Button>
          </div>
        )}

        {/* Floating Embedded Allocation Bar */}
        {showAllocationBar && pageId && (
          <div className="relative z-20 bg-card/95 backdrop-blur-sm rounded-lg border border-border/50 p-2 md:p-3 shadow-lg mt-auto">
            <EmbeddedAllocationBar
              pageId={pageId}
              authorId={authorId}
              pageTitle={displayTitle}
              source={allocationSource}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UnifiedPagePreviewCard;
