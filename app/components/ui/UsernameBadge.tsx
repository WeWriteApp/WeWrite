"use client";

import React from 'react';
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

  const wrappedContent = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1">
            {content}
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
        "inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors w-fit",
        isInactive
          ? "hover:bg-muted/50"
          : "hover:bg-accent/50",
        className
      )}
    >
      {wrappedContent}
    </Link>
  );
}
