"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

// Simplified interface: tier is now pre-computed by APIs
// status and amount are deprecated and kept only for backward compatibility
interface SubscriptionTierBadgeProps {
  tier?: string | null;
  /** @deprecated No longer used - tier is pre-computed by APIs */
  status?: string | null;
  /** @deprecated No longer used - tier is pre-computed by APIs */
  amount?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLoading?: boolean;
  pillVariant?: 'primary' | 'outline';
}

export function SubscriptionTierBadge({
  tier,
  status,
  amount,
  size = 'sm',
  className = '',
  isLoading = false,
  pillVariant = 'primary'
}: SubscriptionTierBadgeProps) {

  // Size configurations - moved to top to fix initialization error
  const sizeConfig = {
    sm: { icon: 12, gap: 'gap-0.5' },
    md: { icon: 14, gap: 'gap-1' },
    lg: { icon: 16, gap: 'gap-1' }
  };

  // Show loading state only if explicitly loading
  // Don't show loading when subscription data has been fetched but is null (no subscription)
  if (isLoading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center ${className}`}>
              <Icon name="Loader" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Loading subscription...</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Use pre-computed tier directly from API with safety fallback
  const finalTier = tier || 'inactive';

  const config = sizeConfig[size];

  // Use currentColor so the icon inherits text color from parent
  // This ensures the icon matches the text color regardless of pill variant or theme
  const getCancelIconColor = () => {
    return ''; // No color class - uses currentColor by default
  };

  // Get badge content based on tier
  const getBadgeContent = () => {
    switch (finalTier) {
      case 'inactive':
        return {
          icon: <Icon name="Ban" size={config.icon} className={getCancelIconColor()} />,
          tooltip: 'No active subscription - $0/mo',
          color: getCancelIconColor()
        };
      case 'tier1':
        return {
          icon: <Icon name="Star" size={config.icon} weight="fill" className="text-yellow-400/70" />,
          tooltip: 'Supporter - $10/mo',
          color: 'text-yellow-400/70'
        };
      case 'tier2':
        return {
          icon: (
            <span className={`inline-flex ${config.gap}`}>
              <Icon name="Star" size={config.icon} weight="fill" className="text-yellow-500" />
              <Icon name="Star" size={config.icon} weight="fill" className="text-yellow-500" />
            </span>
          ),
          tooltip: 'Advocate - $20/mo',
          color: 'text-yellow-500'
        };
      case 'tier3':
        return {
          icon: (
            <span className={`inline-flex ${config.gap} relative group cursor-pointer`}>
              {/* Particles emitting outward from center */}
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
                {/* Emitting particles - using scale animation to expand outward */}
                <span className="absolute w-1 h-1 bg-yellow-300/70 rounded-full particle-emit"
                     style={{
                       '--emit-x': '12px',
                       '--emit-y': '-8px',
                       animationDelay: '0s',
                       animationDuration: '2.5s',
                     } as React.CSSProperties}></span>
                <span className="absolute w-1 h-1 bg-yellow-300/60 rounded-full particle-emit"
                     style={{
                       '--emit-x': '-10px',
                       '--emit-y': '6px',
                       animationDelay: '0.8s',
                       animationDuration: '3s',
                     } as React.CSSProperties}></span>
                <span className="absolute w-1 h-1 bg-yellow-300/50 rounded-full particle-emit"
                     style={{
                       '--emit-x': '14px',
                       '--emit-y': '10px',
                       animationDelay: '1.6s',
                       animationDuration: '2.8s',
                     } as React.CSSProperties}></span>
                <span className="absolute w-0.5 h-0.5 bg-yellow-200/80 rounded-full particle-emit"
                     style={{
                       '--emit-x': '-8px',
                       '--emit-y': '-10px',
                       animationDelay: '0.4s',
                       animationDuration: '2.2s',
                     } as React.CSSProperties}></span>
                <span className="absolute w-0.5 h-0.5 bg-yellow-200/60 rounded-full particle-emit"
                     style={{
                       '--emit-x': '6px',
                       '--emit-y': '12px',
                       animationDelay: '1.2s',
                       animationDuration: '2.6s',
                     } as React.CSSProperties}></span>
              </span>

              {/* Main stars with glow effect */}
              <Icon name="Star" size={config.icon} weight="fill" className="text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)] animate-pulse relative z-10" />
              <Icon name="Star" size={config.icon} weight="fill" className="text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)] animate-pulse relative z-10" style={{ animationDelay: '0.2s' }} />
              <Icon name="Star" size={config.icon} weight="fill" className="text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)] animate-pulse relative z-10" style={{ animationDelay: '0.4s' }} />

              {/* CSS for particle emit animation */}
              <style jsx>{`
                .particle-emit {
                  animation: emitOutward var(--duration, 2.5s) ease-out infinite;
                }
                @keyframes emitOutward {
                  0% {
                    transform: translate(0, 0) scale(0);
                    opacity: 0;
                  }
                  10% {
                    opacity: 1;
                    transform: translate(0, 0) scale(1);
                  }
                  100% {
                    transform: translate(var(--emit-x, 10px), var(--emit-y, -10px)) scale(0);
                    opacity: 0;
                  }
                }
              `}</style>
            </span>
          ),
          tooltip: 'Champion - $30+/mo',
          color: 'text-yellow-400'
        };
      default:
        return {
          icon: <Icon name="Ban" size={config.icon} className={getCancelIconColor()} />,
          tooltip: 'No subscription',
          color: getCancelIconColor()
        };
    }
  };

  const badgeContent = getBadgeContent();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${className}`}>
            {badgeContent.icon}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{badgeContent.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
