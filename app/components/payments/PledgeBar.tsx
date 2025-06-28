"use client";
import React, { useState, useEffect, useContext, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import { TokenService } from "../../services/tokenService";
import { Button } from "../ui/button";
import { Plus, Minus, DollarSign, Users, AlertTriangle, AlertCircle, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

import { useFeatureFlag } from "../../utils/feature-flags";
import SubscriptionActivationModal from "./SubscriptionActivationModal";
import SupportUsModal from "./SupportUsModal";
import { getOptimizedUserSubscription } from "../../firebase/optimizedSubscription";
import { isActiveSubscription } from "../../utils/subscriptionStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

import {
  getPagePledgeStats,
  subscribeToPagePledgeStats,
  formatTokenCount,
  formatSponsorCount,
  type PagePledgeStats
} from '../../services/pledgeStatsService';
import {
  validatePledgeBudget,
  type BudgetValidationResult
} from '../../services/pledgeBudgetService';
import PledgeBarExceededBudget from './PledgeBarExceededBudget';

interface PledgeBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  debugColors?: boolean;
  className?: string;
  [key: string]: any; // Allow data attributes
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
  onVisibilityChange,
  debugColors = false,
  className,
  ...props
}, ref) => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();

  // Auto-detect pageId from URL if not provided
  const pageId = propPageId || pathname.substring(1);

  // Check if current user is the page owner
  const isPageOwner = user && authorId && user.uid === authorId;

  // Feature flags
  const isSubscriptionEnabled = useFeatureFlag('payments', user?.email, user?.uid);
  // Token system is now always enabled (no longer a feature flag)

  // Admin testing flag to force inactive subscription UI
  const forceInactiveSubscription = useFeatureFlag('inactive_subscription', user?.email, user?.uid);

  // Helper function to check if subscription allows token allocation
  const canAllocateTokens = (subscription: any) => {
    if (!subscription) return false;
    if (forceInactiveSubscription) return false;

    // Use the enhanced subscription status check that considers cancellation period
    return isActiveSubscription(
      subscription.status,
      subscription.cancelAtPeriodEnd,
      subscription.currentPeriodEnd
    );
  };

  // State management
  const [loading, setLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [currentTokenAllocation, setCurrentTokenAllocation] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showSupportUsModal, setShowSupportUsModal] = useState(false);
  const [pledgeStats, setPledgeStats] = useState<PagePledgeStats | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [budgetValidation, setBudgetValidation] = useState<BudgetValidationResult | null>(null);
  const [showBudgetWarning, setShowBudgetWarning] = useState(false);
  const [showPledgeManagement, setShowPledgeManagement] = useState(false);

  // Optimistic UI state
  const [pendingChanges, setPendingChanges] = useState(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const baseAllocationRef = useRef<number>(0); // Track the server-confirmed allocation

  // Helper functions for segment selection
  const handleSegmentClick = (segmentName: string) => {
    if (selectedSegment === segmentName) {
      setSelectedSegment(null); // Deselect if clicking the same segment
    } else {
      setSelectedSegment(segmentName); // Select new segment
    }
  };

  const getSegmentOpacity = (segmentName: string) => {
    if (!selectedSegment) return 1; // No selection, all segments full opacity
    return selectedSegment === segmentName ? 1 : 0.3; // Selected segment full, others dimmed
  };



  // Initialize component
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Debug logging for test mode - MOVED AFTER STATE DECLARATIONS TO AVOID TEMPORAL DEAD ZONE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const testModeValue = localStorage.getItem('admin-inactive-subscription-test');
      console.log('[PledgeBar] Debug - localStorage test mode value:', testModeValue);
      console.log('[PledgeBar] Debug - forceInactiveSubscription:', forceInactiveSubscription);
      console.log('[PledgeBar] Debug - subscription status:', subscription?.status);
      console.log('[PledgeBar] Debug - canAllocateTokens:', canAllocateTokens(subscription));
    }
  }, [forceInactiveSubscription, subscription]);

  // Load user data when user changes
  useEffect(() => {
    // Don't load data if component is not visible
    if (!visible) {
      return;
    }

    if (user && isSubscriptionEnabled && pageId) {
      loadUserData();
    } else {
      setTokenBalance(null);
      setSubscription(null);
      setCurrentTokenAllocation(0);
    }
  }, [user, isSubscriptionEnabled, pageId, isPageOwner, visible]);

  // Validate budget when subscription or user changes
  useEffect(() => {
    if (user && isSubscriptionEnabled) {
      const validateBudget = async () => {
        try {
          const validation = await validatePledgeBudget(user.uid);
          setBudgetValidation(validation);
          setShowBudgetWarning(validation.isOverBudget);
        } catch (error) {
          console.error('Error validating pledge budget:', error);
        }
      };

      validateBudget();
    } else {
      setBudgetValidation(null);
      setShowBudgetWarning(false);
    }
  }, [user, subscription, isSubscriptionEnabled]);



  // Load pledge stats for page owners
  useEffect(() => {
    // Don't load pledge stats if component is not visible
    if (!visible) {
      return;
    }

    if (!isPageOwner || !pageId) return;

    let unsubscribe: (() => void) | null = null;

    const loadPledgeStats = async () => {
      try {
        // Get initial stats
        const stats = await getPagePledgeStats(pageId);
        setPledgeStats(stats);

        // Subscribe to real-time updates
        unsubscribe = subscribeToPagePledgeStats(pageId, (updatedStats) => {
          setPledgeStats(updatedStats);
        });
      } catch (error) {
        console.error('PledgeBar: Error loading pledge stats:', error);
      }
    };

    loadPledgeStats();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isPageOwner, pageId, visible]);

  // Load user subscription and token data with automatic initialization
  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load subscription
      const userSubscription = await getOptimizedUserSubscription(user.uid);
      setSubscription(userSubscription);

      // Skip token loading for page owners (they can't pledge to their own pages)
      if (!isPageOwner) {
        // Try to load existing token balance using API
        try {
          const balanceResponse = await fetch('/api/tokens/balance');
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();

            // Extract the balance property from the API response
            setTokenBalance(balanceData.balance);

            if (balanceData.balance) {
              // Load current page allocation only if balance exists
              const allocationResponse = await fetch(`/api/tokens/page-allocation?pageId=${pageId}`);
              if (allocationResponse.ok) {
                const allocationData = await allocationResponse.json();
                setCurrentTokenAllocation(allocationData.currentAllocation);
                baseAllocationRef.current = allocationData.currentAllocation;
              }
            } else {
              // Automatically initialize token balance if user has active subscription
              await initializeTokenBalanceIfNeeded(userSubscription);
            }
          } else {
            console.warn('PledgeBar: Balance API request failed:', balanceResponse.status);
            // Automatically initialize token balance if user has active subscription
            await initializeTokenBalanceIfNeeded(userSubscription);
          }
        } catch (error) {
          console.error('PledgeBar: Error loading token balance:', error);
          // Automatically initialize token balance if user has active subscription
          await initializeTokenBalanceIfNeeded(userSubscription);
        }
      } // End of !isPageOwner check

    } catch (error) {
      console.error('PledgeBar: Error loading user data:', error);
    }
  };

  // Automatically initialize token balance for users with active subscriptions
  const initializeTokenBalanceIfNeeded = async (userSubscription: any) => {
    if (!user || !canAllocateTokens(userSubscription)) {
      return;
    }

    try {
      setIsInitializing(true);

      // Use API endpoint for token initialization to avoid permission issues
      const response = await fetch('/api/tokens/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'initialize',
          subscriptionAmount: userSubscription.amount
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize token balance: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.balance) {
        setTokenBalance(result.balance);

        // Load current page allocation using API
        const allocationResponse = await fetch(`/api/tokens/page-allocation?pageId=${pageId}`);
        if (allocationResponse.ok) {
          const allocationData = await allocationResponse.json();
          setCurrentTokenAllocation(allocationData.currentAllocation);
          baseAllocationRef.current = allocationData.currentAllocation;
        }
      } else {
        throw new Error(result.error || 'Failed to initialize token balance');
      }
    } catch (error) {
      console.error('PledgeBar: Error auto-initializing token balance:', error);
      // If initialization fails, we'll just show the loading state
      // The user can try refreshing the page or the system will retry later
    } finally {
      setIsInitializing(false);
    }
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced database update function
  const debouncedDatabaseUpdate = useCallback(async (finalAllocation: number) => {
    if (!user || !canAllocateTokens(subscription) || !tokenBalance) return;

    try {
      // Calculate the total change needed to reach the final allocation
      // Use the base allocation (server-confirmed) as the baseline
      const totalChange = finalAllocation - baseAllocationRef.current;

      const response = await fetch('/api/tokens/page-allocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId,
          tokenChange: totalChange
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to allocate tokens');
      }

      const result = await response.json();

      if (result.success) {
        // Update token balance and base allocation reference
        setTokenBalance(result.balance);
        baseAllocationRef.current = result.currentAllocation;

        // Only update currentTokenAllocation if there's a significant discrepancy
        // This prevents the "jumping numbers" issue while allowing for corrections
        if (Math.abs(result.currentAllocation - currentTokenAllocation) > 0.1) {
          console.warn('PledgeBar: Server allocation differs from optimistic state', {
            server: result.currentAllocation,
            optimistic: currentTokenAllocation
          });
          setCurrentTokenAllocation(result.currentAllocation);
        }

        setPendingChanges(0); // Clear pending changes after successful update
      } else {
        throw new Error(result.error || 'Failed to allocate tokens');
      }
    } catch (error) {
      console.error('PledgeBar: Error allocating tokens:', error);
      // Revert optimistic update on error - go back to server-confirmed allocation
      setCurrentTokenAllocation(baseAllocationRef.current);
      setPendingChanges(0);
    }
  }, [user, subscription, tokenBalance, pageId, currentTokenAllocation, pendingChanges]);

  // Handle token allocation changes with optimistic UI
  const handleTokenAllocation = (change: number) => {
    if (!user) return;

    // For non-subscribers or inactive subscriptions, handle allocation locally without persisting to database
    if (!canAllocateTokens(subscription)) {
      const newAllocation = Math.max(0, Math.min(100, currentTokenAllocation + change));
      setCurrentTokenAllocation(newAllocation);
      return;
    }

    // For active subscribers, validate against actual token balance
    if (!tokenBalance) return;

    // Calculate new allocation - use current displayed value for immediate feedback
    const newAllocation = Math.max(0, currentTokenAllocation + change);
    const maxAllocation = tokenBalance.availableTokens + currentTokenAllocation;

    if (newAllocation > maxAllocation) {
      return;
    }

    // Update UI immediately (optimistic update) - this is the source of truth for display
    setCurrentTokenAllocation(newAllocation);

    // Track the cumulative pending changes for the API call
    setPendingChanges(prev => prev + change);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for database update
    debounceTimerRef.current = setTimeout(() => {
      debouncedDatabaseUpdate(newAllocation);
    }, 700);
  };

  // Handle subscription activation
  const handleActivateSubscription = () => {
    if (isSubscriptionEnabled) {
      router.push('/settings/subscription');
    } else {
      setShowSupportUsModal(true);
      setShowActivationModal(false);
    }
  };

  // Don't render if feature flags not enabled or no pageId
  if (!isSubscriptionEnabled || !pageId) {
    return null;
  }

  // Don't render if not visible - early return to prevent any initialization
  if (!visible) {
    return null;
  }



  // Show sign-in prompt for logged out users
  if (!user) {
    return (
      <div className={cn(
        "w-full max-w-2xl mx-auto rounded-2xl shadow-2xl p-4",
        debugColors
          ? "bg-blue-500 border-2 border-blue-300"
          : "bg-background/80 backdrop-blur-xl border border-white/20"
      )}>
        <div className="text-center">
          <h3 className="text-base font-medium mb-3">Support this page</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Sign in to allocate tokens and support creators
          </p>
          <Button
            size="sm"
            onClick={() => router.push('/auth/signin')}
            className="w-full"
          >
            Sign In to Support
          </Button>
        </div>
      </div>
    );
  }







  // For page owners, render page management tools instead of pledge controls
  if (isPageOwner) {
    return (
      <div className={cn(
        "w-full max-w-2xl mx-auto rounded-2xl shadow-2xl p-4",
        debugColors
          ? "bg-blue-500 border-2 border-blue-300"
          : "bg-background/80 backdrop-blur-xl border border-white/20 dark:border-white/10 hover:shadow-3xl hover:bg-background/85",
        className
      )}>



        {/* Stats Display */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-background/40 backdrop-blur-sm border border-white/10 dark:border-white/5 rounded-xl shadow-sm">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sponsors</span>
            </div>
            <div className="text-lg font-semibold">
              {pledgeStats ? pledgeStats.sponsorCount : '...'}
            </div>
          </div>

          <div className="text-center p-3 sm:p-4 bg-background/40 backdrop-blur-sm border border-white/10 dark:border-white/5 rounded-xl shadow-sm">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Pledged</span>
            </div>
            <div className="text-lg font-semibold">
              {pledgeStats ? formatTokenCount(pledgeStats.totalPledgedTokens) : '...'}
            </div>
          </div>
        </div>


      </div>
    );
  }

  // Show loading state
  if (!tokenBalance) {
    return (
      <div className="w-full max-w-2xl mx-auto mb-6 px-4 bg-background/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4">
        <div className="text-center">
          <div className="animate-pulse mb-3">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2 mx-auto"></div>
          </div>
          <div className="text-xs text-muted-foreground">
            {isInitializing ? "Setting up your token balance..." : "Loading token balance..."}
          </div>
        </div>
      </div>
    );
  }

  // Use preview data for non-subscribers, real data for subscribers
  const effectiveTokenBalance = !canAllocateTokens(subscription)
    ? {
        totalTokens: 100,
        allocatedTokens: currentTokenAllocation,
        availableTokens: 100 - currentTokenAllocation,
        lastUpdated: new Date()
      }
    : tokenBalance;

  const totalTokens = effectiveTokenBalance.totalTokens || 0;
  const allocatedTokens = effectiveTokenBalance.allocatedTokens || 0;

  // Calculate available tokens using the base allocation to prevent shifts during optimistic updates
  const baseAvailableTokens = effectiveTokenBalance.availableTokens || 0;
  const optimisticChange = currentTokenAllocation - baseAllocationRef.current;
  const availableTokens = Math.max(0, baseAvailableTokens - optimisticChange);

  // Calculate other pages tokens using the base allocation for consistency
  const otherPagesTokens = allocatedTokens - baseAllocationRef.current;

  // Calculate percentages for progress bar using optimistic current allocation
  const currentPagePercentage = totalTokens > 0 ? (currentTokenAllocation / totalTokens) * 100 : 0;
  const otherPagesPercentage = totalTokens > 0 ? (otherPagesTokens / totalTokens) * 100 : 0;
  const availablePercentage = totalTokens > 0 ? (availableTokens / totalTokens) * 100 : 0;

  return (
    <div
      ref={ref}
      className={cn(
        "w-full max-w-2xl mx-auto rounded-2xl shadow-2xl overflow-hidden p-4",
        debugColors
          ? "bg-blue-500 border-2 border-blue-300"
          : "bg-background/80 backdrop-blur-xl border border-white/20",
        className
      )}
      data-pledge-bar
      data-component="pledge-bar-card"
      data-testid="pledge-bar"
      {...props}
    >

        {/* Budget Warning Banner */}
        {showBudgetWarning && budgetValidation && (
            <div
              className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg"
              data-component="budget-warning-banner"
              data-testid="budget-warning-banner"
            >
              <div
                className="flex items-center gap-2 mb-1"
                data-component="budget-warning-header"
                data-testid="budget-warning-header"
              >
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span
                  className="text-sm font-medium text-destructive"
                  data-component="budget-warning-title"
                  data-testid="budget-warning-title"
                >
                  Over Budget
                </span>
              </div>
              <div
                className="text-xs text-muted-foreground mb-2"
                data-component="budget-warning-message"
                data-testid="budget-warning-message"
              >
                Your pledges ({budgetValidation.totalPledges} tokens) exceed your subscription budget ({budgetValidation.subscriptionBudget} tokens).
                {budgetValidation.suspendedPledges.length > 0 && (
                  <span
                    className="block mt-1"
                    data-component="suspended-pledges-count"
                    data-testid="suspended-pledges-count"
                  >
                    {budgetValidation.suspendedPledges.length} pledge{budgetValidation.suspendedPledges.length > 1 ? 's' : ''} suspended.
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/settings/subscription')}
                className="h-6 text-xs"
                data-component="budget-manage-button"
                data-testid="budget-manage-button"
              >
                <Settings className="h-3 w-3 mr-1" />
                Manage
              </Button>
            </div>
          )}

        {/* Horizontal layout: Minus + Bar + Plus */}
        <div
          className="flex items-center justify-center mb-4 w-full"
          style={{
            gap: window?.innerWidth < 640 ? '8px' : '12px',
            minHeight: window?.innerWidth < 640 ? '32px' : '48px'
          }}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTokenAllocation(-1)}
            disabled={currentTokenAllocation <= 0}
            className="p-0 flex-shrink-0 rounded-lg border-2"
            style={{
              height: window?.innerWidth < 640 ? '32px' : '48px',
              width: window?.innerWidth < 640 ? '32px' : '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Minus
              style={{
                height: window?.innerWidth < 640 ? '14px' : '20px',
                width: window?.innerWidth < 640 ? '14px' : '20px'
              }}
            />
          </Button>

          {/* Composition bar */}
          <div
            className="flex-1 bg-muted rounded-lg flex min-w-0"
            style={{
              height: window?.innerWidth < 640 ? '32px' : '48px',
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: '0%'
            }}
          >
            <div
              className="h-full flex flex-1"
              style={{
                gap: window?.innerWidth < 640 ? '2px' : '4px',
                padding: window?.innerWidth < 640 ? '2px' : '4px'
              }}
            >
                  {/* Other pages */}
                  {otherPagesPercentage > 0 && (
                    <div
                      className="h-full bg-muted-foreground/30 rounded flex items-center justify-center"
                      style={{
                        width: `${otherPagesPercentage}%`,
                        minWidth: '20px'
                      }}
                    >
                      <span
                        className="text-white font-medium"
                        style={{
                          fontSize: window?.innerWidth < 640 ? '10px' : '12px',
                          padding: '0 2px'
                        }}
                      >
                        {Math.round(otherPagesTokens)}
                      </span>
                    </div>
                  )}

                  {/* Current page */}
                  {currentPagePercentage > 0 && (
                    <div
                      className="h-full bg-primary rounded flex items-center justify-center"
                      style={{
                        width: `${currentPagePercentage}%`,
                        minWidth: '20px'
                      }}
                    >
                      <span
                        className="text-white font-medium"
                        style={{
                          fontSize: window?.innerWidth < 640 ? '10px' : '12px',
                          padding: '0 2px'
                        }}
                      >
                        {Math.round(currentTokenAllocation)}
                      </span>
                    </div>
                  )}

                  {/* Available */}
                  {availablePercentage > 0 && (
                    <div
                      className="h-full bg-muted-foreground/10 rounded flex items-center justify-center"
                      style={{
                        width: `${availablePercentage}%`,
                        minWidth: '20px'
                      }}
                    >
                      <span
                        className="text-muted-foreground font-medium"
                        style={{
                          fontSize: window?.innerWidth < 640 ? '10px' : '12px',
                          padding: '0 2px'
                        }}
                      >
                        {Math.round(availableTokens)}
                      </span>
                    </div>
                  )}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTokenAllocation(1)}
            disabled={availableTokens <= 0}
            className="p-0 flex-shrink-0 rounded-lg border-2"
            style={{
              height: window?.innerWidth < 640 ? '32px' : '48px',
              width: window?.innerWidth < 640 ? '32px' : '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Plus
              style={{
                height: window?.innerWidth < 640 ? '14px' : '20px',
                width: window?.innerWidth < 640 ? '14px' : '20px'
              }}
            />
          </Button>
        </div>

        {/* Token text below */}
        <div className="text-center">
          <span
            className="font-medium text-primary"
            style={{
              fontSize: window?.innerWidth < 640 ? '12px' : '16px'
            }}
          >
            {currentTokenAllocation} tokens pledged per month
          </span>
        </div>

      {/* Show subscription activation overlay for non-subscribers */}
      {!canAllocateTokens(subscription) && (
        <div className="absolute -top-16 left-0 right-0 z-10 px-4">
          <div className="bg-background/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-xl p-4">
            <div className="text-center">
              <h3 className="text-sm font-semibold mb-1">Start Supporting Creators</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Subscribe to activate your 100 monthly tokens
              </p>
              <Button
                size="sm"
                onClick={handleActivateSubscription}
                className="w-full"
              >
                Activate Subscription
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PledgeBar.displayName = 'PledgeBar';

export default PledgeBar;
