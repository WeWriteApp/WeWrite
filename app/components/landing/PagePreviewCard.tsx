"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight } from 'lucide-react';
import { PillLink } from '../PillLink';

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

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Available</Badge>;
      case 'in-progress':
        return <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-600">In Progress</Badge>;
      case 'coming-soon':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  const handleCardClick = () => {
    window.location.href = `/${pageId}`;
  };

  return (
    <div className="block h-full" onClick={handleCardClick}>
      <Card className="h-full border border-border hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">
              <PillLink href={`/${pageId}`}>
                {title}
              </PillLink>
            </CardTitle>
            {!hideStatus && getStatusBadge(status)}
          </div>
        </CardHeader>
        <CardContent className="flex-grow relative pb-16">
          <div className="prose prose-sm dark:prose-invert">
            <p className="whitespace-pre-line">{truncatedContent}</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card via-card/90 to-transparent flex items-end justify-center pb-4">
            <Button variant="ghost" size="sm" className="gap-1 text-primary relative z-10">
              Read more <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
