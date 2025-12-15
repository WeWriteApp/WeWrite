"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SubscriptionTierBadge } from './SubscriptionTierBadge';
import PillLink from '../utils/PillLink';
// Simple tooltips using title attribute
import { SubscriptionTiersModal } from '../modals/SubscriptionTiersModal';
import { cn } from '../../lib/utils';
import { sanitizeUsername, needsUsernameRefresh, getDisplayUsername } from '../../utils/usernameSecurity';

// Simple in-memory cache to prevent duplicate API calls
const usernameCache = new Map<string, { username: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  isLinkEditor?: boolean;
  onLinkEditorSelect?: () => void;
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
  pillVariant = 'primary',
  isLinkEditor = false,
  onLinkEditorSelect
}: UsernameBadgeProps) {
  // State for fresh username fetching
  const [freshUsername, setFreshUsername] = useState<string | null>(null);
  const [isLoadingUsername, setIsLoadingUsername] = useState(false);

  // State for subscription tiers modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get current pathname to detect if we're on a user page
  const pathname = usePathname();

  // Fetch fresh username on mount to ensure consistency
  useEffect(() => {
    const fetchFreshUsername = async () => {
      if (!userId) return;

      // Check in-memory cache first
      const cached = usernameCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setFreshUsername(cached.username);
        return;
      }

      // SECURITY: Use centralized logic to determine if username needs refresh
      const needsFreshFetch = needsUsernameRefresh(username);

      if (!needsFreshFetch) {
        // Still fetch in background to verify, but don't show loading
        try {
          const response = await fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.username && result.data.username !== username) {
              // Username has changed, update it
              const newUsername = result.data.username;
              setFreshUsername(newUsername);
              // Update cache
              usernameCache.set(userId, { username: newUsername, timestamp: Date.now() });

              // ENHANCEMENT: Trigger page refresh if this is a significant username change
              if (username === 'Missing username' || username === 'Anonymous') {
                console.log('🔄 Username recovered for user:', userId, 'from', username, 'to', newUsername);
                // Dispatch event to refresh other components
                window.dispatchEvent(new CustomEvent('userDataUpdated', {
                  detail: { userId, oldUsername: username, newUsername }
                }));
              }
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
            const newUsername = result.data.username;
            setFreshUsername(newUsername);
            // Update cache
            usernameCache.set(userId, { username: newUsername, timestamp: Date.now() });

            console.log('✅ Fresh username fetched for user:', userId, newUsername);
          } else {
            console.warn('No username found in API response for user:', userId);
            // FALLBACK: Try to generate a reasonable username
            setFreshUsername(`user_${userId.substring(0, 8)}`);
          }
        } else {
          console.error('Failed to fetch username, status:', response.status);
          // FALLBACK: Use a generated username
          setFreshUsername(`user_${userId.substring(0, 8)}`);
        }
      } catch (error) {
        console.error('Failed to fetch fresh username:', error);
        // FALLBACK: Use a generated username
        setFreshUsername(`user_${userId.substring(0, 8)}`);
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

  // SECURITY: Use centralized username sanitization
  const displayUsername = getDisplayUsername(
    freshUsername || username,
    isLoadingUsername
  );

  // Determine if user is inactive (no active subscription)
  const isInactive = !subscriptionStatus || subscriptionStatus !== 'active';

  // Check if we're on a user page
  const isOnUserPage = pathname?.startsWith('/u/');

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

  // Handle click - show modal on user pages, navigate elsewhere
  const handleClick = (e: React.MouseEvent) => {
    // Handle link editor mode first
    if (isLinkEditor && onLinkEditorSelect) {
      e.preventDefault();
      e.stopPropagation();
      onLinkEditorSelect();
      return;
    }

    if (onClick) {
      onClick(e);
      return;
    }

    if (isOnUserPage) {
      e.preventDefault();
      setIsModalOpen(true);
    }
    // For non-user pages, let the Link component handle navigation
  };

  const wrappedContent = (
    <span
      className="inline-flex items-center gap-1"
      title={getTooltipText()}
    >
      <span className={cn(
        // Only apply text color when not in pill variant - let PillLink handle text color for pills
        variant !== 'pill' && (
          isInactive
            ? "text-muted-foreground"
            : "text-primary"
        )
      )}>
        {isLoadingUsername ? 'Loading...' : displayUsername}
      </span>
      {showBadge && (
        <SubscriptionTierBadge
          tier={tier}
          status={subscriptionStatus}
          amount={subscriptionAmount}
          size={size}
          pillVariant={variant === 'pill' ? pillVariant : undefined}
        />
      )}
    </span>
  );

  if (variant === 'pill') {
    return (
      <>
        <PillLink
          href={`/u/${userId}`}
          variant={pillVariant}
          onClick={handleClick}
          className={className}
          isLinkEditor={isLinkEditor}
          onLinkEditorSelect={onLinkEditorSelect}
        >
          {wrappedContent}
        </PillLink>
        <SubscriptionTiersModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <Link
        href={`/u/${userId}`}
        onClick={handleClick}
        className={cn(
          "username-badge-link inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors w-fit no-underline",
          isInactive
            ? "hover:bg-primary/5 text-muted-foreground"
            : "hover:bg-primary/10 text-primary",
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
      <SubscriptionTiersModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
