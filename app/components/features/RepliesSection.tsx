"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import PillLink from '../utils/PillLink';
import { Loader2, MessageCircle, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import Link from 'next/link';

interface ReplyInfo {
  id: string;
  title: string;
  username: string;
  replyType: 'agree' | 'disagree' | 'neutral' | 'standard' | null;
  createdAt: any;
  userId: string;
}

interface RepliesCounts {
  agree: number;
  disagree: number;
  neutral: number;
  total: number;
}

interface RepliesSectionProps {
  pageId: string;
  pageTitle?: string;
  className?: string;
}

type FilterType = 'all' | 'agree' | 'disagree' | 'neutral';

export default function RepliesSection({ pageId, pageTitle, className }: RepliesSectionProps) {
  const [replies, setReplies] = useState<ReplyInfo[]>([]);
  const [allReplies, setAllReplies] = useState<ReplyInfo[]>([]);
  const [counts, setCounts] = useState<RepliesCounts>({ agree: 0, disagree: 0, neutral: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const fetchReplies = useCallback(async () => {
    if (!pageId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/replies?pageId=${pageId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch replies');
      }

      const data = await response.json();
      
      setAllReplies(data.replies || []);
      setReplies(data.replies || []);
      setCounts(data.counts || { agree: 0, disagree: 0, neutral: 0, total: 0 });
    } catch (err) {
      console.error('Error fetching replies:', err);
      setError('Failed to load replies');
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  // Apply filter when activeFilter changes
  useEffect(() => {
    if (activeFilter === 'all') {
      setReplies(allReplies);
    } else {
      setReplies(allReplies.filter(reply => reply.replyType === activeFilter));
    }
  }, [activeFilter, allReplies]);

  // Don't render if no replies
  if (!loading && counts.total === 0) {
    return null;
  }

  const filterButtons: { type: FilterType; label: string; icon: React.ReactNode; count: number; color: string }[] = [
    { 
      type: 'all', 
      label: 'All', 
      icon: <MessageCircle className="w-3.5 h-3.5" />, 
      count: counts.total,
      color: 'bg-muted hover:bg-muted/80'
    },
    { 
      type: 'disagree', 
      label: 'Disagree', 
      icon: <ThumbsDown className="w-3.5 h-3.5" />, 
      count: counts.disagree,
      color: 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300'
    },
    { 
      type: 'agree', 
      label: 'Agree', 
      icon: <ThumbsUp className="w-3.5 h-3.5" />, 
      count: counts.agree,
      color: 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300'
    },
    { 
      type: 'neutral', 
      label: 'Neutral', 
      icon: <Minus className="w-3.5 h-3.5" />, 
      count: counts.neutral,
      color: 'bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
    },
  ];

  const getReplyTypeStyles = (replyType: string | null) => {
    switch (replyType) {
      case 'agree':
        return 'border-l-green-500';
      case 'disagree':
        return 'border-l-red-500';
      default:
        return 'border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const getReplyTypeIcon = (replyType: string | null) => {
    switch (replyType) {
      case 'agree':
        return <ThumbsUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
      case 'disagree':
        return <ThumbsDown className="w-3 h-3 text-red-600 dark:text-red-400" />;
      default:
        return <Minus className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-card", className)}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Replies</h3>
          <span className="text-xs text-muted-foreground">({counts.total})</span>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {filterButtons.map((filter) => (
            <button
              key={filter.type}
              onClick={() => setActiveFilter(filter.type)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                activeFilter === filter.type
                  ? cn(filter.color, "ring-2 ring-offset-2 ring-offset-background ring-primary/50")
                  : "bg-muted/50 hover:bg-muted text-muted-foreground"
              )}
            >
              {filter.icon}
              {filter.label}
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                activeFilter === filter.type ? "bg-black/10 dark:bg-white/10" : "bg-muted-foreground/20"
              )}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-sm text-red-500 py-4 text-center">{error}</div>
        )}

        {/* Replies List */}
        {!loading && !error && replies.length > 0 && (
          <div className="space-y-2">
            {replies.map((reply) => (
              <Link
                key={reply.id}
                href={`/${reply.id}`}
                className={cn(
                  "block p-3 rounded-lg border-l-4 bg-muted/30 hover:bg-muted/50 transition-colors",
                  getReplyTypeStyles(reply.replyType)
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {getReplyTypeIcon(reply.replyType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{reply.title}</p>
                    <p className="text-xs text-muted-foreground">@{reply.username}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State for Filter */}
        {!loading && !error && replies.length === 0 && counts.total > 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No {activeFilter !== 'all' ? activeFilter : ''} replies found
          </div>
        )}
      </div>
    </div>
  );
}
