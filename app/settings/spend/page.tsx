'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import UsdAllocationDisplay from '../../components/payments/UsdAllocationDisplay';
import { UsdAllocationBreakdown } from '../../components/payments/UsdAllocationBreakdown';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Wallet, TrendingUp, Calendar, FileText } from 'lucide-react';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { AllocationIntervalModal } from '../../components/payments/AllocationIntervalModal';
import { UsdAllocation } from '../../types/database';
import Link from 'next/link';
import { getLoggedOutUsdBalance, clearLoggedOutUsd } from '../../utils/simulatedUsd';
import { getAnalyticsService } from '../../utils/analytics-service';
import { SETTINGS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';

export default function SpendPage() {
  const { user } = useAuth();
  const { usdBalance, refreshUsdBalance } = useUsdBalance();
  const { allocationIntervalCents } = useAllocationInterval();
  const [allocations, setAllocations] = useState<UsdAllocation[]>([]);
  const [countdown, setCountdown] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionAmount, setSubscriptionAmount] = useState<number>(0);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [showIntervalModal, setShowIntervalModal] = useState(false);

  // Track page view
  useEffect(() => {
    if (user) {
      const analytics = getAnalyticsService();
      analytics.trackEvent({
        category: EVENT_CATEGORIES.SETTINGS,
        action: SETTINGS_EVENTS.SPEND_PAGE_VIEWED
      });
    }
  }, [user]);

  // Convert simulated USD data to real allocations
  const convertSimulatedUsdData = async () => {
    if (!user?.uid) return;

    try {
      // Check for simulated USD allocations that need to be converted
      const usdBalance = getLoggedOutUsdBalance();
      if (usdBalance.allocations && usdBalance.allocations.length > 0) {
        console.log('🎯 Spend: Converting simulated USD allocations to real allocations');

        for (const allocation of usdBalance.allocations) {
          try {
            const response = await fetch('/api/usd/allocate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pageId: allocation.pageId,
                usdCentsChange: allocation.usdCents
              })
            });

            if (response.ok) {
              console.log(`🎯 Spend: Converted simulated ${allocation.usdCents} cents for page ${allocation.pageTitle}`);
            }
          } catch (error) {
            console.error('Error converting USD allocation:', error);
          }
        }

        // Clear simulated USD data after conversion
        clearLoggedOutUsd();
        console.log('🎯 Spend: Cleared simulated USD data after conversion');
      }
    } catch (error) {
      console.error('Error converting simulated data:', error);
    }
  };

  // Load subscription data function
  const loadSubscription = async () => {
    if (!user?.uid) return;

    try {
      setLoadingSubscription(true);
      const response = await fetch('/api/account-subscription');
      if (response.ok) {
        const data = await response.json();
        console.log('🎯 Spend: Subscription data:', data);
        // Get the actual subscription amount, not the USD balance total
        const isActive = data.status === 'active';
        const amount = isActive ? (data.fullData?.amount || 0) : 0;
        setSubscriptionAmount(amount);
      } else {
        console.error('🎯 Spend: Subscription API error:', response.status, response.statusText);
        setSubscriptionAmount(0);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscriptionAmount(0);
    } finally {
      setLoadingSubscription(false);
    }
  };

  // Load allocations function
  const loadAllocations = async () => {
    if (!user?.uid) return;

    try {
      const response = await fetch('/api/usd/allocations');
      if (response.ok) {
        const data = await response.json();
        console.log('🎯 Spend: API response:', data);
        setAllocations(data.allocations || []);
      } else {
        console.error('🎯 Spend: API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching allocations:', error);
    }
  };

  // Fetch user's allocations and subscription data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        setLoadingSubscription(false);
        return;
      }

      try {
        // First convert any simulated data
        await convertSimulatedUsdData();

        // Load subscription data and allocations in parallel
        await Promise.all([
          loadSubscription(),
          loadAllocations()
        ]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.uid]);

  // Handle allocation editing
  const handleEditAllocation = async (allocation: UsdAllocation) => {
    // This would open an edit modal or navigate to edit page
    console.log('Edit allocation:', allocation);
  };

  // Handle allocation removal
  const handleRemoveAllocation = async (allocation: UsdAllocation) => {
    try {
      const response = await fetch('/api/usd/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: allocation.resourceId,
          usdCentsChange: -allocation.usdCents
        })
      });

      if (response.ok) {
        // Refresh data
        await refreshUsdBalance();
        // Remove from local state
        setAllocations(prev => prev.filter(a => a.id !== allocation.id));
      }
    } catch (error) {
      console.error('Error removing allocation:', error);
    }
  };

  // Handle viewing resource
  const handleViewResource = (allocation: UsdAllocation) => {
    if (allocation.resourceType === 'page') {
      window.open(`/${allocation.resourceId}`, '_blank');
    } else if (allocation.resourceType === 'user') {
      window.open(`/u/${allocation.resourceId}`, '_blank');
    }
  };

  // Handle increasing allocation (optimistic)
  const handleIncreaseAllocation = async (allocation: UsdAllocation) => {
    // Optimistic update - update UI immediately
    setAllocations(prev => prev.map(a =>
      a.id === allocation.id
        ? { ...a, usdCents: a.usdCents + allocationIntervalCents }
        : a
    ));

    // Update USD balance optimistically
    await refreshUsdBalance();

    // Fire and forget API call - don't wait for response or update UI based on it
    try {
      const endpoint = allocation.resourceType === 'user' ? '/api/usd/allocate-user' : '/api/usd/allocate';
      const body = allocation.resourceType === 'user'
        ? { recipientUserId: allocation.resourceId, usdCentsChange: allocationIntervalCents }
        : { pageId: allocation.resourceId, usdCentsChange: allocationIntervalCents };

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).catch(error => {
        console.error('Error increasing allocation (background):', error);
      });
    } catch (error) {
      console.error('Error increasing allocation:', error);
    }
  };

  // Handle decreasing allocation (optimistic)
  const handleDecreaseAllocation = async (allocation: UsdAllocation) => {
    // Don't allow decreasing below 0
    if (allocation.usdCents <= 0) return;

    // Optimistic update - update UI immediately
    setAllocations(prev => prev.map(a =>
      a.id === allocation.id
        ? { ...a, usdCents: Math.max(0, a.usdCents - allocationIntervalCents) }
        : a
    ));

    // Update USD balance optimistically
    await refreshUsdBalance();

    // Fire and forget API call - don't wait for response or update UI based on it
    try {
      const endpoint = allocation.resourceType === 'user' ? '/api/usd/allocate-user' : '/api/usd/allocate';
      const body = allocation.resourceType === 'user'
        ? { recipientUserId: allocation.resourceId, usdCentsChange: -allocationIntervalCents }
        : { pageId: allocation.resourceId, usdCentsChange: -allocationIntervalCents };

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).catch(error => {
        console.error('Error decreasing allocation (background):', error);
      });
    } catch (error) {
      console.error('Error decreasing allocation:', error);
    }
  };

  const handleSetAllocationAmount = async (allocation: UsdAllocation, newAmountCents: number) => {
    const delta = newAmountCents - allocation.usdCents;
    if (delta === 0) return;

    // Optimistic update
    setAllocations(prev => prev.map(a =>
      a.id === allocation.id
        ? { ...a, usdCents: newAmountCents }
        : a
    ));

    await refreshUsdBalance();

    try {
      const endpoint = allocation.resourceType === 'user' ? '/api/usd/allocate-user' : '/api/usd/allocate';
      const body = allocation.resourceType === 'user'
        ? { recipientUserId: allocation.resourceId, usdCentsChange: delta }
        : { pageId: allocation.resourceId, usdCentsChange: delta };

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).catch(error => {
        console.error('Error setting allocation (background):', error);
      });
    } catch (error) {
      console.error('Error setting allocation amount:', error);
    }
  };

  // Update countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const timeUntil = nextMonth.getTime() - now.getTime();

      const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);

      setCountdown(`${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center">
          <p>Please sign in to view your spending.</p>
        </div>
      </div>
    );
  }

  const totalUsdCents = usdBalance?.totalUsdCents || 0;
  const hasBalance = totalUsdCents > 0 || subscriptionAmount > 0;

  if (isLoading || loadingSubscription) {
    return (
      <div className="p-6 lg:p-8">
        <div className="space-y-6 animate-pulse">
          {/* Loading: Overview */}
          <div className="space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>

          {/* Loading: Payment schedule */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-center space-y-2">
              <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
              <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-40 mx-auto"></div>
            </div>
          </div>

          {/* Loading: Breakdown */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                </div>
                <div className="h-2 bg-muted rounded-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="space-y-6">
        {!hasBalance ? (
          /* No funding state */
          <div className="text-center space-y-4 py-8">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">No Account Funding</h3>
              <p className="text-muted-foreground mb-4">
                Set up monthly funding to start supporting creators
              </p>
            </div>
            <Button asChild variant="success">
              <Link href="/settings/fund-account">
                <Wallet className="h-4 w-4 mr-2" />
                Fund Account
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Monthly Overview */}
            <UsdAllocationDisplay
              subscriptionAmount={subscriptionAmount}
              usdBalance={usdBalance}
            />

            {/* Payment Schedule */}
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You have this much time to adjust allocations before they're sent out to writers for the month of{' '}
                    <span className="font-medium text-foreground">
                      {new Date().toLocaleDateString('en-US', { month: 'long' })}
                    </span>
                  </p>
                  <div className="text-2xl font-bold text-primary font-mono">
                    {countdown}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Allocation Breakdown */}
            <UsdAllocationBreakdown
              allocations={allocations}
              totalUsdCents={subscriptionAmount * 100}
              onEditAllocation={handleEditAllocation}
              onRemoveAllocation={handleRemoveAllocation}
              onViewResource={handleViewResource}
              onIncreaseAllocation={handleIncreaseAllocation}
              onDecreaseAllocation={handleDecreaseAllocation}
              onSetAllocationAmount={handleSetAllocationAmount}
              onOpenIntervalModal={() => setShowIntervalModal(true)}
              showSectionHeader={false}
            />
          </>
        )}

        {/* Allocation Interval Modal */}
        <AllocationIntervalModal
          isOpen={showIntervalModal}
          onClose={() => setShowIntervalModal(false)}
        />
      </div>
    </div>
  );
}
