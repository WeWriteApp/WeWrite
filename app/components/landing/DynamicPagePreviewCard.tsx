"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { useProductionDataFetchJson } from '../../hooks/useProductionDataFetch';
import type { Page } from '../../types/database';
import { PillLink } from '../utils/PillLink';

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
  showLoading = true
}: DynamicPagePreviewCardProps) {
  const router = useRouter();
  const fetchJson = useProductionDataFetchJson();
  
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch page data
  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use production data fetch (automatically uses production data for logged-out users)
        const response = await fetchJson(`/api/pages/${pageId}`);
        setPage(response.pageData);
      } catch (err) {
        console.error(`Failed to fetch page ${pageId}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    if (pageId) {
      fetchPage();
    }
  }, [pageId, fetchJson]);

  // Render content with inline links as JSX elements
  const renderContentWithInlineLinks = (content: any, maxLines: number): React.ReactNode => {
    if (!content) return null;

    // Handle string content
    if (typeof content === 'string') {
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      const previewLines = lines.slice(0, maxLines);
      return previewLines.join('\n');
    }

    // Handle editor content (array of nodes)
    if (Array.isArray(content)) {
      let lineCount = 0;
      const elements: React.ReactNode[] = [];

      for (const node of content) {
        if (lineCount >= maxLines) break;

        if (node.children) {
          const nodeElements: React.ReactNode[] = [];

          for (const child of node.children) {
            // Handle link elements
            if (child.type === 'link' && child.url) {
              const linkText = child.children?.map((c: any) => c.text || '').join('') || child.url;

              nodeElements.push(
                <PillLink
                  key={`link-${nodeElements.length}`}
                  href={child.url}
                  isPublic={true}
                  className="mx-0.5 text-xs scale-90"
                  clickable={false}
                >
                  {linkText}
                </PillLink>
              );
            }
            // Handle regular text
            else if (child.text) {
              nodeElements.push(child.text);
            }
            // Handle nested children
            else if (child.children) {
              for (const nestedChild of child.children) {
                if (nestedChild.type === 'link' && nestedChild.url) {
                  const linkText = nestedChild.children?.map((c: any) => c.text || '').join('') || nestedChild.url;

                  nodeElements.push(
                    <PillLink
                      key={`nested-link-${nodeElements.length}`}
                      href={nestedChild.url}
                      isPublic={true}
                      className="mx-0.5 text-xs scale-90"
                      clickable={false}
                    >
                      {linkText}
                    </PillLink>
                  );
                } else if (nestedChild.text) {
                  nodeElements.push(nestedChild.text);
                }
              }
            }
          }

          if (nodeElements.length > 0) {
            elements.push(
              <span key={`node-${lineCount}`} className="block">
                {nodeElements}
              </span>
            );
            lineCount++;
          }
        }
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
    router.push(`/${pageId}`);
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

  // No page data
  if (!page) {
    return (
      <Card className={`h-full border-theme-medium ${className}`}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <span className="text-sm">Page not found</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const title = customTitle || page.title || 'Untitled';
  const renderedContent = renderContentWithInlineLinks(page.content, maxLines);

  return (
    <Card className={`h-full border-theme-medium hover:shadow-lg transition-all duration-200 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold line-clamp-2">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex flex-col h-full">
        {/* Preview content with inline links */}
        <div className="flex-1 mb-4">
          {renderedContent ? (
            <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
              {renderedContent}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No content preview available
            </p>
          )}
        </div>

        {/* View full page button */}
        <div className="mt-auto">
          <Button
            onClick={handleViewFullPage}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {buttonText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default DynamicPagePreviewCard;
