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

// Cache structure for full profile data (username + tier)
interface CachedProfile {
  username: string;
  tier?: string | null;
  timestamp: number;
}

// Simple in-memory cache to prevent duplicate API calls
const profileCache = new Map<string, CachedProfile>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface UsernameBadgeProps {
  userId: string;
  username: string;
  tier?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showBadge?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'link' | 'pill';
  pillVariant?: 'primary' | 'outline';
  isLinkEditor?: boolean;
  onLinkEditorSelect?: () => void;
}

export function UsernameBadge({
  userId,
  username,
  tier,
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

  // State for fetched tier data (fallback when props not provided)
  const [fetchedTier, setFetchedTier] = useState<string | null | undefined>(undefined);

  // State for subscription tiers modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get current pathname to detect if we're on a user page
  const pathname = usePathname();

  // Fetch fresh profile data (username + subscription) on mount
  // Uses full-profile endpoint when subscription data is needed
  useEffect(() => {
    const fetchFreshProfile = async () => {
      if (!userId) return;

      // Determine if we need tier data (when props not provided)
      const needsTier = tier === undefined;

      // Check in-memory cache first
      const cached = profileCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setFreshUsername(cached.username);
        // Use cached tier data if we need it and props aren't provided
        if (needsTier) {
          setFetchedTier(cached.tier);
        }
        return;
      }

      // SECURITY: Use centralized logic to determine if username needs refresh
      const needsFreshFetch = needsUsernameRefresh(username);

      // Use full-profile endpoint if we need tier data, otherwise use regular profile
      const endpoint = needsTier
        ? `/api/users/full-profile?id=${encodeURIComponent(userId)}`
        : `/api/users/profile?id=${encodeURIComponent(userId)}`;

      if (!needsFreshFetch && !needsTier) {
        // Still fetch in background to verify, but don't show loading
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.username && result.data.username !== username) {
              // Username has changed, update it
              const newUsername = result.data.username;
              setFreshUsername(newUsername);
              // Update cache
              profileCache.set(userId, {
                username: newUsername,
                tier: result.data.tier,
                timestamp: Date.now()
              });

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
          console.warn('Background profile fetch failed:', error);
        }
        return;
      }

      // Show loading and fetch fresh profile
      setIsLoadingUsername(true);
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.username) {
            const newUsername = result.data.username;
            setFreshUsername(newUsername);

            // Update tier state if needed and data is available
            if (needsTier) {
              setFetchedTier(result.data.tier ?? null);
            }

            // Update cache with all data
            profileCache.set(userId, {
              username: newUsername,
              tier: result.data.tier,
              timestamp: Date.now()
            });

            console.log('✅ Fresh profile fetched for user:', userId, newUsername);
          } else {
            console.warn('No username found in API response for user:', userId);
            // FALLBACK: Try to generate a reasonable username
            setFreshUsername(`user_${userId.substring(0, 8)}`);
          }
        } else {
          console.error('Failed to fetch profile, status:', response.status);
          // FALLBACK: Use a generated username
          setFreshUsername(`user_${userId.substring(0, 8)}`);
        }
      } catch (error) {
        console.error('Failed to fetch fresh profile:', error);
        // FALLBACK: Use a generated username
        setFreshUsername(`user_${userId.substring(0, 8)}`);
      } finally {
        setIsLoadingUsername(false);
      }
    };

    fetchFreshProfile();
  }, [userId, username, tier]);

  // Listen for global username update events
  useEffect(() => {
    const handleUsernameUpdate = (event: CustomEvent) => {
      const { userId: updatedUserId } = event.detail || {};

      // If this is for our user, refresh the profile
      if (updatedUserId === userId) {
        console.log('🔄 Profile update detected for user:', userId);
        setFreshUsername(null); // Clear cached username
        setIsLoadingUsername(true);

        // Fetch fresh profile (with subscription data)
        fetch(`/api/users/full-profile?id=${encodeURIComponent(userId)}`)
          .then(response => response.json())
          .then(result => {
            if (result.success && result.data?.username) {
              setFreshUsername(result.data.username);
              // Also update tier data
              if (tier === undefined) {
                setFetchedTier(result.data.tier ?? null);
              }
              // Update cache
              profileCache.set(userId, {
                username: result.data.username,
                tier: result.data.tier,
                timestamp: Date.now()
              });
            }
          })
          .catch(error => {
            console.error('Failed to refresh profile after update:', error);
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
  }, [userId, tier]);

  // SECURITY: Use centralized username sanitization
  const displayUsername = getDisplayUsername(
    freshUsername || username,
    isLoadingUsername
  );

  // Use props if provided, otherwise use fetched values as fallback
  const effectiveTier = tier !== undefined ? tier : fetchedTier;

  // Determine if user is inactive (no active subscription)
  // 'inactive' tier means no active subscription
  const isInactive = !effectiveTier || effectiveTier === 'inactive';

  // Check if we're on a user page
  const isOnUserPage = pathname?.startsWith('/u/');

  // Generate tooltip text for subscription status
  const getTooltipText = () => {
    if (!effectiveTier || effectiveTier === 'inactive') {
      return 'No active subscription - $0/mo';
    }
    if (effectiveTier === 'tier3') {
      return 'Champion - $30+/mo';
    }
    if (effectiveTier === 'tier2') {
      return 'Advocate - $20/mo';
    }
    if (effectiveTier === 'tier1') {
      return 'Supporter - $10/mo';
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
          tier={effectiveTier}
          size={size}
          pillVariant={variant === 'pill' ? pillVariant : undefined}
        />
      )}
    </span>
  );

  if (variant === 'pill') {
    // Inactive users get a grey pill style similar to deleted pages
    if (isInactive) {
      return (
        <>
          <Link
            href={`/u/${userId}`}
            onClick={handleClick}
            className={cn(
              "inline-flex items-center my-0.5 text-sm font-medium rounded-lg transition-all duration-150 ease-out",
              "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400",
              "hover:bg-neutral-300 dark:hover:bg-neutral-600",
              "px-2 py-0.5 no-underline hover:no-underline",
              className
            )}
            title={getTooltipText()}
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
          "username-badge-link inline-flex items-center gap-1 rounded-md transition-colors w-fit no-underline",
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
