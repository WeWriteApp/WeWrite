"use client";
import React, { useState, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import { TokenService } from "../../services/tokenService";
import { Button } from "../ui/button";
import { Plus, Minus, ChevronDown, ChevronUp, Coins, Settings } from "lucide-react";
import { useToast } from "../ui/use-toast";
import SubscriptionActivationModal from "./SubscriptionActivationModal";
import SupportUsModal from "./SupportUsModal";
import { useFeatureFlag } from "../../utils/feature-flags";
import { getOptimizedUserSubscription } from "../../firebase/optimizedSubscription";

interface TokenPledgeBarProps {
  pageId: string;
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

const TokenPledgeBar: React.FC<TokenPledgeBarProps> = ({
  pageId,
  pageTitle,
  authorId,
  visible = true,
  onVisibilityChange
}) => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const { toast } = useToast();
  
  // Feature flags
  const isSubscriptionEnabled = useFeatureFlag('payments');
  
  // State management
  const [loading, setLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [currentTokenAllocation, setCurrentTokenAllocation] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showSupportUsModal, setShowSupportUsModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize component
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load user data when user changes
  useEffect(() => {
    if (user && isSubscriptionEnabled) {
      loadUserData();
    } else {
      setTokenBalance(null);
      setSubscription(null);
      setCurrentTokenAllocation(0);
    }
  }, [user, isSubscriptionEnabled]);

  // Load user subscription and token data
  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load subscription
      const userSubscription = await getOptimizedUserSubscription(user.uid);
      setSubscription(userSubscription);

      // Load token balance
      const balance = await TokenService.getTokenBalance(user.uid);
      setTokenBalance(balance);

      // Load current page allocation
      const allocation = await TokenService.getCurrentPageAllocation(user.uid, pageId);
      setCurrentTokenAllocation(allocation);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Handle token allocation changes
  const handleTokenAllocation = async (change: number) => {
    if (!user || !tokenBalance || loading) return;

    // Validate allocation
    const newAllocation = Math.max(0, currentTokenAllocation + change);
    const maxAllocation = tokenBalance.availableTokens + currentTokenAllocation;
    
    if (newAllocation > maxAllocation) {
      toast({
        title: "Insufficient tokens",
        description: `You only have ${tokenBalance.availableTokens} tokens available.`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await TokenService.allocateTokensToPage(user.uid, pageId, change);

      // Update local state
      setCurrentTokenAllocation(newAllocation);
      setTokenBalance(prev => prev ? {
        ...prev,
        allocatedTokens: prev.allocatedTokens + change,
        availableTokens: prev.availableTokens - change
      } : null);

      toast({
        title: "Tokens allocated",
        description: `${Math.abs(change)} token${Math.abs(change) !== 1 ? 's' : ''} ${change > 0 ? 'allocated to' : 'removed from'} this page.`
      });
    } catch (error) {
      console.error('Error allocating tokens:', error);
      toast({
        title: "Allocation failed",
        description: "Failed to allocate tokens. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle subscription activation
  const handleActivateSubscription = () => {
    if (isSubscriptionEnabled) {
      setShowActivationModal(true);
    } else {
      setShowSupportUsModal(true);
    }
  };

  // Handle manage subscription
  const handleManageSubscription = () => {
    router.push('/settings/subscription');
  };

  // Don't render if user is the author
  if (user && authorId && user.uid === authorId) {
    return null;
  }

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // Render logged out state
  if (!user) {
    return (
      <div className="fixed bottom-12 left-8 right-8 z-50 flex justify-center">
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 backdrop-blur-md shadow-lg rounded-xl border border-border/40 p-4">
          <div className="text-center">
            <h3 className="text-sm font-medium mb-2">Support this page</h3>
            <p className="text-xs text-muted-foreground mb-3">
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

  // Render non-subscriber state
  if (!subscription || subscription.status !== 'active') {
    return (
      <div className="fixed bottom-12 left-8 right-8 z-50 flex justify-center">
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 backdrop-blur-md shadow-lg rounded-xl border border-border/40 p-4">
          <div className="text-center">
            <h3 className="text-sm font-medium mb-2">Support this page</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {isSubscriptionEnabled 
                ? "Subscribe to get monthly tokens and support creators"
                : "Help us keep WeWrite running"
              }
            </p>
            <Button 
              size="sm" 
              onClick={handleActivateSubscription}
              className="w-full"
            >
              {isSubscriptionEnabled ? "Activate Subscription" : "Support Us"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render token allocation interface for active subscribers
  if (!tokenBalance) {
    return (
      <div className="fixed bottom-12 left-8 right-8 z-50 flex justify-center">
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 backdrop-blur-md shadow-lg rounded-xl border border-border/40 p-4">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2 mx-auto"></div>
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
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-border/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Monthly Tokens: {totalTokens}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {allocatedTokens} allocated • {availableTokens} available
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTokenAllocation(-1)}
                disabled={loading || currentTokenAllocation <= 0}
                className="h-8 w-8 p-0"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => handleTokenAllocation(1)}
                disabled={loading || availableTokens <= 0}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleManageSubscription}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Token allocation progress bar */}
          <div className="w-full bg-muted/50 h-4 rounded-full overflow-hidden mb-3 border border-border/20">
            <div className="h-full flex">
              {/* Current page segment */}
              {currentPagePercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                  style={{ width: `${currentPagePercentage}%` }}
                  title={`This page: ${currentTokenAllocation} tokens`}
                >
                  {currentPagePercentage > 15 && (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-xs font-medium text-white">
                        {currentTokenAllocation}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Other pages segment */}
              {otherPagesPercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary/40 transition-all duration-500"
                  style={{ width: `${otherPagesPercentage}%` }}
                  title={`Other pages: ${otherPagesTokens} tokens`}
                />
              )}
              {/* Available segment */}
              {availablePercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-muted/40 to-muted/20 transition-all duration-500"
                  style={{ width: `${availablePercentage}%` }}
                  title={`Available: ${availableTokens} tokens`}
                >
                  {availablePercentage > 20 && (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-xs font-medium text-muted-foreground">
                        {availableTokens}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>This page: {currentTokenAllocation} tokens</span>
            <span>≈ ${(currentTokenAllocation / 10).toFixed(2)}/month</span>
          </div>
        </div>
      </div>

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

export default TokenPledgeBar;
