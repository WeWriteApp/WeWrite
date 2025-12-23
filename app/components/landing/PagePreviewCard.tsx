"use client";

import React, { useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

interface PagePreviewCardProps {
  title: string;
  content: string;
  pageId: string;
  status?: 'done' | 'in-progress' | 'coming-soon';
  maxContentLength?: number;
  hideStatus?: boolean;
}

export function PagePreviewCard({
  title,
  content,
  pageId,
  status = 'done',
  maxContentLength = 150,
  hideStatus = false
}: PagePreviewCardProps) {
  // Process content to handle any potential link text issues
  // Replace any potential link patterns with plain text
  const processedContent = content.replace(/\[\[(.*?)\]\]/g, '$1')  // Replace [[link]] format
                                 .replace(/\[(.*?)\]\((.*?)\)/g, '$1'); // Replace markdown [text](url) format

  // Truncate content if needed
  const truncatedContent = processedContent.length > maxContentLength
    ? processedContent.substring(0, maxContentLength) + '...'
    : processedContent;

  // Get card background color based on status
  const getCardStyleByStatus = (status: string) => {
    switch (status) {
      case 'done':
        return "bg-success-20 border-theme-medium text-success";
      case 'in-progress':
        return "bg-amber-50 dark:bg-amber-950/50 border-theme-medium text-amber-900 dark:text-amber-100";
      case 'coming-soon':
        return "bg-muted border-theme-medium text-muted-foreground";
      default:
        return "";
    }
  };

  // Get the status-specific styles
  const cardStyles = getCardStyleByStatus(status);
  const router = useRouter();

  // Handle card click with proper Next.js navigation
  const handleCardClick = useCallback((e) => {
    e.preventDefault();

    // Use Next.js router for client-side navigation to prevent scroll-to-top issues
    router.push(`/${pageId}`);

    // Prevent any default behavior or event bubbling
    return false;
  }, [pageId, router]);

  // Get status badge
  const getStatusBadge = () => {
    if (hideStatus) return null;

    switch (status) {
      case 'done':
        return <Badge variant="default" className="bg-success-20 text-success">Available Now</Badge>;
      case 'in-progress':
        return <Badge variant="default" className="bg-amber-500 text-white">In Progress</Badge>;
      case 'coming-soon':
        return <Badge variant="secondary" className="text-muted-foreground border-border">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="block h-full" onClick={handleCardClick}>
      <Card className={`h-full border hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col ${cardStyles} scroll-snap-align-start`}>
        <div className="p-2 sm:p-3">
          <div className="flex justify-between items-center mb-1">
            <CardTitle className="text-sm sm:text-base mb-0 pr-2 line-clamp-2">
              {title}
            </CardTitle>
            <Icon name="ChevronRight" size={16} className="flex-shrink-0" />
          </div>
          {!hideStatus && (
            <div className="mt-1">
              {getStatusBadge()}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}