import React, { useState } from 'react';
import ActionModal from './ActionModal';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

const CompositionBar = ({
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
  const [showSubscriptionLimitModal, setShowSubscriptionLimitModal] = useState(false);
  const [activePledgeId, setActivePledgeId] = useState(null);

  // Debugging the props
  console.log("CompositionBar props:", {
    disabled,
    hasPledges: pledges?.length > 0,
    hasSubscriptionAmount: !!subscriptionAmount,
    hasOnPledgeChange: !!onPledgeChange
  });

  // Handle safer percentage calculations to avoid NaN
  const calculatePercentage = (amount, total) => {
    if (!total || total <= 0 || isNaN(amount) || amount <= 0) return 0;
    const safeAmount = Math.round(Number(amount) * 100) / 100; // Round to 2 decimal places
    const percentage = Math.min(100, (safeAmount / total) * 100);
    return percentage;
  };

  // Check if total spending exceeds subscription amount
  const totalSpending = pledges.reduce((acc, pledge) =>
    acc + (Number(pledge.amount) || 0), 0);
  const isExceeded = subscriptionAmount > 0 && totalSpending > subscriptionAmount;

  // For debugging
  console.log("CompositionBar rendering:", {
    pledges: pledges.map(p => ({id: p.id, amount: p.amount})),
    totalSpending,
    subscriptionAmount,
    isExceeded,
    percentages: pledges.map(p => ({
      pledgeId: p.id,
      pledgeAmount: Number(p.amount || 0),
      percentage: calculatePercentage(Number(p.amount || 0), max)
    }))
  });

  return (
    <div className={cn("w-full relative pointer-events-none", className)}>
      <div className="w-full flex flex-col gap-4">
        {pledges.map((pledge) => {
          const pledgeAmount = Number(pledge.amount || 0);
          const isZero = pledgeAmount === 0;
          const percentage = calculatePercentage(pledgeAmount, max);

          // Calculate other pledges total percentage for visualization
          const currentPledgeAmount = pledgeAmount;
          const otherPledgesAmount = totalSpending - currentPledgeAmount;
          const otherPledgesPercentage = calculatePercentage(otherPledgesAmount, max);

          // Calculate if this pledge would exceed the limit when increased
          const remainingSubscription = subscriptionAmount - otherPledgesAmount;
          const wouldExceedLimit = subscriptionAmount > 0 && (remainingSubscription <= 0 || pledgeAmount >= remainingSubscription);

          return (
            <div key={pledge.id} className="w-full">
              {/* Show title only when showTitle prop is true */}
              {showTitle && pledge.title && (
                <div className="mb-2 text-sm font-medium text-foreground/90">
                  <a href={`/pages/${pledge.pageId}`} className="hover:text-blue-600 hover:underline transition-colors">
                    {pledge.title}
                  </a>
                </div>
              )}

              <div
                className="relative h-[56px] rounded-xl overflow-hidden border border-border bg-background dark:bg-background/30 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  // If we have a subscription limit and would exceed it, show the limit modal
                  if (wouldExceedLimit && subscriptionAmount > 0) {
                    setActivePledgeId(pledge.id);
                    setShowSubscriptionLimitModal(true);
                  } else if (onPledgeChange) {
                    // Otherwise, trigger the pledge change handler which will show the support modal
                    onPledgeChange(pledge.id, 0);
                  }
                }}
              >
                {/* Other pledges background - always show regardless of percentage */}
                <div
                  className="h-full absolute left-0 bg-muted"
                  style={{
                    width: `${otherPledgesPercentage}%`,
                    transition: 'width 0.5s ease-in-out',
                    zIndex: 1
                  }}
                ></div>

                {/* Current pledge progress bar */}
                <div
                  key={`pledge-bar-${pledgeAmount}`}
                  className={cn(
                    "h-full absolute",
                    isExceeded ? "bg-destructive" : "bg-primary"
                  )}
                  style={{
                    width: `${percentage}%`,
                    left: `${otherPledgesPercentage}%`,
                    transition: 'width 0.5s ease-in-out, left 0.5s ease-in-out, background-color 0.3s ease',
                    zIndex: 2
                  }}
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
                      left: `${otherPledgesPercentage + percentage}%`,
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

              {/* Show subscription limit message */}
              {wouldExceedLimit && (
                <div className="mt-1 p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs rounded">
                  Subscription limit reached. Increase subscription to pledge more.
                </div>
              )}

              {/* Delete button only shown when amount is zero and showRemoveButton is true */}
              {isZero && onDeletePledge && showRemoveButton && (
                <div className="mt-1 flex justify-end">
                  <button
                    onClick={() => onDeletePledge(pledge.id)}
                    className="text-destructive hover:text-destructive/80 text-sm flex items-center transition-opacity"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Subscription Limit Modal */}
      {typeof document !== 'undefined' && createPortal(
        <ActionModal
          isOpen={showSubscriptionLimitModal}
          onClose={() => setShowSubscriptionLimitModal(false)}
          message="You've reached your subscription limit. Would you like to adjust your subscription amount to pledge more?"
          primaryActionLabel="Adjust Subscription"
          primaryActionHref="/account"
          secondaryActionLabel="Cancel"
        />,
        document.body
      )}
    </div>
  );
};

export default CompositionBar;