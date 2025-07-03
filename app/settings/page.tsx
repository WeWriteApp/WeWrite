'use client';

import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  Palette
} from 'lucide-react';
import { useFeatureFlag } from '../utils/feature-flags';
import { getOptimizedUserSubscription } from '../firebase/optimizedSubscription';
import { isActiveSubscription } from '../utils/subscriptionStatus';
import { WarningDot } from '../components/ui/warning-dot';
import { useSubscriptionWarning } from '../hooks/useSubscriptionWarning';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  requiresPayments?: boolean;
  requiresTokenSystem?: boolean;
}

export default function SettingsIndexPage() {
  const { session } = useCurrentAccount();
  const router = useRouter();
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const { shouldShowWarning: shouldShowSubscriptionWarning, warningVariant } = useSubscriptionWarning();

  // Check feature flags with proper user ID for real-time updates
  const paymentsEnabled = useFeatureFlag('payments', session?.email, session?.uid);
  // Token system is enabled by payments feature flag
  const tokenSystemEnabled = paymentsEnabled;

  const settingsSections: SettingsSection[] = [
    {
      id: 'subscription',
      title: 'Subscription',
      icon: ShoppingCart,
      href: '/settings/subscription',
      requiresPayments: true,
      requiresTokenSystem: true
    },
    {
      id: 'spend-tokens',
      title: 'Spend Tokens',
      icon: Coins,
      href: '/settings/spend-tokens',
      requiresPayments: true,
      requiresTokenSystem: true
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

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    // Filter sections based on feature flags to get available sections
    const availableSections = settingsSections.filter(section => {
      if (section.requiresPayments && !paymentsEnabled) {
        return false;
      }
      if (section.requiresTokenSystem && !tokenSystemEnabled) {
        return false;
      }
      return true;
    });

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
  }, [, session, router, paymentsEnabled, tokenSystemEnabled]);

  // Check subscription status when payments are enabled and user is available
  useEffect(() => {
    if (!session || !paymentsEnabled) {
      setHasActiveSubscription(null);
      return;
    }

    const checkSubscriptionStatus = async () => {
      try {
        const subscription = await getOptimizedUserSubscription(session.uid, {
          useCache: true,
          cacheTTL: 5 * 60 * 1000 // 5 minute cache
        });

        if (subscription) {
          const isActive = isActiveSubscription(
            subscription.status,
            subscription.cancelAtPeriodEnd,
            subscription.currentPeriodEnd
          );
          setHasActiveSubscription(isActive);
        } else {
          setHasActiveSubscription(false);
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setHasActiveSubscription(false);
      }
    };

    checkSubscriptionStatus();
  }, [, session, paymentsEnabled]);

  // Filter sections based on feature flags
  const availableSections = settingsSections.filter(section => {
    if (section.requiresPayments && !paymentsEnabled) {
      return false;
    }
    if (section.requiresTokenSystem && !tokenSystemEnabled) {
      return false;
    }
    return true;
  });

  const handleSectionClick = (href: string) => {
    router.push(href);
  };

  if (!session) {
    return null;
  }

  return (
    <div>
      {/* Mobile Settings List */}
      <div className="lg:hidden">
        <div className="divide-y divide-border">
          {availableSections.map((section) => {
            const IconComponent = section.icon;

            // Show warning for subscription-related sections if there are subscription issues
            const showWarning = (section.id === 'subscription' || section.id === 'buy-tokens') &&
              shouldShowSubscriptionWarning;

            return (
              <div key={section.id} className="relative">
                <button
                  onClick={() => handleSectionClick(section.href)}
                  className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 mr-3">
                      <IconComponent className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{section.title}</span>
                  </div>
                  <div className="flex items-center">
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