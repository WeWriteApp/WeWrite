"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SubscriptionTierBadge } from './SubscriptionTierBadge';
import { PillLink } from '../utils/PillLink';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { cn } from '../../lib/utils';

interface UsernameBadgeProps {
  userId: string;
  username: string;
  tier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionAmount?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showBadge?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'link' | 'pill';
  pillVariant?: 'primary' | 'secondary' | 'outline';
}

export function UsernameBadge({
  userId,
  username,
  tier,
  subscriptionStatus,
  subscriptionAmount,
  size = 'sm',
  className = '',
  showBadge = true,
  onClick,
  variant = 'link',
  pillVariant = 'primary'
}: UsernameBadgeProps) {
  // State for fresh username fetching
  const [freshUsername, setFreshUsername] = useState<string | null>(null);
  const [isLoadingUsername, setIsLoadingUsername] = useState(false);

  // Fetch fresh username on mount to ensure consistency
  useEffect(() => {
    const fetchFreshUsername = async () => {
      if (!userId) return;

      // Only fetch if we don't have a username or it looks stale
      const needsFreshFetch = !username ||
        username === 'Missing username' ||
        username === 'Anonymous' ||
        username.trim() === '';

      if (!needsFreshFetch) {
        // Still fetch in background to verify, but don't show loading
        try {
          const response = await fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.username && result.data.username !== username) {
              // Username has changed, update it
              setFreshUsername(result.data.username);
            }
          }
        } catch (error) {
          console.warn('Background username fetch failed:', error);
        }
        return;
      }

      // Show loading and fetch fresh username
      setIsLoadingUsername(true);
      try {
        const response = await fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.username) {
            setFreshUsername(result.data.username);
          }
        }
      } catch (error) {
        console.error('Failed to fetch fresh username:', error);
      } finally {
        setIsLoadingUsername(false);
      }
    };

    fetchFreshUsername();
  }, [userId, username]);

  // Listen for global username update events
  useEffect(() => {
    const handleUsernameUpdate = (event: CustomEvent) => {
      const { userId: updatedUserId } = event.detail || {};

      // If this is for our user, refresh the username
      if (updatedUserId === userId) {
        console.log('🔄 Username update detected for user:', userId);
        setFreshUsername(null); // Clear cached username
        setIsLoadingUsername(true);

        // Fetch fresh username
        fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`)
          .then(response => response.json())
          .then(result => {
            if (result.success && result.data?.username) {
              setFreshUsername(result.data.username);
            }
          })
          .catch(error => {
            console.error('Failed to refresh username after update:', error);
          })
          .finally(() => {
            setIsLoadingUsername(false);
          });
      }
    };

    // Listen for username update events
    window.addEventListener('userDataUpdated', handleUsernameUpdate as EventListener);
    window.addEventListener('invalidate-user-pages', handleUsernameUpdate as EventListener);

    return () => {
      window.removeEventListener('userDataUpdated', handleUsernameUpdate as EventListener);
      window.removeEventListener('invalidate-user-pages', handleUsernameUpdate as EventListener);
    };
  }, [userId]);

  // Use fresh username if available, otherwise fall back to provided username
  const displayUsername = freshUsername || username || 'Missing username';

  // Determine if user is inactive (no active subscription)
  const isInactive = !subscriptionStatus || subscriptionStatus !== 'active';

  // Generate tooltip text for subscription status
  const getTooltipText = () => {
    if (!subscriptionStatus || subscriptionStatus !== 'active') {
      return 'No active subscription - $0/mo';
    }

    if (subscriptionAmount && subscriptionAmount > 30) {
      return 'Active subscription - above $30/mo';
    }

    if (subscriptionAmount) {
      return `Active subscription - $${subscriptionAmount}/mo`;
    }

    return 'Active subscription';
  };

  const wrappedContent = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1">
            <span className={cn(
              isInactive
                ? "text-muted-foreground"
                : "text-primary"
            )}>
              {isLoadingUsername ? 'Loading...' : displayUsername}
            </span>
            {showBadge && (
              <SubscriptionTierBadge
                tier={tier}
                status={subscriptionStatus}
                amount={subscriptionAmount}
                size={size}
              />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (variant === 'pill') {
    return (
      <PillLink
        href={`/user/${userId}`}
        variant={pillVariant}
        onClick={onClick}
        className={className}
      >
        {wrappedContent}
      </PillLink>
    );
  }

  return (
    <Link
      href={`/user/${userId}`}
      onClick={onClick}
      className={cn(
        "username-badge-link inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors w-fit no-underline",
        isInactive
          ? "hover:bg-muted/50 text-muted-foreground"
          : "hover:bg-accent/50 text-primary",
        "hover:no-underline focus:no-underline",
        className
      )}
      style={{
        color: isInactive ? undefined : 'hsl(var(--primary))',
        textDecoration: 'none'
      }}
    >
      {wrappedContent}
    </Link>
  );
}
