"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from '../../providers/AuthProvider';
import { Button } from "../ui/button";
import { Plus, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

// Removed old optimized subscription import - using API-first approach
import { isActiveSubscription } from "../../utils/subscriptionStatus";

import {
  getLoggedOutTokenBalance,
  allocateLoggedOutTokens,
  getLoggedOutPageAllocation
} from "../../utils/simulatedTokens";
import { TokenAllocationModal } from './TokenAllocationModal';
import { useTokenIncrement } from '../../contexts/TokenIncrementContext';
import { EmbeddedCheckoutService } from '../../services/embeddedCheckoutService';
import { TokenParticleEffect } from '../effects/TokenParticleEffect';
import { useTokenParticleEffect } from '../../hooks/useTokenParticleEffect';
import { PulsingButtonEffect } from '../effects/PulsingButtonEffect';
import { useDelayedLoginBanner } from '../../hooks/useDelayedLoginBanner';
import { toast } from '../ui/use-toast';
import { getNextMonthlyProcessingDate } from '../../utils/subscriptionTiers';

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
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { incrementAmount } = useTokenIncrement();
  const { triggerEffect, originElement, triggerParticleEffect, resetEffect } = useTokenParticleEffect();
  const { showDelayedBanner, triggerDelayedBanner, resetDelayedBanner, isDelayActive } = useDelayedLoginBanner();

  // Function to show token allocation notification
  const showTokenAllocationNotification = (tokenAmount: number) => {
    const nextProcessingDate = getNextMonthlyProcessingDate();
    const formattedDate = nextProcessingDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });

    toast({
      title: `${tokenAmount} token${tokenAmount === 1 ? '' : 's'} allocated!`,
      description: `Your allocation isn't final until ${formattedDate} when monthly processing occurs. You can adjust it anytime before then.`,
      duration: 6000, // Show for 6 seconds
    });
  };

  // Scroll detection state
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Ref for the accent color section (current page token display)
  const accentSectionRef = useRef<HTMLDivElement>(null);

  // State for springy click animation
  const [isPlusSpringAnimating, setIsPlusSpringAnimating] = useState(false);
  const [isMinusSpringAnimating, setIsMinusSpringAnimating] = useState(false);

  // Function to trigger spring animation
  const triggerPlusSpringAnimation = () => {
    setIsPlusSpringAnimating(true);
    setTimeout(() => setIsPlusSpringAnimating(false), 200); // Animation duration
  };

  const triggerMinusSpringAnimation = () => {
    setIsMinusSpringAnimating(true);
    setTimeout(() => setIsMinusSpringAnimating(false), 200); // Animation duration
  };

  // Ref for the plus button (for pulsing effect)
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-detect pageId from URL if not provided
  const pageId = propPageId || (pathname ? pathname.substring(1) : '');

  // Reset delayed banner when user logs in or navigates away
  useEffect(() => {
    if (user) {
      resetDelayedBanner();
    }
  }, [user, resetDelayedBanner]);

  // Reset delayed banner on page navigation
  useEffect(() => {
    resetDelayedBanner();
  }, [pathname, resetDelayedBanner]);

  // Check if current user is the page owner
  const isPageOwner = !!(user && authorId && user.uid === authorId);

  // Subscription feature is now always enabled
  const isSubscriptionEnabled = true;
  
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

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      setIsLoading(true);
      try {
        if (user && user.uid && isSubscriptionEnabled) {
          // Use fast optimized endpoint for immediate UI response
          const pledgeBarResponse = await fetch(`/api/tokens/pledge-bar-data?pageId=${pageId}`);

          if (pledgeBarResponse.ok) {
            const pledgeData = await pledgeBarResponse.json();

            if (pledgeData.success) {
              // Set token balance immediately
              setTokenBalance(pledgeData.data.tokenBalance);
              setCurrentTokenAllocation(pledgeData.data.currentPageAllocation);

              // Set basic subscription status
              setSubscription(pledgeData.data.hasSubscription ? { status: 'active' } : null);

              // UI is now responsive - set loading to false
              setIsLoading(false);

              // Load additional data in background for modal and detailed info
              Promise.all([
                fetch('/api/account-subscription'),
                fetch('/api/tokens/allocations')
              ]).then(async ([subscriptionResponse, allocationsResponse]) => {
                // Update subscription with full data
                if (subscriptionResponse.ok) {
                  const subscriptionData = await subscriptionResponse.json();
                  setSubscription(subscriptionData.hasSubscription ? subscriptionData.fullData : null);
                }

                // Update allocations data for modal
                if (allocationsResponse.ok) {
                  const allocationsData = await allocationsResponse.json();
                  if (allocationsData.success) {
                    setAllocationsData(allocationsData.allocations.map((allocation: any) => ({
                      pageId: allocation.pageId,
                      pageTitle: allocation.pageTitle,
                      authorUsername: allocation.authorUsername,
                      tokens: allocation.tokens
                    })));

                    // Update token balance with more accurate data
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
                  }
                }
              }).catch(error => {
                console.warn('Background data loading failed:', error);
              });
            } else {
              // Fast endpoint failed, fall back to old method
              setIsLoading(false);
              setTokenBalance({
                totalTokens: 0,
                allocatedTokens: 0,
                availableTokens: 0,
                lastUpdated: new Date()
              });
              setCurrentTokenAllocation(0);
            }
          } else {
            // Fast endpoint failed, fall back to old method
            setIsLoading(false);
            console.warn('Fast pledge bar endpoint failed, using fallback');
            setTokenBalance({
              totalTokens: 100,
              allocatedTokens: 0,
              availableTokens: 100,
              lastUpdated: new Date()
            });
            setCurrentTokenAllocation(0);
          }
        } else {
          // Logged out or no payments - use unfunded tokens (fast, no API calls)
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

          setIsLoading(false); // Fast for logged-out users
        }


      } catch (error) {
        console.error('Error loading token data:', error);
        setIsLoading(false); // Ensure loading state is cleared on error
      }
    };

    loadTokenData();
  }, [user, pageId, isSubscriptionEnabled]);

  // Handle token allocation changes
  const handleTokenChange = async (change: number) => {
    if (!pageId) return;

    // Don't block on isRefreshing - allow rapid clicks for true optimistic updates
    // Set refreshing for visual feedback but don't block subsequent clicks
    setIsRefreshing(true);

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
      if (user && user.uid && isSubscriptionEnabled) {
        // Debug authentication state
        console.log('[PledgeBar] Making API call with auth state:', {
          hasCurrentAccount: !!user,
          currentAccountUid: user?.uid,
          isSubscriptionEnabled,
          pageId,
          tokenChange: change
        });

        // Real token allocation - make API call to save to database
        // Use pending allocations system for proper earnings tracking
        const response = await fetch('/api/tokens/pending-allocations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientUserId: authorId, // The page owner who will receive the tokens
            resourceType: 'page',
            resourceId: pageId,
            tokens: Math.max(0, currentTokenAllocation + change) // New total allocation
          })
        });

        console.log('[PledgeBar] API response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[PledgeBar] API error:', errorData);

          // If the error is about insufficient tokens but user has a subscription,
          // try to initialize/sync the token balance
          if (errorData.error?.includes('Insufficient tokens') && subscription && subscription.amount > 0) {
            console.log('[PledgeBar] Attempting to initialize token balance for user with subscription');
            try {
              const initResponse = await fetch('/api/tokens/balance', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'initialize',
                  subscriptionAmount: subscription.amount
                })
              });

              if (initResponse.ok) {
                console.log('[PledgeBar] Token balance initialized, retrying allocation');
                // Retry the original allocation
                const retryResponse = await fetch('/api/tokens/pending-allocations', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    recipientUserId: authorId,
                    resourceType: 'page',
                    resourceId: pageId,
                    tokens: Math.max(0, currentTokenAllocation + change)
                  })
                });

                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  console.log('[PledgeBar] Retry successful:', retryData);
                  // Continue with success handling
                  const allocationsData = retryData;

                  if (allocationsData.success) {
                    // Don't override optimistic UI state - it's already been set

                    // Update allocations data for modal
                    if (allocationsData.allocations) {
                      setAllocationsData(allocationsData.allocations.map((allocation: any) => ({
                        pageId: allocation.pageId,
                        pageTitle: allocation.pageTitle,
                        authorUsername: allocation.authorUsername,
                        tokens: allocation.tokens
                      })));
                    }

                    // Update token balance with the most current data
                    // Only update if this response is for the current user action
                    if (Date.now() - actionTimestamp < 5000) { // Within 5 seconds of user action
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
                    }

                    // Clear pending update for this page
                    setPendingUpdates(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(pageId);
                      return newSet;
                    });
                    setIsRefreshing(false);
                    return; // Exit successfully
                  }
                }
              }
            } catch (initError) {
              console.error('[PledgeBar] Token balance initialization failed:', initError);
            }
          }

          throw new Error(errorData.error || 'Failed to allocate tokens');
        }

        const result = await response.json();
        console.log('✅ PledgeBar: Token allocation successful', result);

        // Show notification for token allocation (only for positive changes)
        if (change > 0) {
          showTokenAllocationNotification(Math.abs(change));
        }

        // Handle successful allocation
        // Don't override optimistic UI state - it's already been set

        // Refresh allocations data to get accurate server state
        const allocationsResponse = await fetch('/api/tokens/allocations');
        if (allocationsResponse.ok) {
          const allocationsData = await allocationsResponse.json();
          console.log('🎯 PledgeBar: Refreshed allocations after change', allocationsData);

          if (allocationsData.success) {
            // Update allocations data for modal
            setAllocationsData(allocationsData.allocations.map((allocation: any) => ({
              pageId: allocation.pageId,
              pageTitle: allocation.pageTitle,
              authorUsername: allocation.authorUsername,
              tokens: allocation.tokens
            })));

            // Update token balance with the most current data
            // Only update if this response is for the current user action
            if (Date.now() - actionTimestamp < 5000) { // Within 5 seconds of user action
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
            }

            // Clear pending update for this page
            setPendingUpdates(prev => {
              const newSet = new Set(prev);
              newSet.delete(pageId);
              return newSet;
            });
            setIsRefreshing(false);
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
          setIsRefreshing(false);
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
        setIsRefreshing(false);
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
      setIsRefreshing(false);
    }
  };

  // Handle subscription navigation
  const handleSubscriptionClick = () => {
    router.push('/settings/subscription');
  };

  // Handle pledge bar click - redirect to landing page if not logged in
  const handlePledgeBarClick = () => {
    if (!user) {
      // Redirect to landing page for logged-out users
      router.push('/');
    } else if (availableTokens <= 0) {
      // Redirect to spend-tokens page if out of tokens
      router.push('/settings/spend-tokens');
    } else {
      // Open modal for logged-in users
      setIsModalOpen(true);
    }
  };

  // Don't show if not visible or no pageId
  if (!visible || !pageId) return null;

  // Don't show pledge bar on user's own pages
  if (isPageOwner) return null;

  // Calculate token data with correct math
  const totalTokens = tokenBalance?.totalTokens || 0;
  const allocatedTokens = tokenBalance?.allocatedTokens || 0;

  // Calculate other pages tokens: total allocated minus current page allocation
  // Allow negative values to show overspending
  const otherPagesTokens = Math.max(0, allocatedTokens - currentTokenAllocation);

  // Calculate available tokens: total minus all allocations (other + current)
  const totalUsedTokens = otherPagesTokens + currentTokenAllocation;
  const availableTokens = totalTokens - totalUsedTokens;

  // Debug token calculations
  console.log('[PledgeBar] Token calculations:', {
    tokenBalance,
    totalTokens,
    allocatedTokens,
    currentTokenAllocation,
    otherPagesTokens,
    totalUsedTokens,
    availableTokens,
    hasSubscription: subscription && isActiveSubscription(subscription.status),
    subscription,
    isSubscriptionEnabled,
    buttonDisabled: availableTokens <= 0 || isRefreshing
  });

  // Calculate percentages for composition bar (order: other, this, available)
  const otherPagesPercentage = totalTokens > 0 ? (otherPagesTokens / totalTokens) * 100 : 0;
  const currentPagePercentage = totalTokens > 0 ? (currentTokenAllocation / totalTokens) * 100 : 0;
  const availablePercentage = totalTokens > 0 ? (availableTokens / totalTokens) * 100 : 0;

  // Check if user is out of tokens
  const isOutOfTokens = availableTokens <= 0 && totalTokens > 0;

  // Determine user state for notices
  const hasSubscription = subscription && isActiveSubscription(subscription.status);
  const showSubscriptionNotice = user && !hasSubscription && isSubscriptionEnabled;
  const showLoginNotice = !user;

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
        <div className="space-y-4 p-4">

          {/* Token Controls */}
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

                      // Trigger spring animation
                      triggerMinusSpringAnimation();

                      // Only allow minus if we have tokens to remove
                      if (currentTokenAllocation > 0) {
                        handleTokenChange(-incrementAmount);
                      }
                    }}
                    className={`h-8 w-8 p-0 transition-transform duration-200 ${
                      isMinusSpringAnimating
                        ? 'animate-[spring_0.2s_cubic-bezier(0.68,-0.55,0.265,1.55)]'
                        : ''
                    } ${currentTokenAllocation <= 0 ? 'opacity-50' : ''}`}
                    disabled={false} // Make truly optimistic - never disable
                  >
                    <Minus className="h-4 w-4" />
                  </Button>

              {/* Composition Bar */}
              <div className={cn(
                "flex-1 rounded-lg h-12 flex gap-1 p-1",
                isOutOfTokens ? "bg-orange-500/20" : "bg-muted"
              )}>
                {isOutOfTokens ? (
                  /* Out of tokens state - single orange bar */
                  <div className="h-full bg-orange-500 rounded-md flex items-center justify-center w-full">
                    <span className="text-white font-medium text-xs">
                      Out of tokens
                    </span>
                  </div>
                ) : (
                  /* Normal token allocation display */
                  <>
                    {/* Other pages */}
                    {otherPagesPercentage > 0 && (
                      <div
                        className="h-full bg-muted-foreground/30 rounded-md flex items-center justify-center"
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
                        ref={accentSectionRef}
                        className="h-full bg-primary rounded-md flex items-center justify-center"
                        style={{ width: `${currentPagePercentage}%`, minWidth: '20px' }}
                      >
                        <span className="text-white font-medium text-xs">
                          {Math.round(currentTokenAllocation)}
                        </span>
                      </div>
                    )}

                    {/* Available/Unfunded */}
                    {availablePercentage > 0 && (
                      <div
                        className="h-full bg-muted-foreground/10 rounded-md flex items-center justify-center"
                        style={{ width: `${availablePercentage}%`, minWidth: '20px' }}
                      >
                        <span className="text-muted-foreground font-medium text-xs">
                          {Math.round(Math.abs(availableTokens))}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

                  <Button
                    ref={plusButtonRef}
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();

                      // Trigger spring animation
                      triggerPlusSpringAnimation();

                      if (isOutOfTokens) {
                        // Redirect to subscription page when out of tokens
                        router.push('/settings/subscription');
                      } else if (!user) {
                        // Enhanced logged-out user experience
                        // 1. Trigger particle effect to show visual feedback
                        if (accentSectionRef.current) {
                          triggerParticleEffect(accentSectionRef.current);
                        }
                        // 2. Allow simulated token allocation to appear to work
                        handleTokenChange(incrementAmount);
                        // 3. Trigger delayed login banner after particle effect completes
                        triggerDelayedBanner();
                      } else {
                        // Normal authenticated user flow
                        if (accentSectionRef.current) {
                          triggerParticleEffect(accentSectionRef.current);
                        }
                        handleTokenChange(incrementAmount);
                      }
                    }}
                    className={`h-8 w-8 p-0 transition-transform duration-200 ${
                      isPlusSpringAnimating
                        ? 'animate-[spring_0.2s_cubic-bezier(0.68,-0.55,0.265,1.55)]'
                        : ''
                    }`}
                    disabled={false} // Make truly optimistic - never disable
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

          {/* Token Text */}
          <div className="text-center">
            <span className={cn(
              "font-medium text-sm",
              isOutOfTokens ? "text-orange-500" : "text-primary"
            )}>
              {isOutOfTokens
                ? "You're out of tokens"
                : `${currentTokenAllocation} tokens pledged per month`
              }
            </span>
          </div>
        </div>

        {/* Warning Banners - MOVED TO BOTTOM */}
        {/* Enhanced Login Notice - Only show delayed banner, not initial notice */}
        {showDelayedBanner && !user && (
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 text-white p-3 rounded-b-2xl cursor-pointer hover:from-green-600 hover:to-green-700 transition-all duration-200 login-banner-slide-up"
            onClick={handlePledgeBarClick}
          >
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
          !user
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

      {/* Particle Effect */}
      <TokenParticleEffect
        trigger={triggerEffect}
        originElement={originElement}
        onComplete={resetEffect}
        particleCount={12}
        duration={1000}
        maxDistance={80}
      />

      {/* Pulsing Button Effect for Logged-Out Users */}
      <PulsingButtonEffect
        targetElement={plusButtonRef.current}
        isActive={!user && !isDelayActive && !showDelayedBanner}
      />
    </div>,
    document.body
  );
});

PledgeBar.displayName = 'PledgeBar';

export default PledgeBar;
