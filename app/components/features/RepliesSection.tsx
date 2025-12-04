"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import PillLink from '../utils/PillLink';
import { Loader2, MessageCircle, ThumbsUp, ThumbsDown, Minus, Reply } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';

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

  const filterButtons: { type: FilterType; label: string; icon: React.ReactNode; count: number }[] = [
    { 
      type: 'all', 
      label: 'All', 
      icon: <MessageCircle className="w-3.5 h-3.5" />, 
      count: counts.total
    },
    { 
      type: 'disagree', 
      label: 'Disagree', 
      icon: <ThumbsDown className="w-3.5 h-3.5" />, 
      count: counts.disagree
    },
    { 
      type: 'agree', 
      label: 'Agree', 
      icon: <ThumbsUp className="w-3.5 h-3.5" />, 
      count: counts.agree
    },
    { 
      type: 'neutral', 
      label: 'Neutral', 
      icon: <Minus className="w-3.5 h-3.5" />, 
      count: counts.neutral
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
          {filterButtons.map((filter) => {
            // Get color classes based on filter type and active state
            const getFilterColors = () => {
              if (activeFilter !== filter.type) {
                return "bg-muted/50 hover:bg-muted/80 text-muted-foreground";
              }
              // Active states with semantic colors
              switch (filter.type) {
                case 'disagree':
                  return "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20";
                case 'agree':
                  return "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20";
                default: // 'all' and 'neutral' use accent color
                  return "bg-accent text-accent-foreground";
              }
            };

            const getCountBgColor = () => {
              if (activeFilter !== filter.type) {
                return "bg-muted-foreground/20";
              }
              switch (filter.type) {
                case 'disagree':
                  return "bg-red-500/20";
                case 'agree':
                  return "bg-green-500/20";
                default:
                  return "bg-black/10 dark:bg-white/10";
              }
            };

            return (
              <button
                key={filter.type}
                onClick={() => setActiveFilter(filter.type)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  getFilterColors()
                )}
              >
                {filter.icon}
                {filter.label}
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                  getCountBgColor()
                )}>
                  {filter.count}
                </span>
              </button>
            );
          })}
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
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No {activeFilter !== 'all' ? activeFilter : ''} replies found
            </p>
            {activeFilter !== 'all' && (
              <Link href={`/new?replyTo=${pageId}&replyType=${activeFilter}`}>
                <Button variant="secondary" size="sm" className="gap-2">
                  <Reply className="w-4 h-4" />
                  Be the first to {activeFilter}
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Empty State - No Replies at All */}
        {!loading && !error && counts.total === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">No replies yet. Be the first to reply!</p>
            <Link href={`/new?replyTo=${pageId}${activeFilter !== 'all' ? `&replyType=${activeFilter}` : ''}`}>
              <Button variant="secondary" size="sm" className="gap-2">
                <Reply className="w-4 h-4" />
                Reply{activeFilter !== 'all' && activeFilter !== 'neutral' ? ` (${activeFilter})` : ''}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
