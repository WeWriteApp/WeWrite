"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Button } from "../ui/button";
import { Plus, Minus } from "lucide-react";
import { cn } from "../../lib/utils";
import { useFeatureFlag } from "../../utils/feature-flags";
import { getOptimizedUserSubscription } from "../../firebase/optimizedSubscription";
import { isActiveSubscription } from "../../utils/subscriptionStatus";

import {
  getLoggedOutTokenBalance,
  allocateLoggedOutTokens,
  getLoggedOutPageAllocation
} from "../../utils/simulatedTokens";
import { TokenAllocationModal } from './TokenAllocationModal';
import { useTokenIncrement } from '../../contexts/TokenIncrementContext';

interface PledgeBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  className?: string;
}

interface TokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
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
  const { currentAccount } = useCurrentAccount();
  const pathname = usePathname();
  const router = useRouter();
  const { incrementAmount } = useTokenIncrement();

  // Scroll detection state
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-detect pageId from URL if not provided
  const pageId = propPageId || (pathname ? pathname.substring(1) : '');

  // Check if current user is the page owner
  const isPageOwner = !!(currentAccount && authorId && currentAccount.uid === authorId);

  // Feature flags
  const isSubscriptionEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);
  
  // State
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [currentTokenAllocation, setCurrentTokenAllocation] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allocationsData, setAllocationsData] = useState<Array<{
    pageId: string;
    pageTitle: string;
    authorUsername: string;
    tokens: number;
  }>>([]);
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  const [lastUserAction, setLastUserAction] = useState<number>(0);
  const [pageStats, setPageStats] = useState<{
    sponsorCount: number;
    totalPledgedTokens: number;
  } | null>(null);

  // Scroll detection effect
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollThreshold = 100; // Minimum scroll distance to trigger hide/show

      if (Math.abs(currentScrollY - lastScrollY) < scrollThreshold) {
        return; // Don't update for small scroll movements
      }

      if (currentScrollY > lastScrollY && currentScrollY > 200) {
        // Scrolling down and past initial threshold - hide
        setIsHidden(true);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show
        setIsHidden(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Load token data
  useEffect(() => {
    if (!pageId) return;

    const loadTokenData = async () => {
      try {
        if (currentAccount && currentAccount.uid && isSubscriptionEnabled) {
          // Logged in user with payments enabled
          const userSubscription = await getOptimizedUserSubscription(currentAccount.uid);
          setSubscription(userSubscription as any);

          // Load actual token allocations data
          const allocationsResponse = await fetch('/api/tokens/allocations');
          if (allocationsResponse.ok) {
            const allocationsData = await allocationsResponse.json();
            console.log('🎯 PledgeBar: Loaded allocations data', allocationsData);

            if (allocationsData.success) {
              // Set real token balance from API
              const balance = allocationsData.summary.balance;
              const actualAllocatedTokens = allocationsData.summary.totalTokensAllocated || 0;

              if (balance) {
                setTokenBalance({
                  totalTokens: balance.totalTokens,
                  allocatedTokens: actualAllocatedTokens, // Use the calculated total from summary
                  availableTokens: balance.totalTokens - actualAllocatedTokens,
                  lastUpdated: new Date(balance.lastUpdated)
                });
              } else {
                // Default balance if no subscription yet, but still use actual allocated tokens
                setTokenBalance({
                  totalTokens: 100,
                  allocatedTokens: actualAllocatedTokens,
                  availableTokens: 100 - actualAllocatedTokens,
                  lastUpdated: new Date()
                });
              }

              // Set allocations data for modal
              const mappedAllocations = allocationsData.allocations.map((allocation: any) => ({
                pageId: allocation.pageId,
                pageTitle: allocation.pageTitle,
                authorUsername: allocation.authorUsername,
                tokens: allocation.tokens
              }));
              console.log('🎯 PledgeBar: Setting allocations data for modal', {
                originalAllocations: allocationsData.allocations,
                mappedAllocations,
                totalTokensAllocated: allocationsData.summary.totalTokensAllocated
              });
              setAllocationsData(mappedAllocations);

              // Find current page allocation
              const currentPageAllocation = allocationsData.allocations.find(
                (allocation: any) => allocation.pageId === pageId
              );
              setCurrentTokenAllocation(currentPageAllocation ? currentPageAllocation.tokens : 0);
            } else {
              // No allocations yet - set default values
              setTokenBalance({
                totalTokens: 100,
                allocatedTokens: 0,
                availableTokens: 100,
                lastUpdated: new Date()
              });
              setCurrentTokenAllocation(0);
              setAllocationsData([]);
            }
          } else {
            console.log('🎯 PledgeBar: Allocations response not ok', allocationsResponse.status);
            // Fallback to basic token balance
            setTokenBalance({
              totalTokens: 100,
              allocatedTokens: 0,
              availableTokens: 100,
              lastUpdated: new Date()
            });
            setCurrentTokenAllocation(0);
            setAllocationsData([]);
          }
        } else {
          // Logged out or no payments - use unfunded tokens
          const balance = getLoggedOutTokenBalance();
          const currentAllocation = getLoggedOutPageAllocation(pageId);

          setTokenBalance({
            totalTokens: balance.totalTokens,
            allocatedTokens: balance.allocatedTokens,
            availableTokens: balance.availableTokens,
            lastUpdated: new Date(balance.lastUpdated)
          });
          setCurrentTokenAllocation(currentAllocation);
          setSubscription(null);

          // Set allocations data from unfunded tokens for modal
          setAllocationsData(balance.allocations.map(allocation => ({
            pageId: allocation.pageId,
            pageTitle: allocation.pageTitle,
            authorUsername: 'Unknown', // Unfunded tokens don't have author info
            tokens: allocation.tokens
          })));
        }

        // Load page stats for page owners
        if (isPageOwner) {
          try {
            const statsResponse = await fetch(`/api/tokens/page-stats?pageId=${pageId}`);
            if (statsResponse.ok) {
              const statsData = await statsResponse.json();
              console.log('🎯 PledgeBar: Loaded page stats for owner', statsData);

              if (statsData.success) {
                setPageStats({
                  sponsorCount: statsData.data.sponsorCount,
                  totalPledgedTokens: statsData.data.totalPledgedTokens
                });
              }
            }
          } catch (error) {
            console.error('Error loading page stats:', error);
          }
        }
      } catch (error) {
        console.error('Error loading token data:', error);
      }
    };

    loadTokenData();
  }, [currentAccount, pageId, isSubscriptionEnabled, isPageOwner]);

  // Handle token allocation changes
  const handleTokenChange = async (change: number) => {
    if (!pageId || isPageOwner) return;

    const newAllocation = Math.max(0, currentTokenAllocation + change);
    const actionTimestamp = Date.now();

    // Store previous state for potential rollback
    const previousAllocation = currentTokenAllocation;
    const previousBalance = tokenBalance;
    const previousAllocationsData = allocationsData;

    // Track this user action to prevent server overrides
    setLastUserAction(actionTimestamp);
    setPendingUpdates(prev => new Set(prev).add(pageId));

    // OPTIMISTIC UPDATE - Update UI immediately for better UX
    setCurrentTokenAllocation(newAllocation);

    // Update token balance optimistically
    if (tokenBalance) {
      const optimisticBalance = {
        ...tokenBalance,
        allocatedTokens: tokenBalance.allocatedTokens + change,
        availableTokens: tokenBalance.availableTokens - change,
        lastUpdated: new Date()
      };
      setTokenBalance(optimisticBalance);
    }

    // Update allocations data optimistically
    const optimisticAllocationsData = allocationsData.map(allocation =>
      allocation.pageId === pageId
        ? { ...allocation, tokens: newAllocation }
        : allocation
    );

    // If this is a new allocation (current page not in list), add it
    if (!allocationsData.some(allocation => allocation.pageId === pageId) && newAllocation > 0) {
      optimisticAllocationsData.push({
        pageId,
        pageTitle: pageTitle || 'Current Page',
        authorUsername: 'Unknown',
        tokens: newAllocation
      });
    }

    // Remove allocation if tokens are 0
    const filteredAllocationsData = optimisticAllocationsData.filter(allocation =>
      allocation.pageId !== pageId || allocation.tokens > 0
    );

    setAllocationsData(filteredAllocationsData);

    try {
      if (currentAccount && currentAccount.uid && isSubscriptionEnabled) {
        // Real token allocation - make API call to save to database
        const response = await fetch('/api/tokens/page-allocation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageId: pageId,
            tokenChange: change
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to allocate tokens');
        }

        const result = await response.json();
        console.log('✅ PledgeBar: Token allocation successful', result);

        // Refresh allocations data to get accurate server state (but don't clear the UI)
        const allocationsResponse = await fetch('/api/tokens/allocations');
        if (allocationsResponse.ok) {
          const allocationsData = await allocationsResponse.json();
          console.log('🎯 PledgeBar: Refreshed allocations after change', allocationsData);

          if (allocationsData.success) {
            // Check if this update is recent enough to respect user input
            const timeSinceUserAction = Date.now() - actionTimestamp;
            const shouldRespectUserInput = timeSinceUserAction < 2000; // 2 seconds

            // Only update current allocation if user hasn't made recent changes
            if (!shouldRespectUserInput) {
              setCurrentTokenAllocation(result.currentAllocation || newAllocation);
            }

            // Update allocations data for modal (always safe to update)
            setAllocationsData(allocationsData.allocations.map((allocation: any) => ({
              pageId: allocation.pageId,
              pageTitle: allocation.pageTitle,
              authorUsername: allocation.authorUsername,
              tokens: allocation.tokens
            })));

            // Update token balance with the most current data
            const balance = allocationsData.summary.balance;
            const actualAllocatedTokens = allocationsData.summary.totalTokensAllocated || 0;

            if (balance) {
              setTokenBalance({
                totalTokens: balance.totalTokens,
                allocatedTokens: actualAllocatedTokens,
                availableTokens: balance.totalTokens - actualAllocatedTokens,
                lastUpdated: new Date(balance.lastUpdated)
              });
            }

            // Clear pending update for this page
            setPendingUpdates(prev => {
              const newSet = new Set(prev);
              newSet.delete(pageId);
              return newSet;
            });
          }
        }
      } else {
        // Unfunded token allocation for logged-out users
        const success = allocateLoggedOutTokens(pageId, pageTitle || 'Untitled', newAllocation);

        if (!success) {
          // Revert optimistic updates if unfunded allocation failed
          setCurrentTokenAllocation(previousAllocation);
          if (previousBalance) {
            setTokenBalance(previousBalance);
          }
          setAllocationsData(previousAllocationsData);

          // Clear pending update for this page
          setPendingUpdates(prev => {
            const newSet = new Set(prev);
            newSet.delete(pageId);
            return newSet;
          });
          return;
        }

        // Update unfunded token balance with actual data
        const updatedBalance = getLoggedOutTokenBalance();
        setTokenBalance({
          totalTokens: updatedBalance.totalTokens,
          allocatedTokens: updatedBalance.allocatedTokens,
          availableTokens: updatedBalance.availableTokens,
          lastUpdated: new Date(updatedBalance.lastUpdated)
        });

        // Update allocations data from unfunded tokens for modal
        setAllocationsData(updatedBalance.allocations.map(allocation => ({
          pageId: allocation.pageId,
          pageTitle: allocation.pageTitle,
          authorUsername: 'Unknown', // Unfunded tokens don't have author info
          tokens: allocation.tokens
        })));

        // Clear pending update for this page
        setPendingUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(pageId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error allocating tokens:', error);
      // Revert optimistic updates on error
      setCurrentTokenAllocation(previousAllocation);
      if (previousBalance) {
        setTokenBalance(previousBalance);
      }
      setAllocationsData(previousAllocationsData);

      // Clear pending update for this page
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageId);
        return newSet;
      });
    }
  };

  // Handle subscription navigation
  const handleSubscriptionClick = () => {
    router.push('/settings/subscription');
  };

  // Don't show if not visible or no pageId
  if (!visible || !pageId) return null;

  // Calculate token data with correct math
  const totalTokens = tokenBalance?.totalTokens || 0;
  const allocatedTokens = tokenBalance?.allocatedTokens || 0;

  // Calculate other pages tokens: total allocated minus current page allocation
  // Ensure it's never negative
  const otherPagesTokens = Math.max(0, allocatedTokens - currentTokenAllocation);

  // Calculate available tokens: total minus all allocations (other + current)
  const totalUsedTokens = otherPagesTokens + currentTokenAllocation;
  const availableTokens = Math.max(0, totalTokens - totalUsedTokens);

  // Calculate percentages for composition bar (order: other, this, available)
  const otherPagesPercentage = totalTokens > 0 ? (otherPagesTokens / totalTokens) * 100 : 0;
  const currentPagePercentage = totalTokens > 0 ? (currentTokenAllocation / totalTokens) * 100 : 0;
  const availablePercentage = totalTokens > 0 ? (availableTokens / totalTokens) * 100 : 0;

  // Determine user state for notices
  const hasSubscription = subscription && isActiveSubscription(subscription.status);
  const showSubscriptionNotice = currentAccount && !hasSubscription && isSubscriptionEnabled && !isPageOwner;
  const showLoginNotice = !currentAccount && !isPageOwner;

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
        onClick={() => setIsModalOpen(true)}
      >
        {/* Main Content */}
        <div className={cn(
          "space-y-4",
          isPageOwner ? "p-3" : "p-4" // Reduced padding for page owners
        )}>
          {/* Page Stats for Page Owners - Compact Version */}
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
                      {pageStats.totalPledgedTokens}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Tokens
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">
                    Loading...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Token Controls */}
          {!isPageOwner && (
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTokenChange(-incrementAmount);
                }}
                disabled={currentTokenAllocation <= 0}
                className="h-8 w-8 p-0"
              >
                <Minus className="h-4 w-4" />
              </Button>

              {/* Composition Bar */}
              <div className="flex-1 bg-muted rounded-lg h-12 flex gap-1 p-1">
                {/* Other pages */}
                {otherPagesPercentage > 0 && (
                  <div
                    className="h-full bg-muted-foreground/30 rounded flex items-center justify-center"
                    style={{ width: `${otherPagesPercentage}%`, minWidth: '20px' }}
                  >
                    <span className="text-white font-medium text-xs">
                      {Math.round(otherPagesTokens)}
                    </span>
                  </div>
                )}

                {/* Current page */}
                {currentPagePercentage > 0 && (
                  <div
                    className="h-full bg-primary rounded flex items-center justify-center"
                    style={{ width: `${currentPagePercentage}%`, minWidth: '20px' }}
                  >
                    <span className="text-white font-medium text-xs">
                      {Math.round(currentTokenAllocation)}
                    </span>
                  </div>
                )}

                {/* Available */}
                {availablePercentage > 0 && (
                  <div
                    className="h-full bg-muted-foreground/10 rounded flex items-center justify-center"
                    style={{ width: `${availablePercentage}%`, minWidth: '20px' }}
                  >
                    <span className="text-muted-foreground font-medium text-xs">
                      {Math.round(availableTokens)}
                    </span>
                  </div>
                )}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTokenChange(incrementAmount);
                }}
                disabled={availableTokens <= 0}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Token Text - Only show for non-page owners */}
          {!isPageOwner && (
            <div className="text-center">
              <span className="font-medium text-primary text-sm">
                {currentTokenAllocation} tokens pledged per month
              </span>
            </div>
          )}
        </div>

        {/* Warning Banners - MOVED TO BOTTOM */}
        {/* Login Notice */}
        {showLoginNotice && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-b-2xl">
            <p className="text-sm font-medium text-center">
              Log in to begin allocating tokens
            </p>
          </div>
        )}

        {/* Subscription Notice */}
        {showSubscriptionNotice && (
          <div
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-b-2xl cursor-pointer hover:from-orange-600 hover:to-orange-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleSubscriptionClick();
            }}
          >
            <p className="text-sm font-medium text-center">
              Start your subscription to support writers
            </p>
          </div>
        )}
      </div>

      {/* Token Allocation Modal */}
      <TokenAllocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userState={
          !currentAccount
            ? 'logged-out'
            : !hasSubscription
              ? 'no-subscription'
              : 'with-subscription'
        }
        tokenData={{
          totalTokens,
          allocatedTokens,
          availableTokens,
          currentPageAllocation: currentTokenAllocation,
          otherPagesTokens,
          pageTitle: pageTitle || 'Untitled'
        }}
        allocations={allocationsData}
        onTokenChange={handleTokenChange}
        isPageOwner={isPageOwner}
        pageId={pageId}
      />
    </div>,
    document.body
  );
});

PledgeBar.displayName = 'PledgeBar';

export default PledgeBar;
