'use client';

import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  User,
  CreditCard,
  DollarSign,
  Settings as SettingsIcon,
  Trash2,
  ChevronRight,
  AlertTriangle,
  ShoppingCart,
  Coins,
  Palette,
  Wallet,
  Loader2,
  Bell
} from 'lucide-react';
import { StatusIcon } from '../components/ui/status-icon';

// Removed old optimized subscription import - using API-first approach
import { isActiveSubscription, getSubscriptionStatusInfo } from '../utils/subscriptionStatus';
import { WarningDot } from '../components/ui/warning-dot';
import { useBankSetupStatus } from '../hooks/useBankSetupStatus';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { useEarnings } from '../contexts/EarningsContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { UsdPieChart } from '../components/ui/UsdPieChart';
import { RemainingUsdCounter } from '../components/ui/RemainingUsdCounter';
import { useNextPayoutCountdown, formatPayoutCountdown } from '../hooks/useNextPayoutCountdown';
import { getAnalyticsService } from '../utils/analytics-service';
import { SETTINGS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';


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
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [subscriptionAmount, setSubscriptionAmount] = useState<number | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState<boolean>(true);
  // Get bank setup status, earnings, and balances from consolidated context
  const bankSetupStatus = useBankSetupStatus();
  const { usdBalance, hasActiveSubscription: contextHasActiveSubscription } = useUsdBalance();
  const { earnings } = useEarnings();
  const payoutCountdown = useNextPayoutCountdown();

  // Derive subscription warning state from consolidated context
  const shouldShowSubscriptionWarning = contextHasActiveSubscription === false;

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

  // Check subscription status when user is available
  // Cache for subscription data
  const subscriptionCacheRef = useRef<{
    data: { hasActiveSubscription: boolean; amount: number } | null;
    timestamp: number;
    userId: string | null;
  }>({ data: null, timestamp: 0, userId: null });

  useEffect(() => {
    if (!user) {
      setHasActiveSubscription(null);
      setSubscriptionAmount(null);
      setIsLoadingSubscription(false);
      return;
    }

    const checkSubscriptionStatus = async () => {
      setIsLoadingSubscription(true);

      try {
        // Check cache first (5 minute cache)
        const now = Date.now();
        const cacheAge = now - subscriptionCacheRef.current.timestamp;
        const isCacheValid = cacheAge < 5 * 60 * 1000; // 5 minutes
        const isSameUser = subscriptionCacheRef.current.userId === user.uid;

        if (isCacheValid && isSameUser && subscriptionCacheRef.current.data) {
          console.log('[Settings] Using cached subscription data');
          const cachedData = subscriptionCacheRef.current.data;
          setHasActiveSubscription(cachedData.hasActiveSubscription);
          setSubscriptionAmount(cachedData.amount);
          setIsLoadingSubscription(false);
          return;
        }

        // Fetch fresh data
        console.log('[Settings] Fetching fresh subscription data');
        const response = await fetch('/api/account-subscription');
        const data = response.ok ? await response.json() : null;
        const subscription = data?.hasSubscription ? data.fullData : null;

        if (subscription) {
          const isActive = isActiveSubscription(
            subscription.status,
            subscription.cancelAtPeriodEnd,
            subscription.currentPeriodEnd
          );
          setHasActiveSubscription(isActive);

          // Get subscription amount - try multiple sources for compatibility
          let amount = 0;

          // First try the direct amount field (our current data structure)
          if (subscription.amount) {
            amount = subscription.amount;
          }
          // Fallback to Stripe price data format if available
          else if (subscription.items?.data?.[0]?.price?.unit_amount) {
            amount = subscription.items.data[0].price.unit_amount / 100;
          }

          console.log('[Settings] Subscription data:', {
            hasSubscription: data.hasSubscription,
            amount: amount,
            subscriptionAmount: subscription.amount,
            stripeAmount: subscription.items?.data?.[0]?.price?.unit_amount
          });

          setSubscriptionAmount(amount);

          // Cache the result
          subscriptionCacheRef.current = {
            data: { hasActiveSubscription: isActive, amount },
            timestamp: now,
            userId: user.uid
          };
        } else {
          setHasActiveSubscription(false);
          setSubscriptionAmount(0); // This is a real value: no subscription = $0

          // Cache the result
          subscriptionCacheRef.current = {
            data: { hasActiveSubscription: false, amount: 0 },
            timestamp: now,
            userId: user.uid
          };
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setHasActiveSubscription(false);
        setSubscriptionAmount(0); // This is a real value: error state = $0
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    checkSubscriptionStatus();
  }, [user]);

  // Track settings page view
  useEffect(() => {
    if (user) {
      const analytics = getAnalyticsService();
      analytics.trackEvent({
        category: EVENT_CATEGORIES.SETTINGS,
        action: SETTINGS_EVENTS.SETTINGS_PAGE_VIEWED,
        has_subscription: contextHasActiveSubscription
      });
    }
  }, [user, contextHasActiveSubscription]);

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
        <div className="wewrite-card divide-y divide-border">
          {availableSections.map((section) => {
            const IconComponent = section.icon;

            // Show warning for funding-related sections if there are subscription issues
            // But don't show warning dots when we have status icons or when loading
            // Only show warnings for truly problematic states, not for active subscriptions
            const showWarning = section.id === 'fund-account' &&
              shouldShowSubscriptionWarning &&
              hasActiveSubscription !== null && // Don't show while loading
              hasActiveSubscription === false; // Only show when explicitly false (not active)

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
                    variant={warningVariant}
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
