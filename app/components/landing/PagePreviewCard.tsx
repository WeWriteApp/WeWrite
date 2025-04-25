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
}

export function PagePreviewCard({
  title,
  content,
  pageId,
  status = 'done',
  maxContentLength = 150
}: PagePreviewCardProps) {
  // Truncate content if needed
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '...'
    : content;

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

  return (
    <Link href={`/${pageId}`} className="block h-full">
      <Card className="h-full border border-border hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">
              <PillLink href={`/${pageId}`}>
                {title}
              </PillLink>
            </CardTitle>
            {getStatusBadge(status)}
          </div>
        </CardHeader>
        <CardContent className="flex-grow relative pb-16">
          <div className="prose prose-sm dark:prose-invert">
            <p>{truncatedContent}</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card via-card/90 to-transparent flex items-end justify-center pb-4">
            <Button variant="ghost" size="sm" className="gap-1 text-primary relative z-10">
              Read more <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
