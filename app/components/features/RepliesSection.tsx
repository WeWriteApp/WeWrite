"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '@/components/ui/Icon';
import { PageLinksCardHeader } from '../ui/PageLinksCard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { generateReplyTitle, createReplyContent, encodeReplyParams } from '../../utils/replyUtils';
import { getCurrentUsername } from '../../utils/userUtils';
import { getUserProfile } from '../../utils/apiClient';

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
  pageUserId?: string;
  pageUsername?: string;
  className?: string;
  isOwnPage?: boolean;
}

type FilterType = 'all' | 'agree' | 'disagree' | 'neutral';

export default function RepliesSection({ pageId, pageTitle, pageUserId, pageUsername, className, isOwnPage = false }: RepliesSectionProps) {
  const [replies, setReplies] = useState<ReplyInfo[]>([]);
  const [allReplies, setAllReplies] = useState<ReplyInfo[]>([]);
  const [counts, setCounts] = useState<RepliesCounts>({ agree: 0, disagree: 0, neutral: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isReplyPickerOpen, setIsReplyPickerOpen] = useState(false);
  const [resolvedPageOwnerUsername, setResolvedPageOwnerUsername] = useState(pageUsername || '');
  const router = useRouter();

  // Resolve page owner's display username to avoid showing userId/UUID
  // This matches the logic in ContentPageActions for consistency
  useEffect(() => {
    const resolveUsername = async () => {
      try {
        // If pageUsername looks like a real username (not a UUID), use it directly
        if (pageUsername && pageUsername !== pageUserId) {
          setResolvedPageOwnerUsername(pageUsername);
          return;
        }
        // Otherwise, fetch the user profile to get the actual username
        if (pageUserId) {
          const profile = await getUserProfile(pageUserId);
          if (profile?.username) {
            setResolvedPageOwnerUsername(profile.username);
            return;
          }
        }
        setResolvedPageOwnerUsername('');
      } catch (error) {
        console.error('Error resolving page owner username:', error);
        setResolvedPageOwnerUsername('');
      }
    };

    resolveUsername();
  }, [pageUserId, pageUsername]);

  const handleReply = async (replyType: 'agree' | 'disagree' | null) => {
    setIsReplyPickerOpen(false);

    try {
      // Get current user's username
      let username = '';
      try {
        username = await getCurrentUsername();
      } catch (error) {
        console.error('Error getting username:', error);
      }

      // Fallback: try to get username from wewrite_accounts (same as ContentPageActions)
      if (!username) {
        try {
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const currentAccount = accounts.find((acc: any) => acc.isCurrent);
            if (currentAccount?.username) {
              username = currentAccount.username;
            }
          }
        } catch (err) {
          console.error('Error getting username from wewrite_accounts:', err);
        }
      }

      if (!username) {
        username = 'Anonymous';
      }

      // Use the resolved username (same as ContentPageActions)
      const ownerUsername = resolvedPageOwnerUsername || pageUsername || 'Anonymous';

      // Generate reply title and content using the utility functions
      const replyTitle = generateReplyTitle(pageTitle || "Untitled");
      const initialContent = createReplyContent({
        pageId,
        pageTitle: pageTitle || "Untitled",
        userId: pageUserId || "",
        username: ownerUsername,
        replyType: replyType || "standard"
      });

      // Encode parameters
      const params = encodeReplyParams({
        title: replyTitle,
        content: initialContent,
        username
      });

      // Build the full reply URL with all necessary parameters
      const replyUrl = `/new?replyTo=${pageId}&page=${encodeURIComponent(pageTitle || "Untitled")}&pageUserId=${pageUserId || ''}&pageUsername=${encodeURIComponent(ownerUsername)}&title=${params.title}&initialContent=${params.content}&username=${params.username}&replyType=${replyType || 'standard'}`;
      router.push(replyUrl);
    } catch (error) {
      console.error('Error creating reply:', error);
      // Fallback to simple URL if something goes wrong
      const fallbackParams = new URLSearchParams({ replyTo: pageId });
      if (replyType) {
        fallbackParams.set('replyType', replyType);
      }
      router.push(`/new?${fallbackParams.toString()}`);
    }
  };

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
      icon: <Icon name="MessageCircle" size={14} />,
      count: counts.total
    },
    {
      type: 'disagree',
      label: 'Disagree',
      icon: <Icon name="ThumbsDown" size={14} />,
      count: counts.disagree
    },
    {
      type: 'agree',
      label: 'Agree',
      icon: <Icon name="ThumbsUp" size={14} />,
      count: counts.agree
    },
    {
      type: 'neutral',
      label: 'Neutral',
      icon: <Icon name="Minus" size={14} />,
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
        return <Icon name="ThumbsUp" size={12} className="text-green-600 dark:text-green-400" />;
      case 'disagree':
        return <Icon name="ThumbsDown" size={12} className="text-red-600 dark:text-red-400" />;
      default:
        return <Icon name="Minus" size={12} className="text-gray-500" />;
    }
  };

  return (
    <div className={cn("wewrite-card", className)}>
      <div className="p-4">
        <PageLinksCardHeader
          icon="MessageCircle"
          title="Replies"
          count={counts.total}
          loading={loading}
          className="mb-3"
        />

        {/* Filter Buttons - only show if there are replies */}
        {counts.total > 0 && (
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
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Icon name="Loader" className="text-muted-foreground" />
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
                  "block p-3 wewrite-card border-l-4 hover:bg-muted/50 transition-colors",
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
            {!isOwnPage && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => setIsReplyPickerOpen(true)}
              >
                <Icon name="Reply" size={16} />
                {activeFilter !== 'all' ? `Be the first to ${activeFilter}` : 'Reply'}
              </Button>
            )}
          </div>
        )}

        {/* Empty State - No Replies at All */}
        {!loading && !error && counts.total === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              {isOwnPage ? 'No replies yet.' : 'No replies yet. Be the first to reply!'}
            </p>
            {!isOwnPage && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => setIsReplyPickerOpen(true)}
              >
                <Icon name="Reply" size={16} />
                Reply
              </Button>
            )}
          </div>
        )}

        {/* Reply Type Picker Dialog */}
        <Dialog open={isReplyPickerOpen} onOpenChange={setIsReplyPickerOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Select reply type</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 pt-2">
              <Button
                variant="secondary"
                className="w-full justify-start gap-2"
                onClick={() => handleReply('agree')}
              >
                <Icon name="ThumbsUp" size={16} />
                Agree
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start gap-2"
                onClick={() => handleReply('disagree')}
              >
                <Icon name="ThumbsDown" size={16} />
                Disagree
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start gap-2"
                onClick={() => handleReply(null)}
              >
                <Icon name="Reply" size={16} />
                Just reply
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
