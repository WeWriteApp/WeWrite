'use client';

import React from 'react';
import { Coins } from 'lucide-react';

interface RemainingTokensCounterProps {
  allocatedTokens: number;
  totalTokens: number;
  className?: string;
  onClick?: () => void;
}

/**
 * RemainingTokensCounter - Shows remaining tokens with orange color when zero
 * 
 * This component displays the number of tokens remaining for the user to spend.
 * When tokens reach zero, it turns orange to encourage users to buy more tokens.
 */
export function RemainingTokensCounter({
  allocatedTokens,
  totalTokens,
  className = '',
  onClick
}: RemainingTokensCounterProps) {
  // Calculate remaining tokens
  const remainingTokens = Math.max(0, totalTokens - allocatedTokens);
  const isOutOfTokens = remainingTokens <= 0 && totalTokens > 0;
  
  // Determine colors based on remaining tokens
  const iconColor = isOutOfTokens ? 'text-orange-500' : 'text-primary';
  const textColor = isOutOfTokens ? 'text-orange-500' : 'text-foreground';
  const containerClasses = isOutOfTokens ? 'animate-pulse' : '';
  
  // Create title text
  const titleText = isOutOfTokens 
    ? `Out of tokens! You've allocated ${allocatedTokens} out of ${totalTokens} monthly tokens. Click to upgrade.`
    : `${remainingTokens} tokens remaining out of ${totalTokens} monthly tokens`;

  return (
    <div
      className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${onClick ? 'cursor-pointer' : ''} ${className} ${containerClasses}`}
      onClick={onClick}
      title={titleText}
    >
      <Coins className={`h-4 w-4 ${iconColor}`} />
      <span className={`text-sm font-medium ${textColor}`}>
        {remainingTokens}
      </span>
    </div>
  );
}
