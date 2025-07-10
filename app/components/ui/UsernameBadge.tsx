"use client";

import React from 'react';
import Link from 'next/link';
import { SubscriptionTierBadge } from './SubscriptionTierBadge';
import { PillLink } from '../utils/PillLink';
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
  // Determine if user is inactive (no active subscription)
  const isInactive = !subscriptionStatus || subscriptionStatus !== 'active';

  const content = (
    <>
      <span className={cn(
        isInactive
          ? "text-muted-foreground"
          : "text-accent-foreground"
      )}>
        {username}
      </span>
      {showBadge && (
        <SubscriptionTierBadge
          tier={tier}
          status={subscriptionStatus}
          amount={subscriptionAmount}
          size={size}
        />
      )}
    </>
  );

  if (variant === 'pill') {
    return (
      <PillLink
        href={`/user/${userId}`}
        variant={pillVariant}
        onClick={onClick}
        className={className}
      >
        <span className="flex items-center gap-1">
          {content}
        </span>
      </PillLink>
    );
  }

  return (
    <Link
      href={`/user/${userId}`}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-2 py-1 rounded-md transition-colors w-fit",
        isInactive
          ? "hover:bg-muted/50"
          : "hover:bg-accent/50",
        className
      )}
    >
      <span className={cn(
        isInactive
          ? "text-muted-foreground"
          : "text-accent-foreground"
      )}>
        {username}
      </span>
      {showBadge && (
        <SubscriptionTierBadge
          tier={tier}
          status={subscriptionStatus}
          amount={subscriptionAmount}
          size={size}
        />
      )}
    </Link>
  );
}
