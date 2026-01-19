"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useRouter } from 'next/navigation';

interface ExternalLinkPaywallProps {
  variant?: 'modal' | 'inline' | 'toast';
  className?: string;
  onDismiss?: () => void;
}

/**
 * ExternalLinkPaywall - Shown when a non-subscriber tries to add an external link
 *
 * Variants:
 * - modal: Full paywall UI for the link editor modal (default)
 * - inline: Compact version for inline editor prompts
 * - toast: Minimal version for toast notifications
 */
export default function ExternalLinkPaywall({
  variant = 'modal',
  className = '',
  onDismiss
}: ExternalLinkPaywallProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    router.push('/settings/subscription');
  };

  if (variant === 'toast') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Icon name="Lock" size={16} className="text-muted-foreground flex-shrink-0" />
        <span className="text-sm">
          External links are a paid feature.{' '}
          <button
            onClick={handleUpgrade}
            className="text-primary hover:underline font-medium"
          >
            Upgrade now
          </button>
        </span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-md bg-muted/50 ${className}`}>
        <Icon name="Lock" size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Activate subscription to add external links
        </span>
      </div>
    );
  }

  // Default: modal variant
  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 text-center space-y-4 ${className}`}>
      {/* Lock icon with gradient background */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-xl scale-150" />
        <div className="relative w-16 h-16 rounded-full bg-muted/80 flex items-center justify-center">
          <Icon name="Lock" size={28} className="text-muted-foreground" />
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          External Links are a Paid Feature
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Upgrade to add links to external websites and expand your content with references.
        </p>
      </div>

      {/* Benefits list */}
      <div className="flex flex-col gap-2 text-left w-full max-w-xs">
        <div className="flex items-center gap-2 text-sm">
          <Icon name="Check" size={16} className="text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">Link to any external website</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Icon name="Check" size={16} className="text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">Custom link text for URLs</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Icon name="Check" size={16} className="text-green-500 flex-shrink-0" />
          <span className="text-muted-foreground">Support independent writers</span>
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
        <Button onClick={handleUpgrade} className="w-full">
          <Icon name="Sparkles" size={16} className="mr-2" />
          Upgrade Now
        </Button>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">
            Maybe later
          </Button>
        )}
      </div>

      {/* Pricing hint */}
      <p className="text-xs text-muted-foreground">
        Starting at $10/month
      </p>
    </div>
  );
}
