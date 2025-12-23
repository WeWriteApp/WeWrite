"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PillLink } from '../utils/PillLink';
import { getBacklinks, BacklinkSummary } from '../../firebase/database/backlinks';

interface WhatLinksHereProps {
  pageId: string;
  pageTitle: string;
  className?: string;
}

export default function WhatLinksHere({ pageId, pageTitle, className = "" }: WhatLinksHereProps) {
  const [backlinks, setBacklinks] = useState<BacklinkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchBacklinks = async () => {
      try {
        setLoading(true);
        setError(null);
        const links = await getBacklinks(pageId, 20); // Limit to 20 for performance
        setBacklinks(links);
      } catch (err) {
        console.error('Error fetching backlinks:', err);
        setError('Failed to load backlinks');
      } finally {
        setLoading(false);
      }
    };

    fetchBacklinks();
  }, [pageId]);

  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="ArrowLeft" size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-medium">What links here</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-6 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="ArrowLeft" size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-medium">What links here</h3>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="ArrowLeft" size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-medium">What links here</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No pages link to this page yet.
        </p>
      </div>
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name="ArrowLeft" size={16} className="text-muted-foreground" />
          <span className="font-medium">What links here ({backlinks.length})</span>
        </div>
        {isExpanded ? (
          <Icon name="ChevronUp" size={16} />
        ) : (
          <Icon name="ChevronDown" size={16} />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {backlinks.map((backlink) => (
            <div key={backlink.id} className="flex items-center justify-between py-1">
              <PillLink
                href={`/${backlink.id}`}
                pageId={backlink.id}
                className="text-sm"
              >
                {backlink.title}
              </PillLink>
              {backlink.username && (
                <span className="text-xs text-muted-foreground ml-2">
                  @{backlink.username}
                </span>
              )}
            </div>
          ))}
          {backlinks.length >= 20 && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing first 20 backlinks. More may exist.
            </p>
          )}
        </div>
      )}
    </div>
  );
}