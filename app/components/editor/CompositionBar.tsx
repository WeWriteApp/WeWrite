import React, { useState, useEffect } from 'react';
import ActionModal from '../utils/ActionModal';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
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

  // Ensure component is mounted before rendering portals
  useEffect(() => {
    setIsMounted(true);
  }, []);



  // Handle safer percentage calculations to avoid NaN
  const calculatePercentage = (amount: number, total: number): number => {
    if (!total || total <= 0 || isNaN(amount) || amount <= 0) return 0;
    const safeAmount = Math.round(Number(amount) * 100) / 100; // Round to 2 decimal places
    const percentage = Math.min(100, (safeAmount / total) * 100);
    return percentage;
  };

  // Check if total spending exceeds subscription amount
  const totalSpending = pledges.reduce((acc, pledge) =>
    acc + (Number(pledge.amount) || 0), 0);
  const isExceeded = subscriptionAmount > 0 && totalSpending > subscriptionAmount;

  // Group other pledges for visualization
  const otherPledgesData: Record<string, OtherPledge[]> = pledges.reduce((acc, currentPledge) => {
    // Skip the current pledge when calculating others
    const otherPledges = pledges
      .filter(pledge => pledge.id !== currentPledge.id)
      // Sort by amount (highest first) for consistent visualization
      .sort((a, b) => b.amount - a.amount);

    acc[currentPledge.id] = otherPledges.map(pledge => ({
      id: pledge.id,
      pageId: pledge.pageId,
      title: pledge.title || 'Untitled Page',
      amount: Number(pledge.amount) || 0
    }));

    return acc;
  }, {} as Record<string, OtherPledge[]>);



  return (
    <div className={cn("w-full relative cursor-pointer", className)} onClick={() => onPledgeChange && onPledgeChange(pledges[0]?.id || '', 0)}>
      <div className="w-full flex flex-col gap-4">
        {pledges.map((pledge) => {
          const pledgeAmount = Number(pledge.amount || 0);
          const isZero = pledgeAmount === 0;
          const percentage = calculatePercentage(pledgeAmount, max);

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
                    className="h-full w-[56px] flex items-center justify-center transition-colors hover:bg-muted/80 dark:hover:bg-gray-900 text-foreground dark:text-white cursor-pointer rounded-l-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPledgeChange) {
                        onPledgeChange(pledge.id, -1);
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"></path>
                    </svg>
                  </div>

                  <div
                    className="flex-1 flex justify-center items-center cursor-pointer text-foreground dark:text-white group transition-all hover:bg-muted/50 dark:hover:bg-gray-900"
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
                      isExceeded ? "text-orange-600 dark:text-orange-400" : ""
                    )}>
                      {isNaN(pledgeAmount) ? '0.00' : Number(pledgeAmount).toFixed(2)}
                    </span>
                    <span className="text-sm text-foreground dark:text-white ml-1">/mo</span>
                  </div>

                  <div
                    className={cn(
                      "h-full w-[56px] flex items-center justify-center transition-colors hover:bg-muted/80 dark:hover:bg-gray-900 cursor-pointer rounded-r-lg",
                      wouldExceedLimit ? "text-orange-600/70 dark:text-orange-500/70" : "text-foreground dark:text-white"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (wouldExceedLimit && subscriptionAmount > 0) {
                        setActivePledgeId(pledge.id);
                        setShowSubscriptionLimitModal(true);
                      } else if (onPledgeChange) {
                        onPledgeChange(pledge.id, 1);
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14"></path>
                      <path d="M5 12h14"></path>
                    </svg>
                  </div>
                </div>
              </div>

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
