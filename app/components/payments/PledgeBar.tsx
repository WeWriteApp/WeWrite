"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from '../../providers/AuthProvider';
import { Button } from "../ui/button";
import { Plus, Minus } from "lucide-react";
import { cn } from "../../lib/utils";
import { isActiveSubscription } from "../../utils/subscriptionStatus";
import {
  getLoggedOutUsdBalance,
  allocateLoggedOutUsd,
  getLoggedOutPageAllocation,
} from "../../utils/simulatedUsd";
import { formatUsdCents } from '../../utils/formatCurrency';
import { UsdAllocationModal } from './UsdAllocationModal';
import { useDelayedLoginBanner } from '../../hooks/useDelayedLoginBanner';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';

interface PledgeBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  className?: string;
}

interface UsdBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
  lastUpdated: Date;
}

interface Subscription {
  id: string;
  status: string;
  amount: number;
  tier: string;
}

const PledgeBar = React.forwardRef<HTMLDivElement, PledgeBarProps>(({
  pageId: propPageId,
  pageTitle,
  authorId,
  visible = true,
  className,
}, ref) => {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { triggerDelayedBanner } = useDelayedLoginBanner();
  const { usdBalance, updateOptimisticBalance } = useUsdBalance();

  // Scroll detection state
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-detect pageId from URL if not provided
  const pageId = propPageId || (pathname ? pathname.substring(1) : '');

  // Check if current user is the page owner
  const isPageOwner = !!(user && authorId && user.uid === authorId);

  // State
  const [usdBalanceState, setUsdBalanceState] = useState<UsdBalance | null>(null);
  const [currentUsdAllocation, setCurrentUsdAllocation] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageStats, setPageStats] = useState<{
    sponsorCount: number;
    totalPledgedUsdCents: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Load USD data
  useEffect(() => {
    if (!pageId) return;

    const loadUsdData = async () => {
      setIsLoading(true);
      try {
        if (user && user.uid) {
          // Logged-in user - use real USD balance from context
          if (usdBalance) {
            setUsdBalanceState({
              totalUsdCents: usdBalance.totalUsdCents,
              allocatedUsdCents: usdBalance.allocatedUsdCents,
              availableUsdCents: usdBalance.availableUsdCents,
              lastUpdated: new Date()
            });
          }

          // Get current page allocation from API
          try {
            const response = await fetch(`/api/usd/allocate?pageId=${pageId}`);
            if (response.ok) {
              const data = await response.json();
              setCurrentUsdAllocation(data.currentAllocation || 0);
            } else {
              setCurrentUsdAllocation(0);
            }
          } catch (error) {
            console.error('Error fetching page allocation:', error);
            setCurrentUsdAllocation(0);
          }

          setSubscription({ status: 'active', amount: 10, tier: 'tier1', id: 'test' });
        } else {
          // Logged out - use simulated USD
          const balance = getLoggedOutUsdBalance();
          const currentAllocation = getLoggedOutPageAllocation(pageId);

          setUsdBalanceState({
            totalUsdCents: balance.totalUsdCents,
            allocatedUsdCents: balance.allocatedUsdCents,
            availableUsdCents: balance.availableUsdCents,
            lastUpdated: new Date(balance.lastUpdated)
          });
          setCurrentUsdAllocation(currentAllocation);
          setSubscription(null);
        }
      } catch (error) {
        console.error('Error loading USD data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsdData();
  }, [user, pageId, usdBalance]);

  // Handle USD allocation changes
  const handleUsdChange = async (change: number) => {
    if (!pageId || isPageOwner) return;

    setIsRefreshing(true);
    const newAllocation = Math.max(0, currentUsdAllocation + change);
    const previousAllocation = currentUsdAllocation;
    const previousBalance = usdBalanceState;

    // Optimistic update - update both allocation and balance state
    setCurrentUsdAllocation(newAllocation);

    // Update balance state to reflect the change in total allocated amount
    if (usdBalanceState) {
      const newAllocatedUsdCents = usdBalanceState.allocatedUsdCents + change;
      setUsdBalanceState({
        ...usdBalanceState,
        allocatedUsdCents: newAllocatedUsdCents,
        availableUsdCents: usdBalanceState.totalUsdCents - newAllocatedUsdCents,
        lastUpdated: new Date()
      });
    }

    try {
      if (user && user.uid) {
        // Logged-in user - use real API
        const response = await fetch('/api/usd/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId,
            usdCentsChange: change
          })
        });

        if (!response.ok) {
          throw new Error('Failed to allocate USD');
        }

        // Update the global USD balance context
        updateOptimisticBalance(change);
      } else {
        // Logged-out user - use simulated USD
        const success = allocateLoggedOutUsd(pageId, pageTitle || 'Untitled', newAllocation);

        if (!success) {
          // Revert both allocation and balance state on failure
          setCurrentUsdAllocation(previousAllocation);
          if (previousBalance) {
            setUsdBalanceState(previousBalance);
          }
        } else {
          // Trigger delayed login banner for logged-out users
          triggerDelayedBanner();
        }
      }
    } catch (error) {
      console.error('Error allocating USD:', error);
      // Revert both allocation and balance state on error
      setCurrentUsdAllocation(previousAllocation);
      if (previousBalance) {
        setUsdBalanceState(previousBalance);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle pledge bar click
  const handlePledgeBarClick = () => {
    if (!user && !isPageOwner) {
      router.push('/');
    } else {
      setIsModalOpen(true);
    }
  };

  // Don't show if not visible or no pageId
  if (!visible || !pageId) return null;

  // Don't show pledge bar when viewing your own page
  if (isPageOwner) return null;

  // Calculate USD data - FIXED LOGIC
  const totalUsdCents = usdBalanceState?.totalUsdCents || 0;
  const allocatedUsdCents = usdBalanceState?.allocatedUsdCents || 0;

  // Other pages spending stays constant (doesn't change when THIS page allocation changes)
  const otherPagesUsdCents = Math.max(0, allocatedUsdCents - currentUsdAllocation);

  // Available funds = total - other pages - current page (gets squeezed when THIS increases)
  const availableUsdCents = totalUsdCents - otherPagesUsdCents - currentUsdAllocation;

  // Calculate percentages for composition bar
  const otherPagesPercentage = totalUsdCents > 0 ? (otherPagesUsdCents / totalUsdCents) * 100 : 0;
  const currentPagePercentage = totalUsdCents > 0 ? (currentUsdAllocation / totalUsdCents) * 100 : 0;
  const availablePercentage = totalUsdCents > 0 ? Math.max(0, (availableUsdCents / totalUsdCents) * 100) : 0;

  // User state checks
  const isOutOfFunds = availableUsdCents <= 0 && totalUsdCents > 0 && !isPageOwner;
  const hasSubscription = subscription && isActiveSubscription(subscription.status);
  const showSubscriptionNotice = user && !hasSubscription && !isPageOwner;
  const showLoginNotice = !user && !isPageOwner;

  // USD increment amount (25 cents = $0.25)
  const incrementAmount = 25;

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
        data-pledge-bar
        onClick={handlePledgeBarClick}
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
            <div className="flex items-center gap-3">
              {isLoading ? (
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentUsdAllocation > 0) {
                        handleUsdChange(-incrementAmount);
                      }
                    }}
                    className={cn(
                      "h-8 w-8 p-0",
                      currentUsdAllocation <= 0 && "opacity-50",
                      isRefreshing && "opacity-75"
                    )}
                    disabled={currentUsdAllocation <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>

                  {/* Composition Bar */}
                  <div className={cn(
                    "flex-1 rounded-lg h-12 flex gap-1 p-1",
                    isOutOfFunds ? "bg-orange-500/20" : "bg-muted"
                  )}>
                    {/* Always show composition - even when out of funds */}
                    <>
                      {/* Other pages */}
                      {otherPagesPercentage > 0 && (
                        <div
                          className="h-full bg-muted-foreground/30 rounded-md"
                          style={{ width: `${otherPagesPercentage}%` }}
                        />
                      )}

                      {/* Current page */}
                      {currentPagePercentage > 0 && (
                        <div
                          className={cn(
                            "h-full rounded-md",
                            isOutOfFunds ? "bg-orange-500" : "bg-primary"
                          )}
                          style={{ width: `${currentPagePercentage}%` }}
                        />
                      )}

                      {/* Available/Remaining - just dotted border, no background fill */}
                      {availablePercentage > 0 && (
                        <div
                          className="h-full rounded-md border-2 border-dashed border-muted-foreground/30"
                          style={{ width: `${availablePercentage}%` }}
                        />
                      )}
                    </>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isOutOfFunds) {
                        handleUsdChange(incrementAmount);
                      }
                    }}
                    className={cn(
                      "h-8 w-8 p-0",
                      isOutOfFunds && "opacity-50",
                      isRefreshing && "opacity-75"
                    )}
                    disabled={isOutOfFunds}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* USD Text - Only show for non-page owners */}
          {!isPageOwner && (
            <div className="text-center">
              <span className={cn(
                "font-medium text-sm",
                isOutOfFunds ? "text-orange-500" : "text-primary"
              )}>
                {isOutOfFunds
                  ? "You're out of funds"
                  : `${formatUsdCents(currentUsdAllocation)} pledged per month`
                }
              </span>
            </div>
          )}
        </div>

        {/* Warning Banners */}
        {/* Login Notice */}
        {showLoginNotice && (
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-b-2xl cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
            onClick={handlePledgeBarClick}
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
        currentAllocation={currentUsdAllocation}
        onAllocationChange={(newAllocationCents: number) => {
          const changeCents = newAllocationCents - currentUsdAllocation;
          handleUsdChange(changeCents);
        }}
      />
    </div>,
    document.body
  );
});

PledgeBar.displayName = 'PledgeBar';

export default PledgeBar;
