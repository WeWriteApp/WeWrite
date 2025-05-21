"use client";

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ChevronRight } from 'lucide-react';

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
        return "bg-green-100 dark:bg-green-800/40 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100";
      case 'in-progress':
        return "bg-amber-100 dark:bg-amber-800/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100";
      case 'coming-soon':
        return "bg-gray-100 dark:bg-gray-800/40 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100";
      default:
        return "";
    }
  };

  // Get the status-specific styles
  const cardStyles = getCardStyleByStatus(status);
  const router = useRouter();

  // Handle card click with direct navigation
  const handleCardClick = useCallback((e) => {
    e.preventDefault();

    // Use window.location.href with a hash fragment to ensure the destination page loads at the top
    // The hash fragment #top will be ignored but ensures the page loads at the top
    window.location.href = `/${pageId}#top`;

    // Prevent any default behavior or event bubbling
    return false;
  }, [pageId]);

  // Get status badge
  const getStatusBadge = () => {
    if (hideStatus) return null;

    switch (status) {
      case 'done':
        return <Badge variant="default" className="bg-green-500 text-white">Available Now</Badge>;
      case 'in-progress':
        return <Badge variant="default" className="bg-amber-500 text-white">In Progress</Badge>;
      case 'coming-soon':
        return <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="block h-full" onClick={handleCardClick}>
      <Card className={`h-full border hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col ${cardStyles} scroll-snap-align-start`}>
        <div className="p-3 sm:p-4">
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-base sm:text-lg mb-0 pr-2 line-clamp-2">
              {title}
            </CardTitle>
            <ChevronRight className="h-5 w-5 flex-shrink-0" />
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
