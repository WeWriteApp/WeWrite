"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Heart, Plus, Minus, X } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { TokenAllocationModal } from './TokenAllocationModal';
import { useTokenIncrement } from '../../contexts/TokenIncrementContext';
import { TokenParticleEffect } from '../effects/TokenParticleEffect';
import { useTokenParticleEffect } from '../../hooks/useTokenParticleEffect';
import { getNextMonthlyProcessingDate } from '../../utils/subscriptionTiers';

interface UserPledgeBarProps {
  userId: string;
  username: string;
  visible?: boolean;
  className?: string;
}

interface TokenData {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
  currentUserAllocation: number;
}

const UserPledgeBar = React.forwardRef<HTMLDivElement, UserPledgeBarProps>(({
  userId,
  username,
  visible = true,
  className,
}, ref) => {
  const { user } = useAuth();
  const router = useRouter();
  const { incrementAmount } = useTokenIncrement();
  const { triggerEffect, originElement, triggerParticleEffect, resetEffect } = useTokenParticleEffect();

  const [tokenData, setTokenData] = useState<TokenData>({
    totalTokens: 0,
    allocatedTokens: 0,
    availableTokens: 0,
    currentUserAllocation: 0
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHidden, setIsHidden] = useState(false);

  // Don't show pledge bar for own profile or if not logged in
  const shouldShow = user && user.uid !== userId && visible;

  // Function to show token allocation notification
  const showTokenAllocationNotification = (tokenAmount: number) => {
    const nextProcessingDate = getNextMonthlyProcessingDate();
    const formattedDate = nextProcessingDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });

    toast({
      title: `${tokenAmount} tokens allocated to ${username}!`,
      description: `Your tokens will be processed on ${formattedDate}`,
      duration: 4000,
    });
  };

  // Fetch token data
  const fetchTokenData = useCallback(async () => {
    if (!user || !shouldShow) return;

    try {
      setIsLoading(true);

      // Get user's token balance
      const balanceResponse = await fetch('/api/tokens/balance');
      const balanceData = await balanceResponse.json();

      // Get current allocation to this user
      const allocationResponse = await fetch(`/api/tokens/allocate-user?recipientUserId=${userId}`);
      const allocationData = await allocationResponse.json();

      setTokenData({
        totalTokens: balanceData.totalTokens || 0,
        allocatedTokens: balanceData.allocatedTokens || 0,
        availableTokens: balanceData.availableTokens || 0,
        currentUserAllocation: allocationData.currentAllocation || 0
      });
    } catch (error) {
      console.error('Error fetching token data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, userId, shouldShow]);

  useEffect(() => {
    fetchTokenData();
  }, [fetchTokenData]);

  // Handle token allocation changes
  const handleTokenChange = async (change: number) => {
    if (!user || !shouldShow) return;

    try {
      const newAllocation = Math.max(0, tokenData.currentUserAllocation + change);

      const response = await fetch('/api/tokens/allocate-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientUserId: userId,
          tokens: newAllocation
        })
      });

      if (response.ok) {
        // Update local state
        setTokenData(prev => ({
          ...prev,
          currentUserAllocation: newAllocation,
          availableTokens: prev.availableTokens - change,
          allocatedTokens: prev.allocatedTokens + change
        }));

        // Show notification for positive changes
        if (change > 0) {
          showTokenAllocationNotification(Math.abs(change));
          triggerParticleEffect();
        }

        // Close modal
        setIsModalOpen(false);
      } else {
        const errorData = await response.json();
        toast({
          title: "Allocation Failed",
          description: errorData.error || "Failed to allocate tokens",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error allocating tokens:', error);
      toast({
        title: "Error",
        description: "Failed to allocate tokens. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle pledge bar click
  const handlePledgeBarClick = () => {
    if (!user) {
      router.push('/');
    } else if (tokenData.availableTokens <= 0) {
      router.push('/settings/spend-tokens');
    } else {
      setIsModalOpen(true);
    }
  };

  // Don't render if shouldn't show
  if (!shouldShow || isHidden) {
    return null;
  }

  const isOutOfTokens = tokenData.availableTokens <= 0;
  const hasAllocation = tokenData.currentUserAllocation > 0;

  return createPortal(
    <div
      className={cn(
        "fixed left-0 right-0 bottom-6 z-50 flex justify-center px-4",
        "transition-transform duration-300 ease-in-out",
        "translate-y-0"
      )}
    >
      <div
        ref={ref}
        className={cn(
          "relative w-full max-w-md shadow-2xl overflow-hidden rounded-2xl",
          "bg-background/90 backdrop-blur-xl border border-white/20",
          className
        )}
        data-user-pledge-bar
        onClick={handlePledgeBarClick}
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsHidden(true);
          }}
          className="absolute top-2 right-2 z-10 p-1 rounded-full bg-background/50 hover:bg-background/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Main Content */}
        <div className="space-y-4 p-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              <span className="font-medium">Support {username}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {tokenData.availableTokens} tokens available
            </div>
          </div>

          {/* Current allocation display */}
          {hasAllocation && (
            <div className="text-center py-2">
              <div className="text-2xl font-bold text-primary">
                {tokenData.currentUserAllocation}
              </div>
              <div className="text-sm text-muted-foreground">
                tokens allocated this month
              </div>
            </div>
          )}

          {/* Quick action buttons */}
          {!isOutOfTokens && (
            <div className="flex gap-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTokenChange(incrementAmount);
                }}
                disabled={tokenData.availableTokens < incrementAmount}
              >
                <Plus className="h-4 w-4 mr-1" />
                {incrementAmount}
              </Button>
              {hasAllocation && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTokenChange(-Math.min(incrementAmount, tokenData.currentUserAllocation));
                  }}
                >
                  <Minus className="h-4 w-4 mr-1" />
                  {Math.min(incrementAmount, tokenData.currentUserAllocation)}
                </Button>
              )}
            </div>
          )}

          {/* Out of tokens state */}
          {isOutOfTokens && (
            <div className="text-center py-2">
              <div className="text-orange-500 font-medium mb-2">
                Out of tokens
              </div>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/settings/spend-tokens');
                }}
              >
                Get More Tokens
              </Button>
            </div>
          )}
        </div>

        {/* Token Particle Effect */}
        <TokenParticleEffect
          isActive={triggerEffect}
          originElement={originElement}
          onComplete={resetEffect}
        />
      </div>

      {/* Token Allocation Modal */}
      {isModalOpen && (
        <TokenAllocationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          tokenData={{
            totalTokens: tokenData.totalTokens,
            allocatedTokens: tokenData.allocatedTokens,
            availableTokens: tokenData.availableTokens,
            currentPageAllocation: tokenData.currentUserAllocation
          }}
          pageTitle={`${username}'s profile`}
          pageId={userId}
          authorId={userId}
          onTokenChange={handleTokenChange}
          isPageOwner={false}
        />
      )}
    </div>,
    document.body
  );
});

UserPledgeBar.displayName = 'UserPledgeBar';

export default UserPledgeBar;
