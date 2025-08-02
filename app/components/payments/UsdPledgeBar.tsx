"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from '../../providers/AuthProvider';
import { Button } from "../ui/button";
import { Plus, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

import { isActiveSubscription } from "../../utils/subscriptionStatus";
import { formatUsdCents, dollarsToCents, centsToDollars } from '../../utils/formatCurrency';
import { USD_UI_TEXT } from '../../utils/usdConstants';
import {
  getLoggedOutUsdBalance,
  allocateLoggedOutUsd,
  getLoggedOutPageAllocation
} from "../../utils/simulatedUsd";
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { TokenParticleEffect } from '../effects/TokenParticleEffect';
import { useTokenParticleEffect } from '../../hooks/useTokenParticleEffect';
import { PulsingButtonEffect } from '../effects/PulsingButtonEffect';
import { useDelayedLoginBanner } from '../../hooks/useDelayedLoginBanner';
import { toast } from '../ui/use-toast';
import { getNextMonthlyProcessingDate } from '../../utils/subscriptionTiers';

interface UsdPledgeBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  className?: string;
  // User allocation mode
  isUserAllocation?: boolean;
  username?: string;
}

interface Subscription {
  id: string;
  status: string;
  amount: number;
  tier: string;
}

export const UsdPledgeBar = React.forwardRef<HTMLDivElement, UsdPledgeBarProps>(({
  pageId: propPageId,
  pageTitle,
  authorId,
  visible = true,
  className,
  isUserAllocation = false,
  username,
}, ref) => {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Check if current route is a ContentPage
  const isContentPage = React.useMemo(() => {
    const navPageRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/settings', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications', '/random-pages', '/trending-pages', '/following'
    ];

    if (navPageRoutes.includes(pathname)) {
      return false;
    }

    if (pathname.startsWith('/user/') || pathname.startsWith('/group/')) {
      return true;
    }

    const segments = pathname.split('/').filter(Boolean);
    return segments.length === 1 && !navPageRoutes.includes(`/${segments[0]}`);
  }, [pathname]);

  const { usdBalance, refreshUsdBalance, updateOptimisticBalance } = useUsdBalance();
  const { triggerEffect, originElement, triggerParticleEffect, resetEffect } = useTokenParticleEffect();
  const { showDelayedBanner, triggerDelayedBanner, resetDelayedBanner, isDelayActive } = useDelayedLoginBanner();

  // Function to show USD allocation notification
  const showUsdAllocationNotification = (usdCents: number) => {
    const nextProcessingDate = getNextMonthlyProcessingDate();
    const formattedDate = nextProcessingDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });

    const usdAmount = formatUsdCents(usdCents);
    const title = isUserAllocation
      ? `${usdAmount} allocated to ${username || 'user'}!`
      : `${usdAmount} allocated!`;

    toast({
      title,
      description: `Funds will be distributed on ${formattedDate}`,
      duration: 3000,
    });
  };

  // State
  const [currentUsdAllocation, setCurrentUsdAllocation] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Animation states
  const [isPlusSpringAnimating, setIsPlusSpringAnimating] = useState(false);
  const [isMinusSpringAnimating, setIsMinusSpringAnimating] = useState(false);

  // Refs
  const accentSectionRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-detect pageId from URL if not provided
  const pageId = propPageId || (pathname ? pathname.substring(1) : '');

  // Reset delayed banner when user logs in or navigates away
  useEffect(() => {
    if (user) {
      resetDelayedBanner();
    }
  }, [user, resetDelayedBanner]);

  useEffect(() => {
    resetDelayedBanner();
  }, [pathname, resetDelayedBanner]);

  // Check if current user is the page owner
  const isPageOwner = !!(user && authorId && user.uid === authorId);

  // Animation functions
  const triggerPlusSpringAnimation = () => {
    setIsPlusSpringAnimating(true);
    setTimeout(() => setIsPlusSpringAnimating(false), 200);
  };

  const triggerMinusSpringAnimation = () => {
    setIsMinusSpringAnimating(true);
    setTimeout(() => setIsMinusSpringAnimating(false), 200);
  };

  // Fetch current page allocation
  useEffect(() => {
    const fetchCurrentAllocation = async () => {
      if (!pageId) return;

      try {
        if (user?.uid) {
          // Fetch from API for logged-in users
          const response = await fetch(`/api/usd/allocate?pageId=${pageId}`);
          if (response.ok) {
            const data = await response.json();
            setCurrentUsdAllocation(data.currentAllocation || 0);
          }
        } else {
          // Use simulated USD for logged-out users
          const allocation = getLoggedOutPageAllocation(pageId);
          setCurrentUsdAllocation(allocation);
        }
      } catch (error) {
        console.error('Error fetching current USD allocation:', error);
      }
    };

    fetchCurrentAllocation();
  }, [pageId, user?.uid]);

  // Handle USD allocation
  const handleUsdAllocation = async (usdCentsChange: number) => {
    if (!pageId || !pageTitle) return;

    setIsLoading(true);
    triggerPlusSpringAnimation();

    try {
      if (user?.uid) {
        // Optimistic update
        updateOptimisticBalance(usdCentsChange);
        setCurrentUsdAllocation(prev => Math.max(0, prev + usdCentsChange));

        // API call for logged-in users
        const response = await fetch('/api/usd/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId,
            usdCentsChange
          })
        });

        if (!response.ok) {
          throw new Error('Failed to allocate USD');
        }

        const data = await response.json();
        setCurrentUsdAllocation(data.currentPageAllocation || 0);

        // Refresh balance to get accurate data
        await refreshUsdBalance();

        // Show success notification
        showUsdAllocationNotification(Math.abs(usdCentsChange));

        // Trigger particle effect
        if (usdCentsChange > 0 && accentSectionRef.current) {
          triggerParticleEffect(accentSectionRef.current);
        }

      } else {
        // Handle logged-out users with simulated USD
        const result = allocateLoggedOutUsd(pageId, pageTitle, Math.max(0, currentUsdAllocation + usdCentsChange));
        
        if (result.success) {
          setCurrentUsdAllocation(Math.max(0, currentUsdAllocation + usdCentsChange));
          showUsdAllocationNotification(Math.abs(usdCentsChange));

          // Trigger delayed login banner after successful allocation
          triggerDelayedBanner();

          // Trigger particle effect
          if (usdCentsChange > 0 && accentSectionRef.current) {
            triggerParticleEffect(accentSectionRef.current);
          }
        } else {
          toast({
            title: "Allocation Failed",
            description: result.error || "Unable to allocate funds",
            variant: "destructive",
            duration: 3000,
          });
        }
      }
    } catch (error) {
      console.error('Error allocating USD:', error);
      
      // Revert optimistic update
      if (user?.uid) {
        updateOptimisticBalance(-usdCentsChange);
        setCurrentUsdAllocation(prev => Math.max(0, prev - usdCentsChange));
      }

      toast({
        title: "Allocation Failed",
        description: "Unable to allocate funds. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Quick allocation amounts in cents
  const quickAmounts = [25, 50, 100, 250]; // $0.25, $0.50, $1.00, $2.50

  // Don't render if not visible or if user is page owner
  if (!visible || isPageOwner) {
    return null;
  }

  const hasBalance = user?.uid ? (usdBalance && usdBalance.totalUsdCents > 0) : true;
  const availableUsdCents = user?.uid ? (usdBalance?.availableUsdCents || 0) : 1000; // $10 simulated for logged-out

  return (
    <>
      <div
        ref={ref}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/50",
          isContentPage ? "mb-0" : "mb-16", // Above mobile toolbar on NavPages
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-xl mx-auto">
          {/* Left side - Current allocation display */}
          <div 
            ref={accentSectionRef}
            className="flex items-center space-x-2 text-sm"
          >
            <span className="text-muted-foreground">
              {isUserAllocation ? `To ${username}:` : 'Allocated:'}
            </span>
            <span className="font-semibold text-accent-foreground">
              {formatUsdCents(currentUsdAllocation)}
            </span>
          </div>

          {/* Right side - Allocation controls */}
          <div className="flex items-center space-x-2">
            {/* Quick amount buttons */}
            {quickAmounts.map((cents) => (
              <Button
                key={cents}
                variant="outline"
                size="sm"
                onClick={() => handleUsdAllocation(cents)}
                disabled={isLoading || cents > availableUsdCents}
                className="h-8 px-2 text-xs"
              >
                +{formatUsdCents(cents)}
              </Button>
            ))}

            {/* Minus button */}
            {currentUsdAllocation > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUsdAllocation(-Math.min(currentUsdAllocation, 25))}
                disabled={isLoading}
                className={cn(
                  "h-8 w-8 p-0",
                  isMinusSpringAnimating && "animate-spring"
                )}
              >
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Available balance indicator */}
        {user?.uid && usdBalance && (
          <div className="px-4 pb-2">
            <div className="text-xs text-muted-foreground text-center">
              Available: {formatUsdCents(availableUsdCents)}
              {availableUsdCents <= 0 && (
                <span className="text-destructive ml-1">
                  • {USD_UI_TEXT.OUT_OF_FUNDS}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Particle effect */}
      <TokenParticleEffect
        isActive={triggerEffect}
        originElement={originElement}
        onComplete={resetEffect}
      />
    </>
  );
});

UsdPledgeBar.displayName = "UsdPledgeBar";
