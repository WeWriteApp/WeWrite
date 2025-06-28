"use client";
import React, { useState, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import { TokenService } from "../../services/tokenService";
import { Button } from "../ui/button";
import { Plus, Minus, Coins, Share2, Users } from "lucide-react";

import { useFeatureFlag } from "../../utils/feature-flags";
import SubscriptionActivationModal from "./SubscriptionActivationModal";
import SupportUsModal from "./SupportUsModal";
import { getOptimizedUserSubscription } from "../../firebase/optimizedSubscription";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { handleShare } from '../../utils/pageActionHandlers';
import {
  getPagePledgeStats,
  subscribeToPagePledgeStats,
  formatTokenCount,
  formatSponsorCount,
  type PagePledgeStats
} from '../../services/pledgeStatsService';

interface TokenAllocationBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
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

const TokenAllocationBar: React.FC<TokenAllocationBarProps> = ({
  pageId: propPageId,
  pageTitle,
  authorId,
  visible = true,
  onVisibilityChange
}) => {
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

  // Detect mobile for bottom sheet vs modal
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize component
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load user data when user changes
  useEffect(() => {
    // Don't load data if component is not visible
    if (!visible) {
      console.log('🔥 TokenAllocationBar: Skipping data load - component not visible');
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

  // Load pledge stats for page owners
  useEffect(() => {
    // Don't load pledge stats if component is not visible
    if (!visible) {
      console.log('🔥 TokenAllocationBar: Skipping pledge stats load - component not visible');
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
        console.error('TokenAllocationBar: Error loading pledge stats:', error);
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
            console.log('TokenAllocationBar: API response:', balanceData);

            // Extract the balance property from the API response
            setTokenBalance(balanceData.balance);

            if (balanceData.balance) {
              console.log('TokenAllocationBar: Token balance loaded:', balanceData.balance);
              // Load current page allocation only if balance exists
              const allocationResponse = await fetch(`/api/tokens/page-allocation?pageId=${pageId}`);
              if (allocationResponse.ok) {
                const allocationData = await allocationResponse.json();
                setCurrentTokenAllocation(allocationData.currentAllocation);
                console.log('TokenAllocationBar: Current allocation loaded:', allocationData.currentAllocation);
              } else {
                console.warn('TokenAllocationBar: Failed to load page allocation');
              }
            } else {
              console.log('TokenAllocationBar: No token balance found, attempting initialization');
              // Automatically initialize token balance if user has active subscription
              await initializeTokenBalanceIfNeeded(userSubscription);
            }
          } else {
            console.warn('TokenAllocationBar: Balance API request failed:', balanceResponse.status);
            // Automatically initialize token balance if user has active subscription
            await initializeTokenBalanceIfNeeded(userSubscription);
          }
        } catch (error) {
          console.error('TokenAllocationBar: Error loading token balance:', error);
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
    if (!user || !userSubscription || userSubscription.status !== 'active') {
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

  // Handle token allocation changes
  const handleTokenAllocation = async (change: number) => {
    if (!user || !tokenBalance || loading) return;

    // Validate allocation
    const newAllocation = Math.max(0, currentTokenAllocation + change);
    const maxAllocation = tokenBalance.availableTokens + currentTokenAllocation;
    
    if (newAllocation > maxAllocation) {
      console.log('🔥 PledgeBar: Insufficient tokens', {
        newAllocation,
        maxAllocation,
        available: tokenBalance.availableTokens
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/tokens/page-allocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId,
          tokenChange: change
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to allocate tokens');
      }

      const result = await response.json();

      if (result.success) {
        // Update local state with the response data
        setTokenBalance(result.balance);
        setCurrentTokenAllocation(result.currentAllocation);
      } else {
        throw new Error(result.error || 'Failed to allocate tokens');
      }

      // NO SUCCESS TOAST - removed to prevent workflow interruption
    } catch (error) {
      console.error('TokenAllocationBar: Error allocating tokens:', error);
      // No error toast - using console logging instead
    } finally {
      setLoading(false);
    }
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
    console.log('🔥 TokenAllocationBar: Early return due to:', {
      isSubscriptionEnabled,
      pageId,
      pathname
    });
    return null;
  }

  // Don't render if not visible - early return to prevent any initialization
  if (!visible) {
    console.log('🔥 TokenAllocationBar: Early return - component not visible');
    return null;
  }



  // Render logged out state
  if (!user) {
    return (
      <div className="fixed bottom-12 left-8 right-8 z-50 flex justify-center">
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 backdrop-blur-md shadow-lg rounded-xl border border-border/40 p-2">
          <div className="text-center">
            <h3 className="text-sm font-medium mb-2">Support this page</h3>
            <p className="text-xs text-muted-foreground mb-2">
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
      </div>
    );
  }

  // Render non-subscriber state with realistic preview
  // Show inactive UI if no subscription OR if admin testing flag is enabled
  if (!subscription || subscription.status !== 'active' || forceInactiveSubscription) {
    return (
      <div className="fixed bottom-12 left-8 right-8 z-50 flex justify-center">
        <div className="w-full max-w-md mx-auto relative">
          {/* Base Layer: Realistic Active Subscription Preview */}
          <div className="wewrite-card bg-background/95 backdrop-blur-md shadow-lg rounded-xl border border-border/40 p-4">
            {/* Preview of active pledge bar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Monthly Tokens</span>
              </div>
              <span className="text-sm text-muted-foreground">100 available</span>
            </div>

            {/* Token allocation slider preview */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span>Allocated to this page</span>
                <span>25 tokens</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>

            {/* Preview stats */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Supporting 4 pages</span>
              <span>75 tokens remaining</span>
            </div>
          </div>

          {/* Overlay Layer: Activation Prompt */}
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <div className="text-center p-4">
              {/* Admin testing indicator */}
              {forceInactiveSubscription && (
                <div className="mb-2 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs rounded-md">
                  Admin Testing Mode
                </div>
              )}
              <h3 className="text-lg font-semibold mb-2">Start Supporting Creators</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isSubscriptionEnabled
                  ? "Subscribe to get monthly tokens and support your favorite writers"
                  : "Help us keep WeWrite running"
                }
              </p>
              <Button
                size="lg"
                onClick={handleActivateSubscription}
                className="w-full shadow-lg"
              >
                {isSubscriptionEnabled ? "Activate Subscription" : "Support Us"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }



  // For page owners, render page management tools instead of pledge controls
  if (isPageOwner) {
    return (
      <div className="fixed bottom-12 left-8 right-8 z-50 flex justify-center">
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-border/40 p-2">

          {/* Page Owner Tools */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Page Management</span>
            </div>

            {/* Share Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (pageId && pageTitle) {
                  handleShare(
                    { id: pageId, title: pageTitle, username: user?.displayName || user?.email },
                    pageTitle,
                    user
                  );
                }
              }}
              className="flex items-center gap-1"
            >
              <Share2 className="h-3 w-3" />
              Share
            </Button>
          </div>

          {/* Stats Display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Sponsors</span>
              </div>
              <div className="text-lg font-semibold">
                {pledgeStats ? pledgeStats.sponsorCount : '...'}
              </div>
            </div>

            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Coins className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Pledged</span>
              </div>
              <div className="text-lg font-semibold">
                {pledgeStats ? formatTokenCount(pledgeStats.totalPledgedTokens) : '...'}
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-3 text-center">
            <p className="text-xs text-muted-foreground">
              {pledgeStats && pledgeStats.sponsorCount > 0
                ? `${formatSponsorCount(pledgeStats.sponsorCount)} supporting this page`
                : 'No sponsors yet'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state while checking/initializing token balance
  if (!tokenBalance) {
    return (
      <div className="fixed bottom-12 left-8 right-8 z-50 flex justify-center">
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 backdrop-blur-md shadow-lg rounded-xl border border-border/40 p-2">
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
      </div>
    );
  }

  const totalTokens = tokenBalance.totalTokens || 0;
  const allocatedTokens = tokenBalance.allocatedTokens || 0;
  const availableTokens = tokenBalance.availableTokens || 0;
  const otherPagesTokens = allocatedTokens - currentTokenAllocation;

  // Calculate percentages for progress bar
  const currentPagePercentage = totalTokens > 0 ? (currentTokenAllocation / totalTokens) * 100 : 0;
  const otherPagesPercentage = totalTokens > 0 ? (otherPagesTokens / totalTokens) * 100 : 0;
  const availablePercentage = totalTokens > 0 ? (availableTokens / totalTokens) * 100 : 0;

  return (
    <>
      <div className="fixed bottom-12 left-8 right-8 z-50 flex justify-center">
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-border/40 p-2">

          {/* Top row: Minus button + Token allocation bar + Plus button */}
          <div className="flex items-center gap-2 mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTokenAllocation(-1)}
              disabled={loading || currentTokenAllocation <= 0}
              className="h-10 w-10 p-0 flex-shrink-0"
            >
              <Minus className="h-5 w-5" />
            </Button>

            {/* Token allocation composition bar */}
            <TooltipProvider>
              <div
                className="flex-1 bg-muted/50 h-10 rounded-md overflow-hidden border border-border/20 shadow-inner cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => setShowDetailedBreakdown(true)}
              >
                <div className="h-full flex">
                  {/* Other pages segment (left - dark grey) */}
                  {otherPagesPercentage > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="h-full bg-gradient-to-r from-slate-600 to-slate-500 transition-all duration-500 cursor-pointer hover:from-slate-700 hover:to-slate-600"
                          style={{ width: `${otherPagesPercentage}%` }}
                        >
                          {otherPagesPercentage > 12 && (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-xs font-medium text-white drop-shadow-sm">
                                {otherPagesTokens}
                              </span>
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">Other Pages</p>
                        <p>{otherPagesTokens} tokens allocated</p>
                        <p className="text-xs text-muted-foreground">
                          {otherPagesPercentage.toFixed(1)}% of monthly allocation
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Current page segment (center) */}
                  {currentPagePercentage > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/90 transition-all duration-500 cursor-pointer hover:from-primary/90 hover:to-primary"
                          style={{ width: `${currentPagePercentage}%` }}
                        >
                          {currentPagePercentage > 12 && (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-xs font-medium text-white drop-shadow-sm">
                                {currentTokenAllocation}
                              </span>
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">This Page</p>
                        <p>{currentTokenAllocation} tokens allocated</p>
                        <p className="text-xs text-muted-foreground">
                          {currentPagePercentage.toFixed(1)}% of monthly allocation
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Available segment (right) */}
                  {availablePercentage > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="h-full bg-gradient-to-r from-muted/60 to-muted/40 transition-all duration-500 cursor-pointer hover:from-muted/70 hover:to-muted/50"
                          style={{ width: `${availablePercentage}%` }}
                        >
                          {availablePercentage > 15 && (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-xs font-medium text-muted-foreground drop-shadow-sm">
                                {availableTokens}
                              </span>
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">Available</p>
                        <p>{availableTokens} tokens remaining</p>
                        <p className="text-xs text-muted-foreground">
                          {availablePercentage.toFixed(1)}% of monthly allocation
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </TooltipProvider>

            <Button
              size="sm"
              onClick={() => handleTokenAllocation(1)}
              disabled={loading || availableTokens <= 0}
              className="h-10 w-10 p-0 flex-shrink-0"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Bottom row: Page allocation display */}
          <div className="text-center">
            <span className="text-sm font-medium text-primary">
              {currentTokenAllocation} tokens per month
            </span>
          </div>
        </div>
      </div>

      {/* Token Allocation Breakdown Modal/Sheet */}
      {isMobile ? (
        <Sheet open={showDetailedBreakdown} onOpenChange={setShowDetailedBreakdown}>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>Token Allocation Breakdown</SheetTitle>
            </SheetHeader>
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                {/* Pie Chart */}
                <div className="h-64 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'This Page',
                            value: currentTokenAllocation,
                            color: 'hsl(var(--primary))',
                            description: pageTitle || 'Current page'
                          },
                          ...(otherPagesTokens > 0 ? [{
                            name: 'Other Pages',
                            value: otherPagesTokens,
                            color: '#64748b',
                            description: 'All other allocations'
                          }] : []),
                          {
                            name: 'Available',
                            value: availableTokens,
                            color: 'hsl(var(--muted-foreground))',
                            description: 'Unallocated tokens'
                          }
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {[
                          {
                            name: 'This Page',
                            value: currentTokenAllocation,
                            color: 'hsl(var(--primary))',
                            description: pageTitle || 'Current page'
                          },
                          ...(otherPagesTokens > 0 ? [{
                            name: 'Other Pages',
                            value: otherPagesTokens,
                            color: '#64748b',
                            description: 'All other allocations'
                          }] : []),
                          {
                            name: 'Available',
                            value: availableTokens,
                            color: 'hsl(var(--muted-foreground))',
                            description: 'Unallocated tokens'
                          }
                        ].filter(item => item.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend
                        formatter={(value, entry) => `${value}: ${entry.payload.value} tokens`}
                        wrapperStyle={{ fontSize: '14px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Breakdown */}
                <div className="space-y-3">
                  {/* Current Page */}
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border-theme-light">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-primary rounded"></div>
                      <div>
                        <p className="font-medium">This Page</p>
                        <p className="text-sm text-muted-foreground">{pageTitle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{currentTokenAllocation} tokens</p>
                      <p className="text-sm text-muted-foreground">
                        {totalTokens > 0 ? ((currentTokenAllocation / totalTokens) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Other Pages */}
                  {otherPagesTokens > 0 && (
                    <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border-theme-light">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-slate-600 rounded"></div>
                        <div>
                          <p className="font-medium">Other Pages</p>
                          <p className="text-sm text-muted-foreground">All other allocations</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{otherPagesTokens} tokens</p>
                        <p className="text-sm text-muted-foreground">
                          {totalTokens > 0 ? ((otherPagesTokens / totalTokens) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Available */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border-theme-light">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-muted rounded"></div>
                      <div>
                        <p className="font-medium">Available</p>
                        <p className="text-sm text-muted-foreground">Unallocated tokens</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{availableTokens} tokens</p>
                      <p className="text-sm text-muted-foreground">
                        {totalTokens > 0 ? ((availableTokens / totalTokens) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between p-3 bg-background border-theme-strong rounded-lg">
                    <div>
                      <p className="font-semibold">Monthly Total</p>
                      <p className="text-sm text-muted-foreground">Your subscription allocation</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">{totalTokens} tokens</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={showDetailedBreakdown} onOpenChange={setShowDetailedBreakdown}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Token Allocation Breakdown</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Pie Chart */}
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: 'This Page',
                          value: currentTokenAllocation,
                          color: 'hsl(var(--primary))',
                          description: pageTitle || 'Current page'
                        },
                        ...(otherPagesTokens > 0 ? [{
                          name: 'Other Pages',
                          value: otherPagesTokens,
                          color: '#64748b',
                          description: 'All other allocations'
                        }] : []),
                        {
                          name: 'Available',
                          value: availableTokens,
                          color: 'hsl(var(--muted-foreground))',
                          description: 'Unallocated tokens'
                        }
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {[
                        {
                          name: 'This Page',
                          value: currentTokenAllocation,
                          color: 'hsl(var(--primary))',
                          description: pageTitle || 'Current page'
                        },
                        ...(otherPagesTokens > 0 ? [{
                          name: 'Other Pages',
                          value: otherPagesTokens,
                          color: '#64748b',
                          description: 'All other allocations'
                        }] : []),
                        {
                          name: 'Available',
                          value: availableTokens,
                          color: 'hsl(var(--muted-foreground))',
                          description: 'Unallocated tokens'
                        }
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value, entry) => `${value}: ${entry.payload.value} tokens`}
                      wrapperStyle={{ fontSize: '14px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-3">
                {/* Current Page */}
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border-theme-light">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-primary rounded"></div>
                    <div>
                      <p className="font-medium">This Page</p>
                      <p className="text-sm text-muted-foreground">{pageTitle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{currentTokenAllocation} tokens</p>
                    <p className="text-sm text-muted-foreground">
                      {totalTokens > 0 ? ((currentTokenAllocation / totalTokens) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                {/* Other Pages */}
                {otherPagesTokens > 0 && (
                  <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border-theme-light">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-slate-600 rounded"></div>
                      <div>
                        <p className="font-medium">Other Pages</p>
                        <p className="text-sm text-muted-foreground">All other allocations</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{otherPagesTokens} tokens</p>
                      <p className="text-sm text-muted-foreground">
                        {totalTokens > 0 ? ((otherPagesTokens / totalTokens) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                )}

                {/* Available */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border-theme-light">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-muted rounded"></div>
                    <div>
                      <p className="font-medium">Available</p>
                      <p className="text-sm text-muted-foreground">Unallocated tokens</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{availableTokens} tokens</p>
                    <p className="text-sm text-muted-foreground">
                      {totalTokens > 0 ? ((availableTokens / totalTokens) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-3 bg-background border-theme-strong rounded-lg">
                  <div>
                    <p className="font-semibold">Monthly Total</p>
                    <p className="text-sm text-muted-foreground">Your subscription allocation</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg">{totalTokens} tokens</p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modals */}
      {isMounted && createPortal(
        <SubscriptionActivationModal
          isOpen={showActivationModal}
          onClose={() => setShowActivationModal(false)}
          isSignedIn={!!user}
        />,
        document.body
      )}

      {isMounted && createPortal(
        <SupportUsModal
          isOpen={showSupportUsModal}
          onClose={() => setShowSupportUsModal(false)}
        />,
        document.body
      )}
    </>
  );
};

export default TokenAllocationBar;
