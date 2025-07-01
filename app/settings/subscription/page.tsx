'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useFeatureFlag } from '../../utils/feature-flags';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { NAVIGATION_EVENTS } from '../../constants/analytics-events';
import { 
  CheckCircle, 
  CreditCard, 
  AlertTriangle,
  Calendar,
  DollarSign,
  Settings,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import SubscriptionTierCarousel from '../../components/subscription/SubscriptionTierCarousel';
// PaymentFeatureGuard removed
// Define the Subscription interface
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
  createdAt?: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
}

export default function SubscriptionPage() {
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const { toast } = useToast();
  const { trackInteractionEvent } = useWeWriteAnalytics();
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('tier1');
  const [customAmount, setCustomAmount] = useState<number>(10);
  const [previousCustomAmount, setPreviousCustomAmount] = useState<number | null>(null);
  const [showInlineTierSelector, setShowInlineTierSelector] = useState(false);

  // Check payments feature flag
  const paymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  // Helper function to calculate days until cancellation
  const getDaysUntilCancellation = (billingCycleEnd: string) => {
    const endDate = new Date(billingCycleEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Fetch current subscription
  const fetchSubscription = useCallback(async () => {
    if (!currentAccount || !paymentsEnabled) return;

    try {
      const response = await fetch('/api/account-subscription');
      if (response.ok) {
        const data = await response.json();
        setCurrentSubscription(data);

        // Set custom amount from current subscription if it's custom
        if (data && data.amount && data.amount % 5 !== 0) {
          setPreviousCustomAmount(data.amount);
          setCustomAmount(data.amount);
          setSelectedTier('custom');
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [currentAccount, paymentsEnabled]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleTierSelect = (tier: string) => {
    setSelectedTier(tier);
    if (tier !== 'custom' && previousCustomAmount) {
      setCustomAmount(previousCustomAmount);
    }
  };

  const handleSubscribe = async () => {
    if (!currentAccount) {
      router.push('/auth/login');
      return;
    }
    
    try {
      const response = await fetch('/api/subscription/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify({
          tierId: selectedTier,
          customAmount: selectedTier === 'custom' ? customAmount : undefined})});

      const data = await response.json();

      if (data.url) {
        // Track subscription attempt
        trackInteractionEvent(NAVIGATION_EVENTS.BUTTON_CLICKED, {
          button_name: 'subscribe',
          tier_id: selectedTier,
          amount: selectedTier === 'custom' ? customAmount : undefined,
          page_section: 'subscription'
        });
        
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout process. Please try again.",
        variant: "destructive"});
    }
  };

  if (!paymentsEnabled) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Payments Coming Soon</h2>
          <p className="text-muted-foreground">
            Subscription functionality is currently being developed.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/settings" className="inline-flex items-center text-blue-500 hover:text-blue-600 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Link>
          <h1 className="text-3xl font-bold mb-2">Subscription</h1>
          <p className="text-muted-foreground">
            Manage your WeWrite subscription and get monthly tokens to support creators.
          </p>
        </div>

        <div className="space-y-6">
          {/* Current Subscription Status */}
          {currentSubscription && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl font-bold">${currentSubscription.amount}/month</span>
                      <Badge variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                        {currentSubscription.status}
                      </Badge>
                      {currentSubscription.cancelAtPeriodEnd && currentSubscription.billingCycleEnd && (
                        <Badge variant="destructive">
                          {(() => {
                            const daysLeft = getDaysUntilCancellation(currentSubscription.billingCycleEnd);
                            if (daysLeft <= 0) return 'Cancels today';
                            if (daysLeft === 1) return 'Cancels in 1 day';
                            return `Cancels in ${daysLeft} days`;
                          })()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {currentSubscription.billingCycleEnd && !currentSubscription.cancelAtPeriodEnd && (
                        <>Next billing: {new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}</>
                      )}
                      {currentSubscription.cancelAtPeriodEnd && currentSubscription.billingCycleEnd && (
                        <>Subscription ends: {new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowInlineTierSelector(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Change Plan
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subscription Management */}
          {currentSubscription?.status === 'active' && !currentSubscription.cancelAtPeriodEnd ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
              <p className="text-muted-foreground mb-6">
                Your subscription is active and you're receiving tokens monthly.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowInlineTierSelector(true)}
              >
                Change Plan
              </Button>
            </div>
          ) : (
            <div>
              <SubscriptionTierCarousel
                selectedTier={selectedTier}
                onTierSelect={handleTierSelect}
                customAmount={customAmount}
                onCustomAmountChange={setCustomAmount}
                currentSubscription={currentSubscription}
                showCurrentOption={false}
              />

              <div className="text-center mt-8">
                <Button
                  onClick={handleSubscribe}
                  size="lg"
                  className="px-8"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Subscribe Now'}
                </Button>
              </div>
            </div>
          )}

          {/* Inline Tier Selector for Plan Changes */}
          {showInlineTierSelector && currentSubscription && (
            <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Choose Your New Plan</h3>
                <p className="text-sm text-muted-foreground">
                  Select a tier to update your subscription
                </p>
              </div>

              <SubscriptionTierCarousel
                selectedTier={selectedTier}
                onTierSelect={setSelectedTier}
                customAmount={customAmount}
                onCustomAmountChange={setCustomAmount}
                currentSubscription={currentSubscription}
                showCurrentOption={true}
              />

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowInlineTierSelector(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Update Subscription'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}