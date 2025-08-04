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
import { AllocationAmountDisplay } from './AllocationAmountDisplay';
import { useDelayedLoginBanner } from '../../hooks/useDelayedLoginBanner';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { useAllocationState } from '../../hooks/useAllocationState';
import { useAllocationActions } from '../../hooks/useAllocationActions';
import {
  FloatingAllocationBarProps,
  PageStats,
  Subscription,
  CompositionBarData
} from '../../types/allocation';

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

  // Scroll detection state
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-detect pageId from URL if not provided
  const pageId = propPageId || (pathname ? pathname.substring(1) : '');

  // Check if current user is the page owner
  const isPageOwner = !!(user && authorId && user.uid === authorId);

  // State for floating bar specific features
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageStats, setPageStats] = useState<PageStats | null>(null);

  // Use our new shared hooks
  const { allocationState, setOptimisticAllocation } = useAllocationState({
    pageId,
    enabled: !isPageOwner && !!pageId
  });

  const { handleAllocationChange, isProcessing } = useAllocationActions({
    pageId,
    authorId: authorId || '',
    pageTitle: pageTitle || '',
    currentAllocationCents: allocationState.currentAllocationCents,
    source: 'FloatingBar',
    onOptimisticUpdate: setOptimisticAllocation
  });

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

  // Load subscription data when component mounts or user changes
  useEffect(() => {
    const loadSubscriptionData = async () => {
      try {
        if (user && user.uid) {
          // For now, set a default subscription - this should come from an API
          setSubscription({ status: 'active', amount: 10, tier: 'tier1', id: 'test' });
        } else {
          setSubscription(null);
        }
      } catch (error) {
        console.error('Error loading subscription data:', error);
      }
    };

    loadSubscriptionData();
  }, [user]);

  // Calculate composition bar data
  const getCompositionData = (): CompositionBarData => {
    if (!usdBalance) {
      return {
        otherPagesPercentage: 0,
        currentPagePercentage: 0,
        availablePercentage: 100,
        isOutOfFunds: false
      };
    }

    const totalCents = usdBalance.totalUsdCents;
    const allocatedCents = usdBalance.allocatedUsdCents;
    const availableCents = usdBalance.availableUsdCents;

    const otherPagesCents = Math.max(0, allocatedCents - allocationState.currentAllocationCents);
    const isOutOfFunds = availableCents <= 0 && totalCents > 0;

    // Calculate percentages for composition bar
    const otherPagesPercentage = totalCents > 0 ? (otherPagesCents / totalCents) * 100 : 0;
    const currentPagePercentage = totalCents > 0 ? (allocationState.currentAllocationCents / totalCents) * 100 : 0;
    const availablePercentage = totalCents > 0 ? Math.max(0, (availableCents / totalCents) * 100) : 0;

    return {
      otherPagesPercentage,
      currentPagePercentage,
      availablePercentage,
      isOutOfFunds
    };
  };

  const compositionData = getCompositionData();

  // Handle allocation bar click
  const handleAllocationBarClick = () => {
    if (!user && !isPageOwner) {
      router.push('/');
    } else {
      setIsModalOpen(true);
    }
  };

  // Don't show if not visible or no pageId
  if (!visible || !pageId) return null;

  // Don't show allocation bar when viewing your own page
  if (isPageOwner) return null;

  // User state checks
  const hasSubscription = subscription && isActiveSubscription(subscription.status);
  const showSubscriptionNotice = user && !hasSubscription && !isPageOwner;
  const showLoginNotice = !user && !isPageOwner;

  return createPortal(
    <div
      className={cn(
        "fixed left-0 right-0 bottom-6 z-50 flex justify-center px-4",
        "transition-transform duration-300 ease-in-out",
        isHidden ? "translate-y-[calc(100%+2rem)]" : "translate-y-0"
      )}
    >
      <div
        ref={ref}
        className={cn(
          "relative w-full max-w-md shadow-2xl overflow-hidden rounded-2xl",
          "bg-background/90 backdrop-blur-xl border border-white/20",
          className
        )}
        data-allocation-bar
        onClick={handleAllocationBarClick}
      >
        {/* Main Content */}
        <div className={cn(
          "space-y-4",
          isPageOwner ? "p-3" : "p-4"
        )}>
          {/* Page Stats for Page Owners */}
          {isPageOwner && (
            <div>
              {pageStats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-muted/30 rounded-lg">
                    <div className="text-xl font-bold text-primary">
                      {pageStats.sponsorCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pageStats.sponsorCount === 1 ? 'Supporter' : 'Supporters'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-muted/30 rounded-lg">
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
              />

              {/* Out of funds message */}
              {compositionData.isOutOfFunds && (
                <div className="text-center text-sm text-orange-500 font-medium">
                  Out of funds
                </div>
              )}

              {/* Simple variant with quick amount buttons */}
              {variant === 'simple' ? (
                <div className="flex items-center justify-center">
                  <div className="flex items-center space-x-2">
                    {/* Quick amount buttons */}
                    {[25, 50, 100, 250].map((cents) => (
                      <Button
                        key={cents}
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAllocationChange(cents / allocationIntervalCents, e);
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
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const decreaseAmount = Math.min(allocationState.currentAllocationCents, 25);
                          handleAllocationChange(-decreaseAmount / allocationIntervalCents, e);
                        }}
                        disabled={isProcessing}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
              <div className="flex items-center gap-3">
              {allocationState.isLoading ? (
                <div className="flex items-center gap-3 w-full">
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-md"></div>
                  <div className="flex-1 h-12 bg-muted animate-pulse rounded-lg"></div>
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-md"></div>
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleAllocationChange(-1, e)}
                    className={cn(
                      "h-8 w-8 p-0",
                      allocationState.currentAllocationCents <= 0 && "opacity-50",
                      isProcessing && "opacity-75"
                    )}
                    disabled={allocationState.currentAllocationCents <= 0 || isProcessing}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>

                  {/* Composition Bar */}
                  <div className={cn(
                    "flex-1 rounded-lg h-12 flex gap-1 p-1",
                    compositionData.isOutOfFunds ? "bg-orange-500/20" : "bg-muted"
                  )}>
                    {/* Always show composition - even when out of funds */}
                    <>
                      {/* Other pages */}
                      {compositionData.otherPagesPercentage > 0 && (
                        <div
                          className="h-full bg-muted-foreground/30 rounded-md transition-all duration-300 ease-out"
                          style={{ width: `${compositionData.otherPagesPercentage}%` }}
                        />
                      )}

                      {/* Current page */}
                      {compositionData.currentPagePercentage > 0 && (
                        <div
                          className={cn(
                            "h-full rounded-md transition-all duration-300 ease-out",
                            compositionData.isOutOfFunds ? "bg-orange-500" : "bg-primary"
                          )}
                          style={{ width: `${compositionData.currentPagePercentage}%` }}
                        />
                      )}

                      {/* Available/Remaining */}
                      {compositionData.availablePercentage > 0 && (
                        <div
                          className="h-full bg-muted-foreground/10 rounded-md transition-all duration-300 ease-out"
                          style={{ width: `${compositionData.availablePercentage}%` }}
                        />
                      )}
                    </>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (compositionData.isOutOfFunds) {
                        router.push('/settings/fund-account');
                      } else {
                        handleAllocationChange(1, e);
                      }
                    }}
                    className={cn(
                      "h-8 w-8 p-0",
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

        {/* Warning Banners */}
        {/* Login Notice */}
        {showLoginNotice && (
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-b-2xl cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
            onClick={handleAllocationBarClick}
          >
            <p className="text-sm font-medium text-center">
              Log in to begin allocating funds
            </p>
          </div>
        )}

        {/* Subscription Notice */}
        {showSubscriptionNotice && (
          <div
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-b-2xl cursor-pointer hover:from-orange-600 hover:to-orange-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/settings/fund-account');
            }}
          >
            <p className="text-sm font-medium text-center">
              Fund your account to support writers
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
