'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import NavPageLayout from '../../components/layout/NavPageLayout';
import UsdAllocationDisplay from '../../components/payments/UsdAllocationDisplay';
import { UsdAllocationBreakdown } from '../../components/payments/UsdAllocationBreakdown';
import { UsdPieChart } from '../../components/ui/UsdPieChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Wallet, TrendingUp, Calendar, Settings } from 'lucide-react';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { UsdAllocation } from '../../types/database';
import Link from 'next/link';
import { getLoggedOutUsdBalance, clearLoggedOutUsd } from '../../utils/simulatedUsd';

export default function SpendPage() {
  const { user } = useAuth();
  const { usdBalance, refreshUsdBalance } = useUsdBalance();
  const [allocations, setAllocations] = useState<UsdAllocation[]>([]);
  const [countdown, setCountdown] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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

  // Fetch user's allocations
  useEffect(() => {
    const fetchAllocations = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        // First convert any simulated data
        await convertSimulatedUsdData();

        // Then load current allocations
        await loadAllocations();
      } catch (error) {
        console.error('Error fetching allocations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocations();
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
      window.open(`/user/${allocation.resourceId}`, '_blank');
    }
  };

  // Handle increasing allocation (optimistic)
  const handleIncreaseAllocation = async (allocation: UsdAllocation) => {
    // Optimistic update - update UI immediately
    setAllocations(prev => prev.map(a =>
      a.id === allocation.id
        ? { ...a, usdCents: a.usdCents + 100 }
        : a
    ));

    // Update USD balance optimistically
    await refreshUsdBalance();

    // Fire and forget API call - don't wait for response or update UI based on it
    try {
      const endpoint = allocation.resourceType === 'user' ? '/api/usd/allocate-user' : '/api/usd/allocate';
      const body = allocation.resourceType === 'user'
        ? { recipientUserId: allocation.resourceId, usdCentsChange: 100 }
        : { pageId: allocation.resourceId, usdCentsChange: 100 };

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
        ? { ...a, usdCents: Math.max(0, a.usdCents - 100) }
        : a
    ));

    // Update USD balance optimistically
    await refreshUsdBalance();

    // Fire and forget API call - don't wait for response or update UI based on it
    try {
      const endpoint = allocation.resourceType === 'user' ? '/api/usd/allocate-user' : '/api/usd/allocate';
      const body = allocation.resourceType === 'user'
        ? { recipientUserId: allocation.resourceId, usdCentsChange: -100 }
        : { pageId: allocation.resourceId, usdCentsChange: -100 };

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
  const hasBalance = totalUsdCents > 0;

  return (
    <NavPageLayout
      backUrl="/settings"
      maxWidth="6xl"
      loading={isLoading}
      loadingFallback={
        <div className="space-y-6">
          {/* Loading state for allocation display */}
          <Card>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-20 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>

          {/* Loading state for countdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Next payment
              </CardTitle>
              <CardDescription>
                Loading payment information...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
                  <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
                </div>
                <div className="h-4 bg-muted rounded w-64 mx-auto"></div>
              </div>
            </CardContent>
          </Card>

          {/* Loading state for breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Breakdown</CardTitle>
              <CardDescription>
                Loading your allocations...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                      <div className="h-4 bg-muted rounded w-16"></div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="h-7 w-7 bg-muted rounded"></div>
                        <div className="h-7 w-7 bg-muted rounded"></div>
                      </div>
                      <div className="flex-1 h-2 bg-muted rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >

      <div className="space-y-6">
        {!hasBalance ? (
          /* No funding state */
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">No Account Funding</h3>
                  <p className="text-muted-foreground mb-4">
                    Set up monthly funding to start supporting creators
                  </p>
                </div>
                <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
                  <Link href="/settings/fund-account">
                    <Wallet className="h-4 w-4 mr-2" />
                    Fund Account
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Simplified allocation display */}
            <UsdAllocationDisplay
              subscriptionAmount={totalUsdCents / 100}
              usdBalance={usdBalance}
            />

            {/* Next payment countdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Next payment
                </CardTitle>
                <CardDescription>
                  Time remaining to adjust allocations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-primary font-mono">
                      {countdown}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      to make adjustments
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Allocations will be sent to creators for the month of{' '}
                    <span className="font-medium">
                      {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Detailed breakdown */}
            <UsdAllocationBreakdown
              allocations={allocations}
              totalUsdCents={totalUsdCents}
              onEditAllocation={handleEditAllocation}
              onRemoveAllocation={handleRemoveAllocation}
              onViewResource={handleViewResource}
              onIncreaseAllocation={handleIncreaseAllocation}
              onDecreaseAllocation={handleDecreaseAllocation}
            />


          </>
        )}

        {/* Help section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              How Monthly Distribution Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Monthly Processing:</strong> At the end of each month, your allocated funds 
                are distributed directly to creators.
              </p>
              <p>
                <strong>Flexible Allocations:</strong> You can modify your allocations anytime 
                before the monthly processing date.
              </p>
              <p>
                <strong>Unallocated Funds:</strong> Any unallocated funds go to supporting the 
                WeWrite platform and infrastructure.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </NavPageLayout>
  );
}
