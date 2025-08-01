"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import UnifiedLoader from "../components/ui/unified-loader";
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
import { StatusIcon } from '../components/ui/status-icon';
import NavHeader from '../components/layout/NavHeader';

import { cn } from '../lib/utils';
// Removed old optimized subscription import - using API-first approach
import { isActiveSubscription, getSubscriptionStatusInfo } from '../utils/subscriptionStatus';
import { WarningDot } from '../components/ui/warning-dot';
import { useBankSetupStatus } from '../hooks/useBankSetupStatus';
import { useUserEarnings } from '../hooks/useUserEarnings';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { RemainingUsdCounter } from '../components/ui/RemainingUsdCounter';
import { UsdPieChart } from '../components/ui/UsdPieChart';


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
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [subscriptionStatusInfo, setSubscriptionStatusInfo] = useState<any>(null);
  const [subscriptionAmount, setSubscriptionAmount] = useState<number>(0);



  // Get bank setup status, user earnings, and USD balance
  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useUserEarnings();
  const { usdBalance } = useUsdBalance();

  useEffect(() => {
    console.log('🎯 Settings Layout: Auth check', {
      isAuthenticated,
      isLoading,
      hasUser: !!user,
      userUid: user?.uid
    });

    // Don't redirect while still loading authentication state
    if (isLoading) {
      console.log('🎯 Settings Layout: Still loading authentication state, not redirecting');
      return;
    }

    if (!isAuthenticated) {
      console.log('🎯 Settings Layout: Redirecting to login because not authenticated');
      router.push('/auth/login');
      return;
    }
  }, [isAuthenticated, isLoading, router, user]);

  // Check subscription status when user is available
  useEffect(() => {
    if (!user) {
      setHasActiveSubscription(null);
      return;
    }

    const checkSubscriptionStatus = async () => {
      try {
        // Use API-first approach instead of complex optimized subscription
        const response = await fetch('/api/account-subscription');
        const data = response.ok ? await response.json() : null;
        const subscription = data?.hasSubscription ? data.fullData : null;

        if (subscription) {
          const statusInfo = getSubscriptionStatusInfo(
            subscription.status,
            subscription.cancelAtPeriodEnd,
            subscription.currentPeriodEnd
          );
          const isActive = isActiveSubscription(
            subscription.status,
            subscription.cancelAtPeriodEnd,
            subscription.currentPeriodEnd
          );
          setHasActiveSubscription(isActive);
          setSubscriptionStatusInfo(statusInfo);

          // Get subscription amount from price data
          const amount = subscription.items?.data?.[0]?.price?.unit_amount
            ? subscription.items.data[0].price.unit_amount / 100
            : 0;
          setSubscriptionAmount(amount);
        } else {
          setHasActiveSubscription(false);
          setSubscriptionStatusInfo(null);
          setSubscriptionAmount(0);
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setHasActiveSubscription(false);
        setSubscriptionAmount(0);
      }
    };

    checkSubscriptionStatus();
  }, [user]);

  if (!isAuthenticated) {
    return <UnifiedLoader isLoading={true} message="Loading settings..." />;
  }

  if (!user) {
    return null;
  }

  const settingsSections: SettingsSection[] = [
    {
      id: 'fund-account',
      title: 'Fund Account',
      icon: ShoppingCart,
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
  const availableSections = settingsSections;

  const handleSectionClick = (href: string) => {
    router.push(href);
  };

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header - Only show on main settings page */}
      {pathname === '/settings' && (
        <div className="lg:hidden">
          <NavHeader backUrl="/" />
        </div>
      )}

      <div className="lg:flex">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-border lg:bg-background lg:z-10">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center px-6 py-4 border-b border-border">
              <h1 className="text-xl font-semibold select-none">Settings</h1>
            </div>

            <nav className="flex-1 px-3 py-4">
              <div className="space-y-1">
                {availableSections.map((section) => {
                  const IconComponent = section.icon;
                  const isActive = pathname === section.href ||
                    (pathname.startsWith(section.href + '/') && section.href !== '/settings');

                  // Show warning dots only for truly problematic states
                  // Don't show warning dots when we have status icons or when loading
                  const showWarning = false; // No longer needed for USD system

                  // Get warning variant based on subscription status
                  const getWarningVariant = () => {
                    if (!subscriptionStatusInfo) return 'warning';
                    switch (subscriptionStatusInfo.status) {
                      case 'past_due':
                      case 'unpaid':
                        return 'critical';
                      case 'incomplete':
                        return 'error';
                      default:
                        return 'warning';
                    }
                  };

                  return (
                    <div key={section.id} className="relative">
                      <button
                        onClick={() => handleSectionClick(section.href)}
                        className={cn(
                          "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors select-none",
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

                        {/* Status icons for specific sections - show success and warnings */}
                        {section.id === 'fund-account' && (
                          <span className="text-xs text-muted-foreground font-medium">
                            ${subscriptionAmount}/mo
                          </span>
                        )}



                        {section.id === 'earnings' && (() => {
                          // Show "Set up bank" if bank isn't set up
                          if (!bankSetupStatus.isSetup) {
                            return (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full font-medium">
                                Set up bank
                              </span>
                            );
                          }
                          // Show success if bank is set up properly
                          if (bankSetupStatus.isSetup) {
                            return <StatusIcon status="success" size="sm" position="static" />;
                          }
                          return null;
                        })()}

                        {section.id === 'spend' && usdBalance && (() => {
                          const allocatedCents = usdBalance.allocatedUsdCents || 0;
                          const totalCents = usdBalance.totalUsdCents || 0;
                          const remainingCents = totalCents - allocatedCents;
                          const remainingDollars = Math.abs(remainingCents) / 100;

                          if (remainingCents >= 0) {
                            return (
                              <span className="text-xs text-muted-foreground font-medium">
                                ${remainingDollars.toFixed(0)} remaining
                              </span>
                            );
                          } else {
                            return (
                              <span className="text-xs text-red-600 font-medium">
                                ${remainingDollars.toFixed(0)} over
                              </span>
                            );
                          }
                        })()}


                      </button>
                      {showWarning && (
                        <WarningDot
                          variant={getWarningVariant()}
                          size="sm"
                          position="top-right"
                          offset={{ top: '8px', right: '8px' }}
                        />
                      )}
                    </div>
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