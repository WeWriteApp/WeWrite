'use client';

/**
 * useSettingsSections Hook
 *
 * Single source of truth for settings menu sections and their status indicators.
 * Used by both mobile (page.tsx) and desktop (layout.tsx) settings navigation.
 *
 * This ensures:
 * - Same sections appear in both mobile and desktop
 * - Same status indicators and logic
 * - No duplication of business logic
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { StatusIcon } from '../components/ui/status-icon';
import { useBankSetupStatus } from './useBankSetupStatus';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { useEarnings } from '../contexts/EarningsContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useNextPayoutCountdown, formatPayoutCountdown } from './useNextPayoutCountdown';
import { useUsernameStatus } from './useUsernameStatus';
import { useEmailVerificationStatus } from './useEmailVerificationStatus';
import { useAuth } from '../providers/AuthProvider';

// Icon wrapper components for settings sections
const createIconComponent = (name: IconName) => {
  const IconComponent = ({ className }: { className?: string }) => (
    <Icon name={name} size={20} className={className} />
  );
  IconComponent.displayName = `${name}Icon`;
  return IconComponent;
};

const Wallet = createIconComponent('Wallet');
const Flame = createIconComponent('Flame'); // Burn rate for spending
const DollarSign = createIconComponent('DollarSign'); // Get paid in dollars
const User = createIconComponent('User');
const Palette = createIconComponent('Palette');
const Bell = createIconComponent('Bell');
const Mail = createIconComponent('Mail');
const Shield = createIconComponent('Shield');
const Trash2 = createIconComponent('Trash2');
const SettingsIcon = createIconComponent('Settings');
const Info = createIconComponent('Info');

// Payout threshold in cents ($25)
const PAYOUT_THRESHOLD_CENTS = 2500;

/**
 * Hook to fetch count of recently deleted pages
 */
function useDeletedPagesCount(): { count: number; isLoading: boolean } {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const fetchCount = async () => {
      try {
        // Add cache buster to ensure fresh data
        const cacheBuster = Date.now();
        const response = await fetch(
          `/api/pages?userId=${user.uid}&includeDeleted=true&limit=100&_cb=${cacheBuster}`
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.pages) {
            // Filter for pages deleted within last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentlyDeleted = result.data.pages.filter((page: any) => {
              if (!page.deletedAt) return false;
              return new Date(page.deletedAt) >= thirtyDaysAgo;
            });

            setCount(recentlyDeleted.length);
          }
        }
      } catch (err) {
        console.error('Error fetching deleted pages count:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCount();
  }, [user?.uid]);

  return { count, isLoading };
}

export interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  requiresPayments?: boolean;
}

export interface SettingsSectionWithStatus extends SettingsSection {
  /** React element to render as status indicator (right side of menu item) */
  statusIndicator: React.ReactNode;
  /** Whether to show a warning dot on this section */
  showWarning: boolean;
  /** Variant for the warning dot: 'warning' (orange), 'error' (red), 'critical' (pulsing red) */
  warningVariant: 'warning' | 'error' | 'critical';
}

// Base section definitions - single source of truth
const BASE_SECTIONS: SettingsSection[] = [
  {
    id: 'fund-account',
    title: 'Fund Account',
    icon: Wallet,
    href: '/settings/fund-account',
    requiresPayments: true
  },
  {
    id: 'spend',
    title: 'Manage Spending',
    icon: Flame,
    href: '/settings/spend',
    requiresPayments: true
  },
  {
    id: 'earnings',
    title: 'Get paid',
    icon: DollarSign,
    href: '/settings/earnings',
    requiresPayments: true
  },
  {
    id: 'profile',
    title: 'Profile',
    icon: User,
    href: '/settings/profile'
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: Palette,
    href: '/settings/appearance'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    href: '/settings/notifications'
  },
  {
    id: 'email-preferences',
    title: 'Email Preferences',
    icon: Mail,
    href: '/settings/email-preferences'
  },
  {
    id: 'security',
    title: 'Security',
    icon: Shield,
    href: '/settings/security'
  },
  {
    id: 'deleted',
    title: 'Recently deleted',
    icon: Trash2,
    href: '/settings/deleted'
  },
  {
    id: 'advanced',
    title: 'Advanced',
    icon: SettingsIcon,
    href: '/settings/advanced'
  },
  {
    id: 'about',
    title: 'About WeWrite',
    icon: Info,
    href: '/settings/about'
  }
];

/**
 * Circular progress indicator for earnings threshold
 */
function EarningsProgressIndicator({
  availableBalance,
  size = 'sm'
}: {
  availableBalance: number;
  size?: 'sm' | 'md';
}) {
  const percentage = Math.min((availableBalance / PAYOUT_THRESHOLD_CENTS) * 100, 100);
  const remainingCents = PAYOUT_THRESHOLD_CENTS - availableBalance;
  const remainingDollars = (remainingCents / 100).toFixed(2);

  const svgSize = size === 'sm' ? 16 : 20;
  const strokeWidth = size === 'sm' ? 2.5 : 3;
  const radius = (svgSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-2">
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/20"
        />
        {/* Progress circle */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-primary transition-all duration-300"
        />
      </svg>
      <span className="text-xs text-muted-foreground">
        ${remainingDollars} to payout
      </span>
    </div>
  );
}

export function useSettingsSections(): {
  sections: SettingsSectionWithStatus[];
  isLoading: boolean;
} {
  // Get all the context data we need
  const bankSetupStatus = useBankSetupStatus();
  const { usdBalance } = useUsdBalance();
  const { earnings } = useEarnings();
  const { hasActiveSubscription, subscriptionAmount, isLoading: isLoadingSubscription } = useSubscription();
  const payoutCountdown = useNextPayoutCountdown();
  const { needsUsername } = useUsernameStatus();
  const emailVerificationStatus = useEmailVerificationStatus();
  const deletedPages = useDeletedPagesCount();

  const sections = useMemo(() => {
    return BASE_SECTIONS.map((section): SettingsSectionWithStatus => {
      let statusIndicator: React.ReactNode = null;
      let showWarning = false;
      let warningVariant: 'warning' | 'error' | 'critical' = 'warning';

      switch (section.id) {
        case 'fund-account': {
          // Show subscription amount
          statusIndicator = isLoadingSubscription ? (
            <Icon name="Loader" />
          ) : (
            <span className="text-xs text-muted-foreground font-medium">
              ${subscriptionAmount}/mo
            </span>
          );

          // Show warning if no active subscription
          if (hasActiveSubscription === false) {
            showWarning = true;
            warningVariant = 'error';
          }
          break;
        }

        case 'spend': {
          // Show remaining balance
          if (usdBalance) {
            const allocatedCents = usdBalance.allocatedUsdCents || 0;
            const totalCents = usdBalance.totalUsdCents || 0;
            const remainingCents = totalCents - allocatedCents;
            const remainingDollars = Math.abs(remainingCents) / 100;

            if (remainingCents >= 0) {
              statusIndicator = (
                <span className="text-xs text-muted-foreground font-medium">
                  ${remainingDollars.toFixed(0)} remaining
                </span>
              );
            } else {
              statusIndicator = (
                <span className="text-xs text-red-600 font-medium">
                  ${remainingDollars.toFixed(0)} over
                </span>
              );
            }
          } else {
            statusIndicator = <Icon name="Loader" />;
          }
          break;
        }

        case 'earnings': {
          // Only show status if user has earnings
          if (earnings?.hasEarnings) {
            if (bankSetupStatus.loading) {
              statusIndicator = (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <Icon name="Loader" size={12} />
                  Loading...
                </span>
              );
            } else if (!bankSetupStatus.isSetup) {
              statusIndicator = (
                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full font-medium">
                  Set up bank
                </span>
              );
            } else {
              // Bank is set up - check if meets payout threshold
              const availableBalance = earnings?.availableBalance || 0;
              const meetsThreshold = availableBalance >= PAYOUT_THRESHOLD_CENTS;

              if (meetsThreshold) {
                // Show countdown when threshold is met
                statusIndicator = (
                  <div className="flex items-center gap-2">
                    <StatusIcon status="success" size="sm" position="static" />
                    <span className="text-xs text-muted-foreground">
                      {formatPayoutCountdown(payoutCountdown)}
                    </span>
                  </div>
                );
              } else {
                // Show progress toward payout threshold
                statusIndicator = (
                  <EarningsProgressIndicator availableBalance={availableBalance} />
                );
              }
            }
          }
          break;
        }

        case 'profile': {
          // Show username or email verification warnings
          if (needsUsername) {
            statusIndicator = (
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                Set username
              </span>
            );
            showWarning = true;
            warningVariant = 'warning';
          } else if (emailVerificationStatus.needsVerification && emailVerificationStatus.isModalDismissed) {
            statusIndicator = (
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                Verify email
              </span>
            );
            showWarning = true;
            warningVariant = 'warning';
          }
          break;
        }

        case 'deleted': {
          // Show count of recently deleted pages
          if (deletedPages.isLoading) {
            statusIndicator = <Icon name="Loader" size={14} />;
          } else if (deletedPages.count > 0) {
            statusIndicator = (
              <span className="text-xs text-muted-foreground font-medium">
                {deletedPages.count}
              </span>
            );
          }
          break;
        }

        // Other sections don't have status indicators
        default:
          break;
      }

      return {
        ...section,
        statusIndicator,
        showWarning,
        warningVariant
      };
    });
  }, [
    bankSetupStatus,
    usdBalance,
    earnings,
    hasActiveSubscription,
    subscriptionAmount,
    isLoadingSubscription,
    payoutCountdown,
    needsUsername,
    emailVerificationStatus,
    deletedPages
  ]);

  return {
    sections,
    isLoading: isLoadingSubscription || bankSetupStatus.loading
  };
}
