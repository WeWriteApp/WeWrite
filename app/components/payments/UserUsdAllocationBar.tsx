"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';
import { Plus, Minus, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatUsdCents, dollarsToCents } from '../../utils/formatCurrency';
import { USD_UI_TEXT } from '../../utils/usdConstants';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { UsdAllocationModal } from './UsdAllocationModal';
import { AllocationAmountDisplay } from './AllocationAmountDisplay';
import { toast } from '../ui/use-toast';

interface UserUsdAllocationBarProps {
  recipientUserId: string;
  username: string;
  visible?: boolean;
  className?: string;
}

export function UserUsdAllocationBar({
  recipientUserId,
  username,
  visible = true,
  className
}: UserUsdAllocationBarProps) {
  const { user } = useAuth();
  const { usdBalance, refreshUsdBalance, updateOptimisticBalance } = useUsdBalance();
  
  const [currentUsdAllocation, setCurrentUsdAllocation] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Don't render if user is trying to allocate to themselves
  if (user?.uid === recipientUserId) {
    return null;
  }

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // Fetch current user allocation
  useEffect(() => {
    const fetchCurrentAllocation = async () => {
      if (!user?.uid || !recipientUserId) return;

      try {
        const response = await fetch(`/api/usd/allocate-user?recipientUserId=${recipientUserId}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentUsdAllocation(data.currentAllocation || 0);
        }
      } catch (error) {
        console.error('Error fetching current user USD allocation:', error);
      }
    };

    fetchCurrentAllocation();
  }, [user?.uid, recipientUserId]);

  // Handle USD allocation to user
  const handleUsdAllocation = async (usdCentsChange: number) => {
    if (!user?.uid || !recipientUserId) return;

    setIsLoading(true);

    try {
      // Optimistic update
      updateOptimisticBalance(usdCentsChange);
      setCurrentUsdAllocation(prev => Math.max(0, prev + usdCentsChange));

      // API call
      const response = await fetch('/api/usd/allocate-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUserId,
          usdCentsChange
        })
      });

      if (!response.ok) {
        throw new Error('Failed to allocate USD to user');
      }

      const data = await response.json();
      setCurrentUsdAllocation(data.currentUserAllocation || 0);

      // Refresh balance to get accurate data
      await refreshUsdBalance();

      // Show success notification
      toast({
        title: `${formatUsdCents(Math.abs(usdCentsChange))} allocated to ${username}!`,
        description: "Funds will be distributed at the end of the month",
        duration: 3000,
      });

    } catch (error) {
      console.error('Error allocating USD to user:', error);
      
      // Revert optimistic update
      updateOptimisticBalance(-usdCentsChange);
      setCurrentUsdAllocation(prev => Math.max(0, prev - usdCentsChange));

      toast({
        title: "Allocation Failed",
        description: "Unable to allocate funds to user. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle allocation change from modal
  const handleAllocationChange = async (newAllocationCents: number) => {
    const currentCents = currentUsdAllocation;
    const changeCents = newAllocationCents - currentCents;
    
    await handleUsdAllocation(changeCents);
  };

  const hasBalance = usdBalance && usdBalance.totalUsdCents > 0;
  const availableUsdCents = usdBalance?.availableUsdCents || 0;

  // Quick allocation amounts in cents - use multiples of the current interval
  const { allocationIntervalCents } = useAllocationInterval();
  const quickAmounts = [
    allocationIntervalCents,           // 1x interval (e.g., $0.50)
    allocationIntervalCents * 2,       // 2x interval (e.g., $1.00)
    allocationIntervalCents * 4,       // 4x interval (e.g., $2.00)
    allocationIntervalCents * 10       // 10x interval (e.g., $5.00)
  ];

  return (
    <>
      <div className={cn(
        "bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-3",
        className
      )}>
        {/* Header */}
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Support {username}</span>
        </div>

        {/* Allocation amount display */}
        <AllocationAmountDisplay
          allocationCents={currentUsdAllocation}
          availableBalanceCents={usdBalance?.availableUsdCents || 0}
          variant="user"
          className="py-1"
        />

        {/* Allocation controls */}
        {user?.uid ? (
          hasBalance ? (
            <div className="space-y-3">
              {/* Quick amount buttons */}
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((cents) => (
                  <Button
                    key={cents}
                    variant="outline"
                    size="sm"
                    onClick={() => handleUsdAllocation(cents)}
                    disabled={isLoading || cents > availableUsdCents}
                    className="h-8 px-3 text-xs"
                  >
                    +{formatUsdCents(cents)}
                  </Button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {currentUsdAllocation > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUsdAllocation(-Math.min(currentUsdAllocation, 25))}
                      disabled={isLoading}
                      className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  disabled={isLoading}
                  className="h-8 px-3 text-xs"
                >
                  Customize
                </Button>
              </div>

              {/* Available balance */}
              <div className="text-xs text-muted-foreground text-center">
                Available: <span className={availableUsdCents <= 0 ? 'text-orange-600 font-medium' : ''}>
                  {availableUsdCents <= 0 ? 'Out' : formatUsdCents(availableUsdCents)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {USD_UI_TEXT.NO_BALANCE_MESSAGE}
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => window.location.href = '/settings/fund-account'}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {USD_UI_TEXT.FUND_ACCOUNT}
              </Button>
            </div>
          )
        ) : (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Sign in to support {username}
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => window.location.href = '/login'}
            >
              Sign In
            </Button>
          </div>
        )}

        {/* USD info tooltip */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
          <p>{USD_UI_TEXT.TOOLTIP_TEXT}</p>
        </div>
      </div>

      {/* Allocation Modal */}
      <UsdAllocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        pageId={recipientUserId}
        pageTitle={`@${username}`}
        authorId={recipientUserId}
        currentAllocation={currentUsdAllocation}
        onAllocationChange={handleAllocationChange}
        isUserAllocation={true}
        username={username}
      />
    </>
  );
}
