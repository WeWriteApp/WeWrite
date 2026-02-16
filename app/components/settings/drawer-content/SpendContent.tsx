'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../../providers/AuthProvider';
import UsdAllocationDisplay from '../../payments/UsdAllocationDisplay';
import { UsdAllocationBreakdown } from '../../payments/UsdAllocationBreakdown';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { useUsdBalance } from '../../../contexts/UsdBalanceContext';
import { useAllocationInterval } from '../../../contexts/AllocationIntervalContext';
import { AllocationIntervalModal } from '../../payments/AllocationIntervalModal';
import { UsdAllocation } from '../../../types/database';
import Link from 'next/link';
import { RollingCounter } from '../../ui/rolling-counter';
import { toast } from '../../ui/use-toast';

interface SpendContentProps {
  onClose: () => void;
}

export default function SpendContent({ onClose }: SpendContentProps) {
  const { user } = useAuth();
  const { usdBalance, refreshUsdBalance } = useUsdBalance();
  const { allocationIntervalCents } = useAllocationInterval();
  const [allocations, setAllocations] = useState<UsdAllocation[]>([]);
  const [countdownValues, setCountdownValues] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionAmount, setSubscriptionAmount] = useState<number>(0);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [showIntervalModal, setShowIntervalModal] = useState(false);

  const loadSubscription = async () => {
    if (!user?.uid) return;

    try {
      setLoadingSubscription(true);
      const response = await fetch('/api/account-subscription');
      if (response.ok) {
        const data = await response.json();
        const isActive = data.status === 'active';
        const amount = isActive ? (data.fullData?.amount || 0) : 0;
        setSubscriptionAmount(amount);
      } else {
        setSubscriptionAmount(0);
      }
    } catch (error) {
      setSubscriptionAmount(0);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const loadAllocations = async () => {
    if (!user?.uid) return;

    try {
      const response = await fetch('/api/usd/allocations');
      if (response.ok) {
        const data = await response.json();
        setAllocations(data.allocations || []);
      }
    } catch (error) {
      console.error('Error fetching allocations:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        setLoadingSubscription(false);
        return;
      }

      try {
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
        await refreshUsdBalance();
        setAllocations(prev => prev.filter(a => a.id !== allocation.id));
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Remove failed (${response.status})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error removing allocation:', error);
      toast.error("Failed to remove allocation", {
        description: msg,
        enableCopy: true,
        copyText: `Remove allocation error: ${msg}\nResource: ${allocation.resourceId}\nTime: ${new Date().toISOString()}`
      });
    }
  };

  const handleViewResource = (allocation: UsdAllocation) => {
    if (allocation.resourceType === 'page') {
      window.open(`/${allocation.resourceId}`, '_blank');
    } else if (allocation.resourceType === 'user') {
      window.open(`/u/${allocation.resourceId}`, '_blank');
    }
  };

  const handleIncreaseAllocation = async (allocation: UsdAllocation) => {
    setAllocations(prev => prev.map(a =>
      a.id === allocation.id
        ? { ...a, usdCents: a.usdCents + allocationIntervalCents }
        : a
    ));

    await refreshUsdBalance();

    try {
      const endpoint = allocation.resourceType === 'user' ? '/api/usd/allocate-user' : '/api/usd/allocate';
      const body = allocation.resourceType === 'user'
        ? { recipientUserId: allocation.resourceId, usdCentsChange: allocationIntervalCents }
        : { pageId: allocation.resourceId, usdCentsChange: allocationIntervalCents };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Increase failed (${res.status})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error increasing allocation:', error);
      // Rollback optimistic update
      setAllocations(prev => prev.map(a =>
        a.id === allocation.id
          ? { ...a, usdCents: a.usdCents - allocationIntervalCents }
          : a
      ));
      toast.error("Failed to increase allocation", {
        description: msg,
        enableCopy: true,
        copyText: `Increase allocation error: ${msg}\nResource: ${allocation.resourceId}\nTime: ${new Date().toISOString()}`
      });
    }
  };

  const handleDecreaseAllocation = async (allocation: UsdAllocation) => {
    if (allocation.usdCents <= 0) return;

    const previousCents = allocation.usdCents;
    setAllocations(prev => prev.map(a =>
      a.id === allocation.id
        ? { ...a, usdCents: Math.max(0, a.usdCents - allocationIntervalCents) }
        : a
    ));

    await refreshUsdBalance();

    try {
      const endpoint = allocation.resourceType === 'user' ? '/api/usd/allocate-user' : '/api/usd/allocate';
      const body = allocation.resourceType === 'user'
        ? { recipientUserId: allocation.resourceId, usdCentsChange: -allocationIntervalCents }
        : { pageId: allocation.resourceId, usdCentsChange: -allocationIntervalCents };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Decrease failed (${res.status})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error decreasing allocation:', error);
      // Rollback optimistic update
      setAllocations(prev => prev.map(a =>
        a.id === allocation.id ? { ...a, usdCents: previousCents } : a
      ));
      toast.error("Failed to decrease allocation", {
        description: msg,
        enableCopy: true,
        copyText: `Decrease allocation error: ${msg}\nResource: ${allocation.resourceId}\nTime: ${new Date().toISOString()}`
      });
    }
  };

  const handleSetAllocationAmount = async (allocation: UsdAllocation, newAmountCents: number) => {
    const delta = newAmountCents - allocation.usdCents;
    if (delta === 0) return;

    const previousCents = allocation.usdCents;
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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Set amount failed (${res.status})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error setting allocation amount:', error);
      // Rollback optimistic update
      setAllocations(prev => prev.map(a =>
        a.id === allocation.id ? { ...a, usdCents: previousCents } : a
      ));
      toast.error("Failed to update allocation", {
        description: msg,
        enableCopy: true,
        copyText: `Set allocation error: ${msg}\nResource: ${allocation.resourceId}\nTime: ${new Date().toISOString()}`
      });
    }
  };

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const timeUntil = nextMonth.getTime() - now.getTime();

      const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);

      setCountdownValues({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!user) {
    return (
      <div className="px-4 pb-6 text-center">
        <p>Please sign in to view your spending.</p>
      </div>
    );
  }

  const totalUsdCents = usdBalance?.totalUsdCents || 0;
  const hasBalance = totalUsdCents > 0 || subscriptionAmount > 0;

  if (isLoading || loadingSubscription) {
    return (
      <div className="px-4 pb-6">
        <div className="space-y-6 animate-pulse">
          <div className="space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="text-center space-y-2">
              <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
              <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      <div className="space-y-6">
        {!hasBalance ? (
          <div className="text-center space-y-4 py-8">
            <Icon name="Wallet" size={48} className="mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">No Account Funding</h3>
              <p className="text-muted-foreground mb-4">
                Set up monthly funding to start supporting creators
              </p>
            </div>
            <Button asChild variant="success">
              <Link href="/settings/fund-account">
                <Icon name="Wallet" size={16} className="mr-2" />
                Fund Account
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <UsdAllocationDisplay
              subscriptionAmount={subscriptionAmount}
              usdBalance={usdBalance}
            />

            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Time to adjust allocations before they're sent to writers for{' '}
                    <span className="font-medium text-foreground">
                      {new Date().toLocaleDateString('en-US', { month: 'long' })}
                    </span>
                  </p>
                  <div className="flex items-center justify-center gap-4 text-2xl font-bold font-mono">
                    <div className="flex flex-col items-center">
                      <RollingCounter
                        value={countdownValues.days}
                        className="text-primary"
                        formatWithCommas={false}
                        duration={300}
                      />
                      <span className="text-xs text-muted-foreground font-normal">days</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <RollingCounter
                        value={countdownValues.hours}
                        className="text-primary"
                        formatWithCommas={false}
                        duration={300}
                      />
                      <span className="text-xs text-muted-foreground font-normal">hrs</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <RollingCounter
                        value={countdownValues.minutes}
                        className="text-primary"
                        formatWithCommas={false}
                        duration={300}
                      />
                      <span className="text-xs text-muted-foreground font-normal">min</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <RollingCounter
                        value={countdownValues.seconds}
                        className="text-primary"
                        formatWithCommas={false}
                        duration={300}
                      />
                      <span className="text-xs text-muted-foreground font-normal">sec</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <UsdAllocationBreakdown
              allocations={allocations}
              totalUsdCents={subscriptionAmount * 100}
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

        <AllocationIntervalModal
          isOpen={showIntervalModal}
          onClose={() => setShowIntervalModal(false)}
        />
      </div>
    </div>
  );
}
