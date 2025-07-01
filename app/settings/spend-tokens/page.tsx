'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Button } from '../../components/ui/button';
import TokenAllocationDisplay from '../../components/subscription/TokenAllocationDisplay';
import TokenAllocationBreakdown from '../../components/subscription/TokenAllocationBreakdown';
import AllocationCountdownTimer from '../../components/AllocationCountdownTimer';
import StartOfMonthExplainer from '../../components/StartOfMonthExplainer';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { NAVIGATION_EVENTS } from '../../constants/analytics-events';
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
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const { trackInteractionEvent } = useWeWriteAnalytics();

  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [loading, setLoading] = useState(true);

  // Check payments feature flag
  const paymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  // Track page view
  useEffect(() => {
    trackInteractionEvent(NAVIGATION_EVENTS.PAGE_VIEWED, {
      page_name: 'spend_tokens',
      page_section: 'settings',
      feature_context: 'payments'
    });
  }, [trackInteractionEvent]);

  // Fetch current subscription and token balance
  const fetchData = useCallback(async () => {
    if (!currentAccount || !paymentsEnabled) return;

    try {
      // Fetch subscription
      const subscriptionResponse = await fetch('/api/account-subscription');
      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        setCurrentSubscription(subscriptionData);
      }

      // Fetch token balance
      const tokenResponse = await fetch('/api/tokens/balance');
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        setTokenBalance(tokenData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentAccount, paymentsEnabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!currentAccount || !paymentsEnabled) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Spend Tokens</h1>
          <p className="text-muted-foreground">
            {!currentAccount ? 'Please sign in to manage your token allocation.' : 'Payments are not available at this time.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Mobile Header */}
      <div className="lg:hidden mb-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
            className="mr-3"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Spend Tokens</h1>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block mb-8">
        <h1 className="text-3xl font-bold mb-2">Spend Tokens</h1>
        <p className="text-muted-foreground">
          Allocate your monthly tokens to support your favorite creators
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Active Subscription Content */}
          {currentSubscription && currentSubscription.status === 'active' ? (
            <>
              {/* Allocation Countdown Timer */}
              <AllocationCountdownTimer className="mb-6" showExplanation={false} />

              {/* Token Allocation Display */}
              <TokenAllocationDisplay
                subscriptionAmount={currentSubscription.amount}
                tokenBalance={tokenBalance}
                billingCycleEnd={currentSubscription.billingCycleEnd}
                className="mb-6"
              />

              {/* Token Allocation Breakdown */}
              <TokenAllocationBreakdown className="mb-6" />

              {/* Start-of-Month Processing Explanation */}
              <StartOfMonthExplainer variant="compact" className="mb-6" />
            </>
          ) : currentSubscription && (currentSubscription.status === 'incomplete' || currentSubscription.status === 'pending') ? (
            <>
              {/* Preview for pending subscriptions */}
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Token Allocation Preview</h3>
                <p className="text-muted-foreground mb-6">
                  Your token allocation will be available once your payment is confirmed.
                </p>
              </div>

              <TokenAllocationDisplay
                subscriptionAmount={currentSubscription.amount}
                tokenBalance={null} // No actual balance yet
                billingCycleEnd={currentSubscription.billingCycleEnd}
                className="opacity-75 mb-6"
              />

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  ⏳ Preview of your token allocation once payment is confirmed
                </p>
              </div>

              {/* Start-of-Month Processing Explanation */}
              <StartOfMonthExplainer variant="compact" className="mt-6" />
            </>
          ) : currentSubscription && currentSubscription.cancelAtPeriodEnd ? (
            <>
              {/* Cancelled subscription - still show allocation until period end */}
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-medium text-amber-800 dark:text-amber-200">
                    Subscription Ending Soon
                  </h3>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Your subscription will end on {new Date(currentSubscription.billingCycleEnd || '').toLocaleDateString()}.
                  You can still allocate tokens until then.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/settings/subscription')}
                  className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
                >
                  Reactivate Subscription
                </Button>
              </div>

              {/* Show current allocation */}
              <TokenAllocationDisplay
                subscriptionAmount={currentSubscription.amount}
                tokenBalance={tokenBalance}
                billingCycleEnd={currentSubscription.billingCycleEnd}
                className="mb-6"
              />

              <TokenAllocationBreakdown className="mb-6" />
              <StartOfMonthExplainer variant="compact" className="mb-6" />
            </>
          ) : (
            <>
              {/* No subscription state */}
              <div className="text-center py-12">
                <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Active Subscription</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  You need an active subscription to allocate tokens to creators. 
                  Start a subscription to get monthly tokens.
                </p>
                <Button
                  onClick={() => router.push('/settings/subscription')}
                  className="inline-flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Get Subscription
                </Button>
              </div>

              {/* Show explanation even without subscription */}
              <StartOfMonthExplainer variant="compact" className="mt-8" />
            </>
          )}
        </div>
      )}
    </div>
  );
}