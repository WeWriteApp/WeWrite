"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from '../../providers/AuthProvider';
import { Button } from "../ui/button";
import { Plus, Minus } from "lucide-react";
import { cn } from "../../lib/utils";
import { isActiveSubscription } from "../../utils/subscriptionStatus";
import { formatUsdCents } from '../../utils/formatCurrency';
import { UsdAllocationModal } from './UsdAllocationModal';
import { ParticleAnimation, PulseAnimation } from '../ui/ParticleAnimation';

import { AllocationAmountDisplay } from './AllocationAmountDisplay';
import { useDelayedLoginBanner } from '../../hooks/useDelayedLoginBanner';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useDemoBalance, useShouldUseDemoBalance } from '../../contexts/DemoBalanceContext';
import { useAllocationInterval } from '../../contexts/AllocationIntervalContext';
import { useAllocationState } from '../../hooks/useAllocationState';
import { useAllocationActions } from '../../hooks/useAllocationActions';
import {
  FloatingAllocationBarProps,
  PageStats,
  Subscription,
  CompositionBarData
} from '../../types/allocation';
import { ALLOCATION_BAR_STYLES } from '../../constants/allocation-styles';

interface AllocationBarProps extends Omit<FloatingAllocationBarProps, 'pageId' | 'authorId' | 'pageTitle'> {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  // Variant support for different allocation bar styles
  variant?: 'default' | 'simple' | 'user';
  // For user allocation mode
  isUserAllocation?: boolean;
  username?: string;
}

const AllocationBar = React.forwardRef<HTMLDivElement, AllocationBarProps>(({
  pageId: propPageId,
  pageTitle,
  authorId,
  visible = true,
  className,
  variant = 'default',
  isUserAllocation = false,
  username,
}, ref) => {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { triggerDelayedBanner } = useDelayedLoginBanner();
  const { usdBalance } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);
  const { demoBalance, isDemoBalance } = useDemoBalance();
  const { allocationIntervalCents, isLoading: intervalLoading } = useAllocationInterval();

  // Flash animation state
  const [flashType, setFlashType] = useState<'accent' | 'red' | null>(null);

  // Game-like animation state for allocation increases
  const [showParticles, setShowParticles] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  // Scroll detection state
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-detect pageId from URL if not provided
  const pageId = propPageId || (pathname ? pathname.substring(1) : '');

  // Debug logging
  console.log('🎯 AllocationBar: pageId info', {
    propPageId,
    pathname,
    derivedPageId: pageId,
    hasPageId: !!pageId
  });

  // Check if current user is the page owner
  const isPageOwner = !!(user && authorId && user.uid === authorId);

  // State for floating bar specific features
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageStats, setPageStats] = useState<PageStats | null>(null);

  // Use our new shared hooks
  const { allocationState, setOptimisticAllocation } = useAllocationState({
    pageId,
    enabled: !isPageOwner && !!pageId
  });

  // Use allocation actions hook
  const {
    handleAllocationChange: originalHandleAllocationChange,
    isProcessing,
    error,
    clearError
  } = useAllocationActions({
    pageId,
    authorId: authorId || '',
    pageTitle: pageTitle || '',
    currentAllocationCents: allocationState.currentAllocationCents,
    source: 'FloatingBar',
    onOptimisticUpdate: setOptimisticAllocation
  });

  // Flash animation trigger
  const triggerFlash = (type: 'accent' | 'red') => {
    setFlashType(type);
    setTimeout(() => setFlashType(null), 500); // Match animation duration
  };

  // Wrapper for allocation change that triggers flash
  const handleAllocationChange = (amount: number, event?: React.MouseEvent) => {
    // Ensure we have a valid pageId before proceeding
    if (!pageId) {
      console.error('AllocationBar: Cannot allocate - pageId is missing');
      return;
    }

    // Trigger appropriate flash and game-like animations based on whether we're increasing or decreasing
    if (amount > 0) {
      triggerFlash('accent');
      // Trigger game-like animations for increases
      setShowPulse(true);
      setShowParticles(true);
      // Reset animations after they complete
      setTimeout(() => setShowPulse(false), 600);
      setTimeout(() => setShowParticles(false), 1000);
    } else if (amount < 0) {
      triggerFlash('red');
    }

    // Call the original handler
    return originalHandleAllocationChange(amount, event);
  };

  // Scroll detection effect
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollThreshold = 100;

      if (Math.abs(currentScrollY - lastScrollY) < scrollThreshold) {
        return;
      }

      if (currentScrollY > lastScrollY && currentScrollY > 200) {
        setIsHidden(true);
      } else if (currentScrollY < lastScrollY) {
        setIsHidden(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);



  // Calculate composition bar data with optimistic updates
  const getCompositionData = (): CompositionBarData => {
    // Use appropriate balance based on subscription status
    const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;



    if (!currentBalance) {
      return {
        otherPagesPercentage: 0,
        currentPageFundedPercentage: 0,
        currentPageOverfundedPercentage: 0,
        availablePercentage: 100,
        isOutOfFunds: false
      };
    }

    const totalCents = currentBalance.totalUsdCents;
    const originalAllocatedCents = currentBalance.allocatedUsdCents;
    const originalAvailableCents = currentBalance.availableUsdCents;

    // Use optimistic allocation for current page (if available)
    const currentPageCents = allocationState.optimisticAllocation ?? allocationState.currentAllocationCents;

    // Calculate other pages allocation - this should remain constant during optimistic updates
    // We use the original allocation state to avoid the squeeze effect
    const otherPagesCents = Math.max(0, originalAllocatedCents - allocationState.currentAllocationCents);

    // Calculate optimistic available by subtracting the allocation difference from original available
    const allocationDifference = currentPageCents - allocationState.currentAllocationCents;
    const optimisticAvailableCents = Math.max(0, originalAvailableCents - allocationDifference);

    const isOutOfFunds = optimisticAvailableCents <= 0 && totalCents > 0;

    // Calculate total allocated including current page
    const totalAllocatedCents = otherPagesCents + currentPageCents;

    // Split current page allocation into funded and overfunded portions
    const availableFundsForCurrentPage = Math.max(0, totalCents - otherPagesCents);
    const currentPageFundedCents = Math.min(currentPageCents, availableFundsForCurrentPage);
    const currentPageOverfundedCents = Math.max(0, currentPageCents - availableFundsForCurrentPage);

    // Calculate percentages for composition bar based on total allocated (which may exceed totalCents)
    const displayTotal = Math.max(totalCents, totalAllocatedCents);
    const otherPagesPercentage = displayTotal > 0 ? (otherPagesCents / displayTotal) * 100 : 0;
    const currentPageFundedPercentage = displayTotal > 0 ? (currentPageFundedCents / displayTotal) * 100 : 0;
    const currentPageOverfundedPercentage = displayTotal > 0 ? (currentPageOverfundedCents / displayTotal) * 100 : 0;
    const availablePercentage = displayTotal > 0 ? Math.max(0, (optimisticAvailableCents / displayTotal) * 100) : 0;



    return {
      otherPagesPercentage,
      currentPageFundedPercentage,
      currentPageOverfundedPercentage,
      availablePercentage,
      isOutOfFunds
    };
  };

  const compositionData = getCompositionData();

  // Handle allocation bar click
  const handleAllocationBarClick = () => {
    // Allow both logged out users and logged in users to open the modal
    if (!isPageOwner) {
      setIsModalOpen(true);
    }
  };

  // Don't show if not visible or no pageId
  if (!visible || !pageId) return null;

  // Don't show allocation bar when viewing your own page
  if (isPageOwner) return null;

  // User state checks - use the correct subscription state from UsdBalance context
  const showSubscriptionNotice = user && !hasActiveSubscription && !isPageOwner && isDemoBalance;
  const showLoginNotice = !user && !isPageOwner;

  return createPortal(
    <div
      className={cn(
        "fixed left-4 right-4 bottom-6 z-50 flex justify-center",
        "transition-transform duration-300 ease-in-out",
        isHidden ? "translate-y-[calc(100%+2rem)]" : "translate-y-0"
      )}
    >
      <div
        ref={ref}
        data-allocation-bar
        onClick={handleAllocationBarClick}
        className={cn(
          "wewrite-card wewrite-floating relative w-full max-w-md overflow-hidden rounded-xl border border-neutral-20",
          "transition-all duration-300 ease-in-out", // Ensure smooth transitions
          flashType === 'accent' && "animate-flash-bar-accent",
          flashType === 'red' && "animate-flash-bar-red",
          className
        )}
      >
        {/* Main Content - remove bottom padding when banner is showing */}
        <div className={cn(
          "space-y-2",
          isPageOwner ? "p-3" : "p-4",
          (showLoginNotice || showSubscriptionNotice) && "pb-0"
        )}>
          {/* Page Stats for Page Owners */}
          {isPageOwner && (
            <div>
              {pageStats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <div className="text-xl font-bold text-primary">
                      {pageStats.sponsorCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pageStats.sponsorCount === 1 ? 'Supporter' : 'Supporters'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <div className="text-xl font-bold text-primary">
                      {formatUsdCents(pageStats.totalPledgedUsdCents)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Pledged
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Loading...</div>
                </div>
              )}
            </div>
          )}

          {/* USD Controls */}
          {!isPageOwner && (
            <>
              {/* Allocation amount display above the controls */}
              <AllocationAmountDisplay
                allocationCents={allocationState.currentAllocationCents}
                availableBalanceCents={usdBalance?.availableUsdCents || 0}
                variant={isUserAllocation ? 'user' : 'page'}
                flashType={flashType}
                allocationIntervalCents={allocationIntervalCents}
              />

              {/* Out of funds message */}
              {compositionData.isOutOfFunds && (
                <div className="text-center text-sm text-error font-medium">
                  Out of funds
                </div>
              )}

              {/* Simple variant with quick amount buttons */}
              {variant === 'simple' ? (
                <div className="flex items-center justify-center">
                  <div className="flex items-center space-x-2">
                    {/* Quick amount buttons - use multiples of current interval */}
                    {[
                      allocationIntervalCents,           // 1x interval (e.g., $0.50)
                      allocationIntervalCents * 2,       // 2x interval (e.g., $1.00)
                      allocationIntervalCents * 4,       // 4x interval (e.g., $2.00)
                      allocationIntervalCents * 10       // 10x interval (e.g., $5.00)
                    ].map((cents) => (
                      <Button
                        key={cents}
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAllocationChange(cents, e);
                        }}
                        disabled={isProcessing || cents > (usdBalance?.availableUsdCents || 0)}
                        className="h-8 px-2 text-xs"
                      >
                        +{formatUsdCents(cents)}
                      </Button>
                    ))}

                    {/* Minus button */}
                    {allocationState.currentAllocationCents > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const decreaseAmount = Math.min(allocationState.currentAllocationCents, 25);
                          handleAllocationChange(-decreaseAmount, e);
                        }}
                        disabled={isProcessing}
                        className="h-8 w-8 p-0 bg-secondary hover:bg-secondary/80 border-2 border-neutral-20"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
              <div className="flex items-center gap-3">
              {(allocationState.isLoading || intervalLoading) ? (
                <div className="flex items-center gap-3 w-full">
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-md"></div>
                  <div className="flex-1 h-12 bg-muted animate-pulse rounded-lg"></div>
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-md"></div>
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => handleAllocationChange(-allocationIntervalCents, e)}
                    className={cn(
                      "h-8 w-8 p-0 bg-secondary hover:bg-secondary/80 border-2 border-neutral-20",
                      allocationState.currentAllocationCents <= 0 && "opacity-50",
                      isProcessing && "opacity-75"
                    )}
                    disabled={allocationState.currentAllocationCents <= 0 || isProcessing}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>

                  {/* Composition Bar */}
                  <div className="flex-1 h-12 flex gap-1 items-center bg-muted rounded-lg p-1">
                    {/* Always show composition - even when out of funds */}
                    <>
                      {/* Other pages - use neutral color system */}
                      {compositionData.otherPagesPercentage > 0 && (
                        <div
                          className={`h-full ${ALLOCATION_BAR_STYLES.sections.other}`}
                          style={{ width: `${compositionData.otherPagesPercentage}%` }}
                        />
                      )}

                      {/* Current page - funded portion with game-like animations */}
                      {compositionData.currentPageFundedPercentage > 0 && (
                        <div
                          className={cn(
                            "h-full bg-primary rounded-md transition-all duration-300 ease-out relative overflow-hidden",
                            showPulse && "animate-allocation-pulse"
                          )}
                          style={{ width: `${compositionData.currentPageFundedPercentage}%` }}
                        >
                          {/* Pulse animation overlay */}
                          <PulseAnimation
                            trigger={showPulse}
                            onComplete={() => setShowPulse(false)}
                            className="bg-primary rounded-md"
                            intensity={1.05}
                          />

                          {/* Particle animation */}
                          <ParticleAnimation
                            trigger={showParticles}
                            onComplete={() => setShowParticles(false)}
                            particleCount={6}
                            duration={800}
                            color="hsl(var(--primary))"
                          />
                        </div>
                      )}

                      {/* Current page - overfunded portion */}
                      {compositionData.currentPageOverfundedPercentage > 0 && (
                        <div
                          className={`h-full ${ALLOCATION_BAR_STYLES.sections.overspent}`}
                          style={{ width: `${compositionData.currentPageOverfundedPercentage}%` }}
                        />
                      )}

                      {/* Available/Remaining - use neutral color system */}
                      {compositionData.availablePercentage > 0 && (
                        <div
                          className="h-full bg-muted rounded-md transition-all duration-300 ease-out"
                          style={{ width: `${compositionData.availablePercentage}%` }}
                        />
                      )}
                    </>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Always try to allocate - if out of funds, the modal will show
                      handleAllocationChange(allocationIntervalCents, e);
                    }}
                    className={cn(
                      "h-8 w-8 p-0 bg-secondary hover:bg-secondary/80 border-2 border-neutral-20",
                      compositionData.isOutOfFunds && "opacity-50",
                      isProcessing && "opacity-75"
                    )}
                    disabled={isProcessing}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
              )}
            </>
          )}


        </div>

        {/* Warning Banners - positioned outside padded content to extend to card edges */}
        {/* Login Notice */}
        {showLoginNotice && (
          <div
            className="bg-primary text-primary-foreground p-3 rounded-b-xl cursor-pointer hover:bg-primary/90 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/');
            }}
          >
            <p className="text-sm font-medium text-center">
              Demo funds: Log in to start donating to writers
            </p>
          </div>
        )}

        {/* Subscription Notice */}
        {showSubscriptionNotice && (
          <div
            className="bg-warning text-warning-foreground p-3 rounded-b-xl cursor-pointer hover:bg-warning/90 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/settings/fund-account');
            }}
          >
            <p className="text-sm font-medium text-center">
              Activate your subscription to make the funds real
            </p>
          </div>
        )}
        </div>

      {/* USD Allocation Modal */}
      <UsdAllocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        pageId={pageId}
        pageTitle={pageTitle}
        authorId={authorId}
        currentAllocation={allocationState.currentAllocationCents}
        onAllocationChange={(newAllocationCents: number) => {
          setOptimisticAllocation(newAllocationCents);
        }}
      />



    </div>,
    document.body
  );
});

AllocationBar.displayName = 'AllocationBar';

export default AllocationBar;
