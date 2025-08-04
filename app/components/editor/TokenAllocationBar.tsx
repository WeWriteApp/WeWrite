/**
 * @deprecated This component is deprecated and will be removed in a future version.
 * Use UsdAllocationBar instead for USD-based allocation bars.
 *
 * Legacy token allocation bar - replaced by USD system.
 */

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

interface TokenAllocationBarProps {
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

const TokenAllocationBar: React.FC<TokenAllocationBarProps> = ({
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

  // Track if component is mounted for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Calculate percentage for visualization
  const calculatePercentage = (amount: number, maxAmount: number): number => {
    if (!maxAmount || maxAmount <= 0) return 0;
    return Math.min(100, (amount / maxAmount) * 100);
  };

  // Get current amount (optimistic or actual)
  const getCurrentAmount = (pledgeId: string): number => {
    return optimisticAmounts[pledgeId] ?? pledges.find(p => p.id === pledgeId)?.amount ?? 0;
  };

  // Handle optimistic updates
  const handleOptimisticUpdate = useCallback((pledgeId: string, newAmount: number) => {
    setOptimisticAmounts(prev => ({
      ...prev,
      [pledgeId]: newAmount
    }));
  }, []);

  // Handle pledge amount changes with optimistic updates
  const handlePledgeChange = useCallback(async (pledgeId: string, change: number) => {
    if (!onPledgeChange || pendingUpdates[pledgeId]) return;

    const currentAmount = getCurrentAmount(pledgeId);
    const newAmount = Math.max(0, currentAmount + change);
    
    // Check subscription limit
    const totalOtherPledges = pledges
      .filter(p => p.id !== pledgeId)
      .reduce((sum, p) => sum + getCurrentAmount(p.id), 0);
    
    if (totalOtherPledges + newAmount > subscriptionAmount) {
      setShowSubscriptionLimitModal(true);
      return;
    }

    // Apply optimistic update immediately
    handleOptimisticUpdate(pledgeId, newAmount);
    
    // Set pending state
    setPendingUpdates(prev => ({ ...prev, [pledgeId]: true }));
    setErrorStates(prev => ({ ...prev, [pledgeId]: '' }));

    try {
      await onPledgeChange(pledgeId, change);
      
      // Clear optimistic state on success
      setOptimisticAmounts(prev => {
        const newState = { ...prev };
        delete newState[pledgeId];
        return newState;
      });
    } catch (error) {
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
    } finally {
      setPendingUpdates(prev => ({ ...prev, [pledgeId]: false }));
    }
  }, [pledges, subscriptionAmount, onPledgeChange, getCurrentAmount, handleOptimisticUpdate, pendingUpdates]);

  // Calculate other pledges data for visualization
  const otherPledgesData: Record<string, OtherPledge[]> = {};
  pledges.forEach(pledge => {
    otherPledgesData[pledge.id] = pledges
      .filter(p => p.id !== pledge.id)
      .map(p => ({
        id: p.id,
        pageId: p.pageId,
        title: p.title || 'Untitled',
        amount: getCurrentAmount(p.id)
      }));
  });

  return (
    <div className={cn("space-y-4", className)}>
      {pledges.map((pledge) => {
        const pledgeAmount = getCurrentAmount(pledge.id);
        const otherPledgesAmount = otherPledgesData[pledge.id]?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const totalAmount = pledgeAmount + otherPledgesAmount;
        const percentage = calculatePercentage(pledgeAmount, max);
        const isExceeded = totalAmount > max;
        const isPending = pendingUpdates[pledge.id];
        const error = errorStates[pledge.id];

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

              {/* Other pledges visualization */}
              {otherPledgesData[pledge.id]?.map((otherPledge, index) => {
                const otherPercentage = calculatePercentage(otherPledge.amount, max);
                const previousAmount = otherPledgesData[pledge.id]
                  ?.slice(0, index)
                  .reduce((sum, p) => sum + p.amount, 0) || 0;
                const leftPosition = calculatePercentage(previousAmount, max);

                return (
                  <div
                    key={otherPledge.id}
                    className="h-full absolute bg-muted-foreground/40"
                    style={{
                      width: `${Math.max(0, otherPercentage - 0.5)}%`,
                      left: `${leftPosition + 0.25}%`,
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

              {/* Controls overlay */}
              <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                {/* Left side - decrease button */}
                <button
                  onClick={() => handlePledgeChange(pledge.id, -1)}
                  disabled={disabled || pledgeAmount <= 0 || isPending}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    "bg-background/80 hover:bg-background border border-border",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    pledgeAmount <= 0 && "opacity-30"
                  )}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-lg font-bold leading-none">−</span>
                  )}
                </button>

                {/* Center - amount display */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => onPledgeCustomAmount?.(pledge.id)}
                    disabled={disabled || isPending}
                    className="text-lg font-bold text-foreground hover:text-primary transition-colors"
                  >
                    ${pledgeAmount.toFixed(2)}
                  </button>
                  {error && (
                    <div className="text-xs text-destructive mt-1">{error}</div>
                  )}
                </div>

                {/* Right side - increase button and remove button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePledgeChange(pledge.id, 1)}
                    disabled={disabled || isPending}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      "bg-background/80 hover:bg-background border border-border",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-lg font-bold leading-none">+</span>
                    )}
                  </button>

                  {/* Remove button - only show when showRemoveButton is true */}
                  {showRemoveButton && onDeletePledge && (
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to remove this pledge?')) {
                          onDeletePledge(pledge.id);
                        }
                      }}
                      disabled={disabled || isPending}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                        "bg-destructive/10 hover:bg-destructive/20 border border-destructive/20",
                        "text-destructive hover:text-destructive",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      <span className="text-lg font-bold leading-none">×</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

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

export default TokenAllocationBar;
