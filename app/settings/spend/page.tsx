'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { NavHeader } from '../../components/layout/NavHeader';
import { UsdAllocationDisplay } from '../../components/payments/UsdAllocationDisplay';
import { UsdAllocationBreakdown } from '../../components/payments/UsdAllocationBreakdown';
import { UsdPieChart } from '../../components/ui/UsdPieChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Wallet, TrendingUp, Calendar, Settings } from 'lucide-react';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { UsdAllocation } from '../../types/database';
import Link from 'next/link';

export default function SpendPage() {
  const { user } = useAuth();
  const { usdBalance, refreshUsdBalance } = useUsdBalance();
  const [allocations, setAllocations] = useState<UsdAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's allocations
  useEffect(() => {
    const fetchAllocations = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/usd/balance');
        if (response.ok) {
          const data = await response.json();
          setAllocations(data.allocations || []);
        }
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
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <NavHeader
        title="Manage Spending"
      />

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
            {/* Overview section */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Allocation display */}
              <div className="lg:col-span-2">
                <UsdAllocationDisplay
                  subscriptionAmount={totalUsdCents / 100}
                  usdBalance={usdBalance}
                />
              </div>

              {/* Pie chart */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Allocation Overview</CardTitle>
                    <CardDescription>
                      Visual breakdown of your monthly funding
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UsdPieChart
                      allocations={allocations}
                      totalUsdCents={totalUsdCents}
                      size={200}
                      showLabels={false}
                      onSegmentClick={handleViewResource}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Detailed breakdown */}
            <UsdAllocationBreakdown
              allocations={allocations}
              totalUsdCents={totalUsdCents}
              onEditAllocation={handleEditAllocation}
              onRemoveAllocation={handleRemoveAllocation}
              onViewResource={handleViewResource}
            />

            {/* Monthly insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Monthly Insights
                </CardTitle>
                <CardDescription>
                  Your funding activity this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {allocations.length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Creators Supported
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-green-600">
                      {usdBalance ? Math.round((usdBalance.allocatedUsdCents / totalUsdCents) * 100) : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Funds Allocated
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-blue-600">
                      {new Date().toLocaleDateString('en-US', { day: 'numeric' })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Days Until Distribution
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="flex-1">
                <Link href="/">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Discover More Creators
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="flex-1">
                <Link href="/settings/fund-account">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Funding
                </Link>
              </Button>
            </div>
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
    </div>
  );
}
