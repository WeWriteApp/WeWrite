'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import TokenAllocationDisplay from '../../components/subscription/TokenAllocationDisplay';
import TokenAllocationBreakdown from '../../components/subscription/TokenAllocationBreakdown';


import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { NAVIGATION_EVENTS } from '../../constants/analytics-events';
import { getUserTokenBalance, clearUserTokens, SimulatedTokenBalance } from '../../utils/simulatedTokens';
import {
  DollarSign,
  CreditCard,
  ChevronLeft,
  AlertTriangle
} from 'lucide-react';


// Define interfaces
interface Subscription {
  id: string;
  amount: number;
  status: string;
  billingCycleEnd?: string;
  pledgedAmount?: number;
  stripeCustomerId?: string;
  stripePriceId?: string;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface TokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
  pendingTokens?: number;
}

export default function SpendTokensPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { trackInteractionEvent } = useWeWriteAnalytics();

  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [simulatedTokenBalance, setSimulatedTokenBalance] = useState<any>(null);
  const [allocationData, setAllocationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);



  // State to track real-time allocation changes from the breakdown component
  const [liveAllocationData, setLiveAllocationData] = useState<any>(null);

  // Track page view
  useEffect(() => {
    trackInteractionEvent(NAVIGATION_EVENTS.PAGE_VIEWED, {
      page_name: 'spend_tokens',
      page_section: 'settings',
      feature_context: 'payments'
    });
  }, [trackInteractionEvent]);

  // Callback to receive allocation updates from the breakdown component
  const handleAllocationUpdate = useCallback((updatedAllocationData: any) => {
    setLiveAllocationData(updatedAllocationData);
  }, []);

  // Fetch current subscription and token balance
  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch subscription
      const subscriptionResponse = await fetch('/api/account-subscription');
      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        console.log('🎯 Spend Tokens: Loaded subscription data', subscriptionData);
        setCurrentSubscription(subscriptionData);
      } else {
        console.log('🎯 Spend Tokens: Subscription response not ok', subscriptionResponse.status);
      }

      // Fetch token balance
      const tokenResponse = await fetch('/api/tokens/balance');
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        console.log('🎯 Spend Tokens: Loaded token balance data', tokenData);

        // Extract the balance data consistently with other components
        if (tokenData.summary) {
          // Ensure consistent calculation of available tokens
          const availableTokens = tokenData.summary.totalTokens - tokenData.summary.allocatedTokens;
          setTokenBalance({
            totalTokens: tokenData.summary.totalTokens,
            allocatedTokens: tokenData.summary.allocatedTokens,
            availableTokens: availableTokens,
            pendingTokens: 0
          });
        } else if (tokenData.balance) {
          // Ensure consistent calculation of available tokens
          const availableTokens = tokenData.balance.totalTokens - tokenData.balance.allocatedTokens;
          setTokenBalance({
            totalTokens: tokenData.balance.totalTokens,
            allocatedTokens: tokenData.balance.allocatedTokens,
            availableTokens: availableTokens,
            pendingTokens: 0
          });
        } else {
          setTokenBalance(null);
        }
      } else {
        console.log('🎯 Spend Tokens: Token balance response not ok', tokenResponse.status);
      }

      // FIXED: Use the same token balance API as header and composition bars for consistency
      // This ensures we get the most up-to-date token allocation data
      const balanceResponse = await fetch('/api/tokens/balance');
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        console.log('🎯 Spend Tokens: Loaded balance data (same as header)', balanceData);

        // Convert balance API response to allocations format for compatibility
        const allocationsData = {
          success: true,
          allocations: balanceData.allocations || [],
          summary: {
            totalAllocations: balanceData.allocations?.length || 0,
            totalTokensAllocated: balanceData.summary?.allocatedTokens || 0,
            balance: balanceData.balance || balanceData.summary
          }
        };
        setAllocationData(allocationsData);
      } else {
        console.log('🎯 Spend Tokens: Balance response not ok', balanceResponse.status);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Convert simulated allocations to real database allocations
  const convertSimulatedAllocations = async (simBalance: SimulatedTokenBalance) => {
    if (!user?.uid || simBalance.allocations.length === 0) {
      return;
    }

    try {
      console.log('🎯 Spend Tokens: Converting simulated allocations to real allocations');
      let convertedCount = 0;
      const errors: string[] = [];

      for (const allocation of simBalance.allocations) {
        try {
          // Use the page allocation API to create real allocations
          const response = await fetch('/api/tokens/page-allocation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pageId: allocation.pageId,
              tokenChange: allocation.tokens
            })
          });

          if (response.ok) {
            convertedCount++;
            console.log(`🎯 Spend Tokens: Converted allocation for page ${allocation.pageTitle}: ${allocation.tokens} tokens`);
          } else {
            const errorData = await response.json();
            errors.push(`Failed to convert allocation for page ${allocation.pageTitle}: ${errorData.error}`);
          }
        } catch (error) {
          errors.push(`Error converting allocation for page ${allocation.pageTitle}: ${error.message}`);
        }
      }

      if (convertedCount > 0) {
        console.log(`🎯 Spend Tokens: Successfully converted ${convertedCount} simulated allocations to real allocations`);
        // Clear simulated tokens after successful conversion
        clearUserTokens(user.uid);
        // Refresh the data to show the new real allocations
        await fetchData();
      }

      if (errors.length > 0) {
        console.warn('🎯 Spend Tokens: Some allocations failed to convert:', errors);
      }
    } catch (error) {
      console.error('🎯 Spend Tokens: Error converting simulated allocations:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load simulated token balance for users without active subscriptions
  // OR convert simulated allocations to real allocations for users with active subscriptions
  useEffect(() => {
    console.log('🎯 Spend Tokens: Loading simulated balance', {
      hasCurrentAccount: !!user,
      currentAccountUid: user?.uid,
      hasSubscription: !!currentSubscription,
      subscriptionStatus: currentSubscription?.status
    });

    if (user) {
      if (currentSubscription && currentSubscription.status === 'active') {
        // User has active subscription - check if we need to convert simulated allocations
        try {
          const simBalance = getUserTokenBalance(user.uid);
          console.log('🎯 Spend Tokens: Checking for simulated allocations to convert', simBalance);

          if (simBalance.allocations.length > 0) {
            console.log('🎯 Spend Tokens: Found simulated allocations, converting to real allocations');
            convertSimulatedAllocations(simBalance);
          }
        } catch (error) {
          console.warn('Error checking simulated token balance for conversion:', error);
        }
      } else {
        // User doesn't have active subscription - show simulated balance
        try {
          const simBalance = getUserTokenBalance(user.uid);
          console.log('🎯 Spend Tokens: Loaded simulated balance', simBalance);
          setSimulatedTokenBalance(simBalance);
        } catch (error) {
          console.warn('Error loading simulated token balance:', error);
        }
      }
    }
  }, [user, currentSubscription]);

  console.log('🎯 Spend Tokens: Auth check', {
    hasCurrentAccount: !!user,
    shouldShowAuthMessage: !user
  });

  // Add debug display for spend tokens page
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }



  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Spend Tokens</h1>
          <p className="text-muted-foreground">
            Please sign in to manage your token allocation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsPageHeader
        title="Spend Tokens"
        description="Allocate your monthly tokens to support creators"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-8">

      {/* Debug info moved to console */}
      {process.env.NODE_ENV === 'development' && (() => {
        console.log('[SpendTokensPage] Debug Info:', {
          hasCurrentAccount: !!user,
          currentAccountUid: user?.uid,
          loading,
          hasCurrentSubscription: !!currentSubscription,
          currentSubscription,
          hasTokenBalance: !!tokenBalance,
          tokenBalance,
          hasAllocationData: !!allocationData,
          allocationData,
          hasSimulatedTokenBalance: !!simulatedTokenBalance,
          simulatedTokenBalance
        });
        return null;
      })()}

      {loading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Token Allocation Summary - Always show at top */}
          {(() => {
            // Use live allocation data if available, otherwise fall back to initial data
            const currentAllocationData = liveAllocationData || allocationData;
            const actualAllocatedTokens = currentAllocationData?.summary?.totalTokensAllocated || 0;

            // Create enhanced token balance with real-time allocation data
            const enhancedTokenBalance = tokenBalance ? {
              ...tokenBalance,
              allocatedTokens: actualAllocatedTokens,
              availableTokens: tokenBalance.totalTokens - actualAllocatedTokens
            } : null;

            // For users without subscription, show simulated data
            if (!currentSubscription && simulatedTokenBalance) {
              return (
                <TokenAllocationDisplay
                  subscriptionAmount={0} // No subscription = $0
                  tokenBalance={{
                    totalTokens: 0, // No subscription = 0 tokens per month
                    allocatedTokens: simulatedTokenBalance.allocatedTokens,
                    availableTokens: 0 - simulatedTokenBalance.allocatedTokens, // Always negative
                    pendingTokens: 0
                  }}
                  className="mb-6"
                />
              );
            }

            // For users with subscription (any status)
            if (currentSubscription) {
              return (
                <TokenAllocationDisplay
                  subscriptionAmount={currentSubscription.amount}
                  tokenBalance={enhancedTokenBalance}
                  billingCycleEnd={currentSubscription.billingCycleEnd}
                  className="mb-6"
                />
              );
            }

            // Default case - no subscription, no simulated tokens
            return (
              <TokenAllocationDisplay
                subscriptionAmount={0} // No subscription = $0
                tokenBalance={null}
                className="mb-6"
              />
            );
          })()}

          {/* Removed redundant Token Allocation Pie Chart - composition chart in monthly token allocation card above provides the same information */}

          {/* Token Allocation Breakdown - Always show so users can see their allocations */}
          <TokenAllocationBreakdown
            className="mb-6"
            onAllocationUpdate={handleAllocationUpdate}
          />



          {/* Subscription Status Messages */}
          {currentSubscription && currentSubscription.cancelAtPeriodEnd && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border-theme-medium rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-medium text-amber-800 dark:text-amber-200">
                  Subscription Ending Soon
                </h3>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Your subscription ends on {new Date(currentSubscription.billingCycleEnd || '').toLocaleDateString()}.
                You can still allocate tokens until then.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/settings/subscription')}
                className="mt-3 border-theme-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/20"
              >
                Reactivate Subscription
              </Button>
            </div>
          )}

          {!currentSubscription && (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
              <p className="text-muted-foreground mb-4">
                Start a subscription to get monthly tokens and support creators.
              </p>
              <Button
                onClick={() => router.push('/settings/subscription')}
                className="inline-flex items-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Get Subscription
              </Button>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}