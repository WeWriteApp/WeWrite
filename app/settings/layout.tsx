"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { PageLoader } from "../components/ui/page-loader";
import { Button } from "../components/ui/button";
import {
  ChevronLeft,
  User,
  CreditCard,
  DollarSign,
  Settings as SettingsIcon,
  Trash2,
  AlertTriangle,
  ShoppingCart,
  Coins,
  Palette
} from 'lucide-react';
import { useFeatureFlag } from '../utils/feature-flags';
import { cn } from '../lib/utils';
import { getOptimizedUserSubscription } from '../firebase/optimizedSubscription';
import { isActiveSubscription } from '../utils/subscriptionStatus';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  requiresPayments?: boolean;
}

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const { session, isAuthenticated } = useCurrentAccount();
  const router = useRouter();
  const pathname = usePathname();
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);

  // Check payments feature flag with proper user ID for real-time updates
  const paymentsEnabled = useFeatureFlag('payments', session?.email, session?.uid);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
  }, [isAuthenticated, router]);

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

  if (!isAuthenticated) {
    return <PageLoader message="Loading settings..." />;
  }

  if (!session) {
    return null;
  }

  const settingsSections: SettingsSection[] = [
    {
      id: 'subscription',
      title: 'Subscription',
      icon: ShoppingCart,
      href: '/settings/subscription',
      requiresPayments: true
    },
    {
      id: 'spend-tokens',
      title: 'Spend Tokens',
      icon: Coins,
      href: '/settings/spend-tokens',
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

  // Filter sections based on feature flags
  const availableSections = settingsSections.filter(section => {
    if (section.requiresPayments && !paymentsEnabled) {
      return false;
    }
    return true;
  });

  const handleSectionClick = (href: string) => {
    router.push(href);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header - Only show on main settings page */}
      {pathname === '/settings' && (
        <div className="lg:hidden">
          <div className="flex items-center px-4 py-3 border-b border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="mr-3"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
        </div>
      )}

      <div className="lg:flex">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-border lg:bg-background lg:z-10">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center px-6 py-4 border-b border-border">
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>

            <nav className="flex-1 px-3 py-4">
              <div className="space-y-1">
                {availableSections.map((section) => {
                  const IconComponent = section.icon;
                  const isActive = pathname === section.href ||
                    (pathname.startsWith(section.href + '/') && section.href !== '/settings');

                  // Show warning icon for subscription if no active subscription
                  const showWarning = section.id === 'subscription' &&
                    paymentsEnabled &&
                    hasActiveSubscription === false;

                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionClick(section.href)}
                      className={cn(
                        "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <IconComponent className={cn(
                        "h-5 w-5 mr-3",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className="flex-1 text-left">{section.title}</span>
                      {showWarning && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:ml-64 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}