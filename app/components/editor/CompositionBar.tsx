import React, { useState, useEffect, useRef, useCallback } from 'react';
import ActionModal from '../utils/ActionModal';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
import './ui/tooltip.css';

interface Pledge {
  id: string;
  pageId: string;
  title?: string;
  amount: number;
}

interface OtherPledge {
  id: string;
  pageId: string;
  title: string;
  amount: number;
}

interface CompositionBarProps {
  value?: number;
  max: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  pledges: Pledge[];
  subscriptionAmount: number;
  onPledgeChange?: (pledgeId: string, change: number) => void;
  onPledgeCustomAmount?: (pledgeId: string) => void;
  onDeletePledge?: (pledgeId: string) => void;
  showTitle?: boolean;
  showRemoveButton?: boolean;
  className?: string;
}

const CompositionBar: React.FC<CompositionBarProps> = ({
  value,
  max,
  onChange,
  disabled = false,
  pledges,
  subscriptionAmount,
  onPledgeChange,
  onPledgeCustomAmount,
  onDeletePledge,
  showTitle = false,
  showRemoveButton = false,
  className
}) => {
  const [showSubscriptionLimitModal, setShowSubscriptionLimitModal] = useState<boolean>(false);
  const [activePledgeId, setActivePledgeId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Optimistic updates state
  const [optimisticAmounts, setOptimisticAmounts] = useState<Record<string, number>>({});
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<string, string>>({});

  // Debounce refs
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingChanges = useRef<Record<string, number>>({});

  // Ensure component is mounted before rendering portals
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Debounced database update function
  const debouncedUpdatePledge = useCallback(async (pledgeId: string, totalChange: number) => {
    setPendingUpdates(prev => ({ ...prev, [pledgeId]: true }));
    setErrorStates(prev => ({ ...prev, [pledgeId]: '' }));

    try {
      const response = await fetch('/api/tokens/pledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId: pledgeId,
          tokenChange: totalChange
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update pledge');
      }

      const result = await response.json();

      if (result.success) {
        // Clear optimistic state on successful update
        setOptimisticAmounts(prev => {
          const newState = { ...prev };
          delete newState[pledgeId];
          return newState;
        });

        // Call the parent's onPledgeChange to refresh data if needed
        if (onPledgeChange) {
          onPledgeChange(pledgeId, 0); // 0 change to trigger refresh
        }
      } else {
        throw new Error(result.error || 'Failed to update pledge');
      }
    } catch (error) {
      console.error('Error updating pledge:', error);

      // Revert optimistic update on error
      setOptimisticAmounts(prev => {
        const newState = { ...prev };
        delete newState[pledgeId];
        return newState;
      });

      setErrorStates(prev => ({
        ...prev,
        [pledgeId]: error instanceof Error ? error.message : 'Update failed'
      }));

      // Clear error after 3 seconds
      setTimeout(() => {
        setErrorStates(prev => ({ ...prev, [pledgeId]: '' }));
      }, 3000);
    } finally {
      setPendingUpdates(prev => ({ ...prev, [pledgeId]: false }));
      // Clear pending changes for this pledge
      delete pendingChanges.current[pledgeId];
    }
  }, [onPledgeChange]);

  // Handle optimistic pledge change with debouncing
  const handleOptimisticPledgeChange = useCallback((pledgeId: string, change: number) => {
    // Update optimistic state immediately
    setOptimisticAmounts(prev => {
      const currentOptimistic = prev[pledgeId] || 0;
      const pledge = pledges.find(p => p.id === pledgeId);
      const currentAmount = pledge ? pledge.amount : 0;
      const newOptimisticAmount = Math.max(0, currentAmount + currentOptimistic + change);
      const newOptimisticChange = newOptimisticAmount - currentAmount;

      return { ...prev, [pledgeId]: newOptimisticChange };
    });

    // Accumulate pending changes
    pendingChanges.current[pledgeId] = (pendingChanges.current[pledgeId] || 0) + change;

    // Clear existing timer
    if (debounceTimers.current[pledgeId]) {
      clearTimeout(debounceTimers.current[pledgeId]);
    }

    // Set new debounced timer (700ms)
    debounceTimers.current[pledgeId] = setTimeout(() => {
      const totalChange = pendingChanges.current[pledgeId];
      if (totalChange !== 0) {
        debouncedUpdatePledge(pledgeId, totalChange);
      }
      delete debounceTimers.current[pledgeId];
    }, 700);
  }, [pledges, debouncedUpdatePledge]);

  // Handle safer percentage calculations to avoid NaN
  const calculatePercentage = (amount: number, total: number): number => {
    if (!total || total <= 0 || isNaN(amount) || amount <= 0) return 0;
    const safeAmount = Math.round(Number(amount) * 100) / 100; // Round to 2 decimal places
    const percentage = Math.min(100, (safeAmount / total) * 100);
    return percentage;
  };

  // Check if total spending exceeds subscription amount (including optimistic changes)
  const totalSpending = pledges.reduce((acc, pledge) => {
    const baseAmount = Number(pledge.amount) || 0;
    const optimisticChange = optimisticAmounts[pledge.id] || 0;
    return acc + Math.max(0, baseAmount + optimisticChange);
  }, 0);
  const isExceeded = subscriptionAmount > 0 && totalSpending > subscriptionAmount;

  // Group other pledges for visualization (including optimistic changes)
  const otherPledgesData: Record<string, OtherPledge[]> = pledges.reduce((acc, currentPledge) => {
    // Skip the current pledge when calculating others
    const otherPledges = pledges
      .filter(pledge => pledge.id !== currentPledge.id)
      // Sort by amount (highest first) for consistent visualization
      .sort((a, b) => {
        const aAmount = Math.max(0, (Number(a.amount) || 0) + (optimisticAmounts[a.id] || 0));
        const bAmount = Math.max(0, (Number(b.amount) || 0) + (optimisticAmounts[b.id] || 0));
        return bAmount - aAmount;
      });

    acc[currentPledge.id] = otherPledges.map(pledge => {
      const baseAmount = Number(pledge.amount) || 0;
      const optimisticChange = optimisticAmounts[pledge.id] || 0;
      return {
        id: pledge.id,
        pageId: pledge.pageId,
        title: pledge.title || 'Untitled Page',
        amount: Math.max(0, baseAmount + optimisticChange)
      };
    });

    return acc;
  }, {} as Record<string, OtherPledge[]>);



  return (
    <div className={cn("w-full relative cursor-pointer", className)} onClick={() => onPledgeChange && onPledgeChange(pledges[0]?.id || '', 0)}>
      <div className="w-full flex flex-col gap-4">
        {pledges.map((pledge) => {
          const baseAmount = Number(pledge.amount || 0);
          const optimisticChange = optimisticAmounts[pledge.id] || 0;
          const pledgeAmount = Math.max(0, baseAmount + optimisticChange);
          const isZero = pledgeAmount === 0;
          const percentage = calculatePercentage(pledgeAmount, max);
          const isPending = pendingUpdates[pledge.id] || false;
          const errorMessage = errorStates[pledge.id] || '';

          // Calculate remaining budget percentage
          const currentPledgeAmount = pledgeAmount;
          const otherPledgesAmount = totalSpending - currentPledgeAmount;
          const usedPercentage = calculatePercentage(totalSpending, max);
          const remainingPercentage = Math.max(0, 100 - usedPercentage);

          // Calculate if this pledge would exceed the limit when increased
          const remainingSubscription = subscriptionAmount - otherPledgesAmount;
          const wouldExceedLimit = subscriptionAmount > 0 && (remainingSubscription <= 0 || pledgeAmount >= remainingSubscription);

          return (
            <div key={pledge.id} className="w-full">
              {/* Show title only when showTitle prop is true */}
              {showTitle && pledge.title && (
                <div className="mb-2 text-sm font-medium text-foreground/90">
                  <a href={`/${pledge.pageId}`} className="hover:text-blue-600 hover:underline transition-colors">
                    {pledge.title}
                  </a>
                </div>
              )}

              <div
                className="relative h-[56px] rounded-2xl overflow-hidden border-theme-light bg-background dark:bg-background/30 shadow-md hover:shadow-lg transition-shadow"

              >
                {/* Background for visualization */}
                <div className="h-full w-full bg-gray-100 dark:bg-gray-800 absolute left-0 top-0"></div>

                {/* Other pledges visualization - split by different pages */}
                {otherPledgesData[pledge.id] && otherPledgesData[pledge.id].map((otherPledge, index) => {
                  // Calculate the position and width for this pledge
                  const previousPledgesAmount = otherPledgesData[pledge.id]
                    .slice(0, index)
                    .reduce((sum, p) => sum + p.amount, 0);

                  const previousPercentage = calculatePercentage(previousPledgesAmount, max);
                  const otherPledgePercentage = calculatePercentage(otherPledge.amount, max);

                  // Add a small gap between sections (0.5% of width)
                  const gapWidth = 0.5;
                  const adjustedWidth = Math.max(0, otherPledgePercentage - gapWidth);
                  const adjustedLeft = previousPercentage + (gapWidth / 2);

                  return (
                    <div
                      key={`other-pledge-${otherPledge.id}`}
                      className="h-full absolute left-0 tooltip-trigger"
                      style={{
                        width: `${adjustedWidth}%`,
                        left: `${adjustedLeft}%`,
                        backgroundColor: '#808080', // Use grey for all other pledges
                        transition: 'width 0.5s ease-in-out, left 0.5s ease-in-out',
                        borderRadius: '4px',
                        zIndex: 1
                      }}
                      data-tooltip={`${otherPledge.title}: $${otherPledge.amount.toFixed(2)}`}
                    ></div>
                  );
                })}

                {/* Current pledge progress bar */}
                <div
                  key={`pledge-bar-${pledgeAmount}`}
                  className={cn(
                    "h-full absolute",
                    isExceeded ? "bg-destructive" : "bg-primary"
                  )}
                  style={{
                    width: `${Math.max(0, percentage - 0.5)}%`,
                    left: `${calculatePercentage(otherPledgesData[pledge.id]?.reduce((sum, p) => sum + p.amount, 0) || 0, max) + 0.25}%`,
                    transition: 'width 0.5s ease-in-out, left 0.5s ease-in-out, background-color 0.3s ease',
                    borderRadius: '4px',
                    zIndex: 2
                  }}
                  data-tooltip={`${pledge.title || 'This page'}: $${pledgeAmount.toFixed(2)}`}
                ></div>

                {/* Remaining subscription amount is implicit in background */}

                {/* Inner border that appears when there's a value */}
                {pledgeAmount > 0 && (
                  <div
                    className={cn(
                      "absolute h-full pointer-events-none border-l-2",
                      isExceeded ? "border-destructive" : "border-primary"
                    )}
                    style={{
                      left: `${calculatePercentage(otherPledgesData[pledge.id]?.reduce((sum, p) => sum + p.amount, 0) || 0, max) + percentage}%`,
                      transform: 'translateX(-100%)',
                      transition: 'left 0.5s ease-in-out, border-color 0.3s ease',
                      zIndex: 3
                    }}
                  ></div>
                )}

                {/* Controls */}
                <div className="flex justify-between items-center h-full relative z-10 p-0">
                  <div
                    className="h-full w-[56px] flex items-center justify-center transition-colors hover:bg-muted/80 dark:hover:bg-gray-900 text-foreground dark:text-white cursor-pointer rounded-l-lg relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pledgeAmount > 0) {
                        handleOptimisticPledgeChange(pledge.id, -1);
                      }
                    }}
                  >
                    {isPending && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-l-lg">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"></path>
                    </svg>
                  </div>

                  <div
                    className="flex-1 flex justify-center items-center cursor-pointer text-foreground dark:text-white group transition-all hover:bg-muted/50 dark:hover:bg-gray-900 relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPledgeCustomAmount) {
                        onPledgeCustomAmount(pledge.id);
                      }
                    }}
                  >
                    <span className="text-sm text-foreground dark:text-white mr-1">$</span>
                    <span className={cn(
                      "text-3xl font-normal transition-all group-hover:scale-105 text-foreground dark:text-white",
                      isExceeded ? "text-orange-600 dark:text-orange-400" : "",
                      optimisticChange !== 0 ? "text-blue-600 dark:text-blue-400" : ""
                    )}>
                      {isNaN(pledgeAmount) ? '0.00' : Number(pledgeAmount).toFixed(2)}
                    </span>
                    <span className="text-sm text-foreground dark:text-white ml-1">/mo</span>

                    {/* Show optimistic change indicator */}
                    {optimisticChange !== 0 && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded-full">
                        {optimisticChange > 0 ? '+' : ''}{optimisticChange.toFixed(2)}
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      "h-full w-[56px] flex items-center justify-center transition-colors hover:bg-muted/80 dark:hover:bg-gray-900 cursor-pointer rounded-r-lg relative",
                      wouldExceedLimit ? "text-orange-600/70 dark:text-orange-500/70" : "text-foreground dark:text-white"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (wouldExceedLimit && subscriptionAmount > 0) {
                        setActivePledgeId(pledge.id);
                        setShowSubscriptionLimitModal(true);
                      } else {
                        handleOptimisticPledgeChange(pledge.id, 1);
                      }
                    }}
                  >
                    {isPending && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-r-lg">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14"></path>
                      <path d="M5 12h14"></path>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {errorMessage && (
                <div className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                  {errorMessage}
                </div>
              )}

              {/* Remove button */}
              {showRemoveButton && onDeletePledge && (
                <button
                  className="mt-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                  onClick={() => onDeletePledge(pledge.id)}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Subscription Limit Modal */}
      {isMounted && createPortal(
        <ActionModal
          isOpen={showSubscriptionLimitModal}
          onClose={() => setShowSubscriptionLimitModal(false)}
          message="You've reached your subscription limit. Would you like to adjust your subscription amount to pledge more?"
          primaryActionLabel="Adjust Subscription"
          primaryActionHref="/settings"
          secondaryActionLabel="Cancel"
        />,
        document.body
      )}
    </div>
  );
};

export default CompositionBar;
