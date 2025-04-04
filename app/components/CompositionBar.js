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
    <div className={cn("w-full relative", className)}>
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
                className="relative h-[56px] rounded-full overflow-hidden border-theme-medium bg-background shadow-sm cursor-pointer"
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
                <div className="flex justify-between items-center h-full relative z-10">
                  <div
                    className="h-full w-[56px] flex items-center justify-center transition-colors hover:bg-foreground/5 text-foreground/80 cursor-pointer"
                    onClick={() => {
                      console.log("Minus button clicked", {
                        onPledgeChange: !!onPledgeChange,
                        pledgeAmount,
                        disabled,
                        id: pledge.id
                      });

                      // Call the handler without checking for disabled
                      if (onPledgeChange) {
                        console.log("Calling onPledgeChange with", pledge.id, -1);
                        onPledgeChange(pledge.id, -1);
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"></path>
                    </svg>
                  </div>

                  <div
                    className="flex-1 flex justify-center items-center cursor-pointer text-foreground group transition-all hover:bg-foreground/5"
                    onClick={() => {
                      if (onPledgeCustomAmount) {
                        onPledgeCustomAmount(pledge.id);
                      }
                    }}
                  >
                    <span className="text-sm opacity-70 mr-1">$</span>
                    <span className={cn(
                      "text-3xl font-normal transition-all group-hover:scale-105",
                      isExceeded ? "text-orange-600 dark:text-orange-400" : ""
                    )}>
                      {isNaN(pledgeAmount) ? '0.10' : Number(pledgeAmount).toFixed(2)}
                    </span>
                    <span className="text-sm opacity-70 ml-1">/mo</span>
                  </div>

                  <div
                    className={cn(
                      "h-full w-[56px] flex items-center justify-center transition-colors hover:bg-foreground/5 cursor-pointer",
                      wouldExceedLimit ? "text-orange-500/70" : "text-foreground/80"
                    )}
                    onClick={() => {
                      console.log("Plus button clicked", {
                        onPledgeChange: !!onPledgeChange,
                        pledgeAmount,
                        wouldExceedLimit,
                        disabled,
                        id: pledge.id,
                        subscriptionAmount
                      });

                      if (wouldExceedLimit && subscriptionAmount > 0) {
                        // Set active pledge and show subscription limit modal
                        setActivePledgeId(pledge.id);
                        setShowSubscriptionLimitModal(true);
                      } else if (onPledgeChange) {
                        // Call the handler without checking for disabled status
                        console.log("Calling onPledgeChange with", pledge.id, 1);
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