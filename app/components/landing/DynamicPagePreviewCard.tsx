"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { useProductionDataFetchJson } from '../../hooks/useProductionDataFetch';
import type { Page } from '../../types/database';

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

  // Extract plain text content and links from page content
  const extractContentData = (content: any): { text: string; links: string[] } => {
    if (!content) return { text: '', links: [] };

    const links: string[] = [];

    // Handle string content
    if (typeof content === 'string') {
      return { text: content, links: [] };
    }

    // Handle editor content (array of nodes)
    if (Array.isArray(content)) {
      const text = content
        .map(node => {
          if (node.children) {
            return node.children
              .map((child: any) => {
                // Extract links
                if (child.type === 'link' && child.url) {
                  links.push(child.url);
                  return child.children?.map((c: any) => c.text || '').join('') || child.url;
                }
                if (child.text) return child.text;
                if (child.children) {
                  return child.children.map((c: any) => {
                    // Extract nested links
                    if (c.type === 'link' && c.url) {
                      links.push(c.url);
                      return c.children?.map((cc: any) => cc.text || '').join('') || c.url;
                    }
                    return c.text || '';
                  }).join('');
                }
                return '';
              })
              .join('');
          }
          return '';
        })
        .join('\n');

      return { text, links: [...new Set(links)] }; // Remove duplicates
    }

    // Handle object content
    if (typeof content === 'object' && content.children) {
      return extractContentData(content.children);
    }

    return { text: '', links: [] };
  };

  // Get first N lines of content and extract links
  const getPreviewData = (content: any, maxLines: number): { text: string; links: string[] } => {
    const { text, links } = extractContentData(content);
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const previewLines = lines.slice(0, maxLines);
    return { text: previewLines.join('\n'), links };
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
  const { text: previewContent, links } = getPreviewData(page.content, maxLines);

  return (
    <Card className={`h-full border-theme-medium hover:shadow-lg transition-all duration-200 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold line-clamp-2">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex flex-col h-full">
        {/* Preview content */}
        <div className="flex-1 mb-4">
          {previewContent ? (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {previewContent}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No content preview available
            </p>
          )}
        </div>

        {/* Links pills */}
        {links.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {links.slice(0, 3).map((link, index) => {
                // Extract domain from URL for display
                const displayText = (() => {
                  try {
                    const url = new URL(link);
                    return url.hostname.replace('www.', '');
                  } catch {
                    return link.length > 20 ? link.substring(0, 20) + '...' : link;
                  }
                })();

                return (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {displayText}
                  </span>
                );
              })}
              {links.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                  +{links.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

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
