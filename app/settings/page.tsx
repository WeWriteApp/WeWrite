'use client';

import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  User,
  DollarSign,
  Settings as SettingsIcon,
  Trash2,
  ChevronRight,
  Coins,
  Palette,
  Wallet,
  Loader2,
  Bell,
  Mail
} from 'lucide-react';
import { StatusIcon } from '../components/ui/status-icon';
import { WarningDot } from '../components/ui/warning-dot';
import { useBankSetupStatus } from '../hooks/useBankSetupStatus';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { useEarnings } from '../contexts/EarningsContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useNextPayoutCountdown, formatPayoutCountdown } from '../hooks/useNextPayoutCountdown';
import { getAnalyticsService } from '../utils/analytics-service';
import { SETTINGS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';
import { useUsernameStatus } from '../hooks/useUsernameStatus';
import { useEmailVerificationStatus } from '../hooks/useEmailVerificationStatus';


interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  requiresPayments?: boolean;
}

export default function SettingsIndexPage() {
  const { user } = useAuth();
  const router = useRouter();
  // Get bank setup status, earnings, and balances from consolidated context
  const bankSetupStatus = useBankSetupStatus();
  const { usdBalance } = useUsdBalance();
  const { earnings } = useEarnings();
  const { hasActiveSubscription, subscriptionAmount, isLoading: isLoadingSubscription } = useSubscription();
  const payoutCountdown = useNextPayoutCountdown();
  // Get username status to show warning dot on Profile section
  const { needsUsername } = useUsernameStatus();
  // Get email verification status to show blinking orange dot on Profile section
  const emailVerificationStatus = useEmailVerificationStatus();

  // Derive subscription warning state from subscription context (respects admin testing mode)
  const shouldShowSubscriptionWarning = hasActiveSubscription === false;

  const settingsSections: SettingsSection[] = [
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
      icon: Coins,
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
    }
  ];

  // Track settings page view
  useEffect(() => {
    if (user) {
      const analytics = getAnalyticsService();
      analytics.trackEvent({
        category: EVENT_CATEGORIES.SETTINGS,
        action: SETTINGS_EVENTS.SETTINGS_PAGE_VIEWED,
        has_subscription: hasActiveSubscription
      });
    }
  }, [user, hasActiveSubscription]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Get available sections
    const availableSections = settingsSections;

    // On desktop, always redirect to first available settings page
    // Use a more robust check for desktop vs mobile
    const checkAndRedirect = () => {
      if (typeof window !== 'undefined') {
        const isDesktop = window.innerWidth >= 1024;
        if (isDesktop && availableSections.length > 0) {
          router.push(availableSections[0].href);
        }
      }
    };

    // Check immediately
    checkAndRedirect();

    // Also check on resize to handle window size changes
    const handleResize = () => checkAndRedirect();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [user, router]);



  // Get available sections
  const availableSections = settingsSections;

  const handleSectionClick = (href: string, sectionId: string) => {
    // Track section click
    const analytics = getAnalyticsService();
    analytics.trackEvent({
      category: EVENT_CATEGORIES.SETTINGS,
      action: SETTINGS_EVENTS.SETTINGS_SECTION_CLICKED,
      section_id: sectionId,
      section_href: href
    });
    router.push(href);
  };

  if (!user) {
    return null;
  }

  return (
    <div>
      {/* Mobile Settings List */}
      <div className="lg:hidden p-4">
        <div className="wewrite-card wewrite-card-no-padding divide-y divide-border overflow-hidden">
          {availableSections.map((section) => {
            const IconComponent = section.icon;

            // Show warning for funding-related sections if there are subscription issues
            // But don't show warning dots when we have status icons or when loading
            // Only show warnings for truly problematic states, not for active subscriptions
            const showFundingWarning = section.id === 'fund-account' &&
              shouldShowSubscriptionWarning &&
              hasActiveSubscription !== null && // Don't show while loading
              hasActiveSubscription === false; // Only show when explicitly false (not active)

            // Show warning for profile section if username is needed
            const showProfileWarning = section.id === 'profile' && needsUsername;

            // Show blinking orange dot for email verification needed (after modal dismissed)
            const showEmailVerificationWarning = section.id === 'profile' &&
              emailVerificationStatus.needsVerification &&
              emailVerificationStatus.isModalDismissed;

            const showWarning = showFundingWarning || showProfileWarning || showEmailVerificationWarning;
            // Use orange 'warning' variant for both username and email verification
            const warningVariantToUse = (showProfileWarning || showEmailVerificationWarning) ? 'warning' : 'error';

            return (
              <div key={section.id} className="relative">
                <button
                  onClick={() => handleSectionClick(section.href, section.id)}
                  className="w-full flex items-center justify-between px-4 py-4 text-left nav-hover-state nav-active-state transition-colors select-none"
                >
                  <div className="flex items-center">
                    <IconComponent className="h-5 w-5 mr-3 text-foreground" />
                    <span className="font-medium">{section.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status icons for specific sections - show success and warnings */}
                    {section.id === 'fund-account' && (
                      <span className="text-sm text-muted-foreground font-medium">
                        {isLoadingSubscription ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `$${subscriptionAmount}/mo`
                        )}
                      </span>
                    )}

                    {section.id === 'profile' && needsUsername && (
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                        Set username
                      </span>
                    )}

                    {section.id === 'profile' && !needsUsername && emailVerificationStatus.needsVerification && emailVerificationStatus.isModalDismissed && (
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                        Verify email
                      </span>
                    )}

                    {section.id === 'earnings' && earnings?.hasEarnings && (
                      bankSetupStatus.loading ? (
                        <span className="text-sm bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading...
                        </span>
                      ) : bankSetupStatus.isSetup ? (
                        <div className="flex items-center gap-2">
                          <StatusIcon status="success" size="sm" position="static" />
                          <span className="text-sm text-muted-foreground">
                            {formatPayoutCountdown(payoutCountdown)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full font-medium">
                          Set up bank
                        </span>
                      )
                    )}

                    {section.id === 'spend' && (
                      usdBalance ? (() => {
                        const allocatedCents = usdBalance.allocatedUsdCents || 0;
                        const totalCents = usdBalance.totalUsdCents || 0;
                        const remainingCents = totalCents - allocatedCents;
                        const remainingDollars = Math.abs(remainingCents) / 100;

                        if (remainingCents >= 0) {
                          return (
                            <span className="text-sm text-muted-foreground font-medium">
                              ${remainingDollars.toFixed(0)} remaining
                            </span>
                          );
                        } else {
                          return (
                            <span className="text-sm text-red-600 font-medium">
                              ${remainingDollars.toFixed(0)} over
                            </span>
                          );
                        }
                      })() : (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )
                    )}

                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
                {showWarning && (
                  <WarningDot
                    variant={warningVariantToUse}
                    size="sm"
                    position="top-right"
                    offset={{ top: '12px', right: '12px' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop should never see this page - it redirects automatically */}
    </div>
  );
}
