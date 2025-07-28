"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "../ui/button";
import { Heart, DollarSign } from "lucide-react";
import { RemainingTokensCounter } from "../ui/RemainingTokensCounter";
import Logo from "../ui/Logo";
import { openExternalLink } from "../../utils/pwa-detection";
import { useSidebarContext } from "./UnifiedSidebar";
import { useAuth } from '../../providers/AuthProvider';
import { useUserEarnings } from '../../hooks/useUserEarnings';

// Removed old optimized subscription import - using API-first approach
import { getSubscriptionButtonText, getSubscriptionNavigationPath, isActiveSubscription } from "../../utils/subscriptionStatus";
import { TokenService } from "../../services/tokenService";
import { TokenBalance } from "../../types/database";
import { getLoggedOutTokenBalance, getUserTokenBalance } from "../../utils/simulatedTokens";
import { useTokenBalanceContext } from "../../contexts/TokenBalanceContext";
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';

export default function Header() {
  const router = useRouter();
  const { user } = useAuth();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [headerHeight, setHeaderHeight] = React.useState(80); // Start at 80px (h-20)

  const [subscription, setSubscription] = React.useState(null);
  const { tokenBalance: contextTokenBalance } = useTokenBalanceContext();
  const [simulatedTokenBalance, setSimulatedTokenBalance] = React.useState<any>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const { earnings } = useUserEarnings();
  const { hasActiveSubscription } = useSubscriptionWarning();



  // Helper function to render earnings display
  const renderEarningsDisplay = () => {
    // Show if user is authenticated and earnings data is loaded (even if zero)
    if (!user?.uid || !earnings) return null;

    const totalTokensEarned = Math.floor(earnings.totalEarnings * 10); // Convert USD to tokens (1 USD = 10 tokens)

    return (
      <div
        className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
        onClick={() => router.push('/settings/earnings')}
        title={`${totalTokensEarned} tokens earned`}
      >
        <DollarSign className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-foreground">
          {totalTokensEarned}
        </span>
      </div>
    );
  };

  // Helper function to render remaining tokens display
  const renderRemainingTokensDisplay = () => {
    // Use real token balance if available, otherwise use unfunded tokens
    const balance = contextTokenBalance || simulatedTokenBalance;

    // Debug logging
    console.log('🎯 Header: Token balance check', {
      hasContextBalance: !!contextTokenBalance,
      hasSimulatedBalance: !!simulatedTokenBalance,
      finalBalance: balance,
      user: !!user,
      hasActiveSubscription
    });

    // Don't show anything for unauthenticated users
    if (!user) {
      return null;
    }

    // Show "Buy Tokens" button if user has no active subscription or zero tokens
    const shouldShowBuyTokens = hasActiveSubscription === false ||
      (balance && balance.totalTokens === 0) ||
      (!balance);

    if (shouldShowBuyTokens) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/settings/subscription')}
          className="text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Buy Tokens
        </Button>
      );
    }

    // Show token counter for users with active subscription and tokens
    return (
      <RemainingTokensCounter
        allocatedTokens={balance?.allocatedTokens || 0}
        totalTokens={balance?.totalTokens || 0}
        onClick={() => router.push('/settings/spend-tokens')}
      />
    );
  };

  // Calculate header positioning width - only respond to persistent expanded state, not hover
  // Hover state should overlay without affecting header positioning
  const headerSidebarWidth = React.useMemo(() => {
    // Header should only respond to persistent expanded state, not hover state
    // When expanded: always use full width (256px) regardless of hover
    // When collapsed: always use collapsed width (64px) regardless of hover
    if (isExpanded) {
      return sidebarWidth; // Use full expanded width (256px)
    } else if (sidebarWidth > 0) {
      return 64; // Use collapsed width (64px) for collapsed state
    } else {
      return 0; // No sidebar (user not authenticated)
    }
  }, [isExpanded, sidebarWidth]);

  // Listen to user subscription changes
  React.useEffect(() => {
    console.log('🎯 Header: Subscription effect triggered', {
      user: !!user,
      currentAccountUid: user?.uid
    });

    if (!user) {
      console.log('🎯 Header: No user, clearing subscription');
      setSubscription(null);
      return;
    }

    console.log('🎯 Header: Fetching subscription data for user:', user.uid);

    // Use API-first approach instead of complex optimized subscription
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/account-subscription');
        if (response.ok) {
          const data = await response.json();
          const subscriptionData = data.hasSubscription ? data.fullData : null;
          console.log('🎯 Header: Subscription data:', subscriptionData);
          setSubscription(subscriptionData);
        }
      } catch (error) {
        console.error('🎯 Header: Error fetching subscription:', error);
        setSubscription(null);
      }
    };

    fetchSubscription();

    return () => {
      console.log('🎯 Header: No cleanup needed for API calls');
    };
  }, [user]);

  // Token balance is now provided by context - no need to fetch separately

  // Load unfunded token balance for users without subscriptions
  React.useEffect(() => {

    const loadUnfundedTokens = () => {
      // Load unfunded tokens for logged-out users or users without subscriptions
      if (!user) {
        // Logged-out user - load from localStorage immediately
        const balance = getLoggedOutTokenBalance();
        console.log('🎯 Header: Loaded logged-out balance:', balance);
        setSimulatedTokenBalance(balance);
      } else if (!subscription) {
        // Logged-in user without subscription - load user-specific unfunded tokens
        const balance = getUserTokenBalance(user.uid);
        console.log('🎯 Header: Loaded user unfunded balance:', balance);
        setSimulatedTokenBalance(balance);
      } else {
        // User has subscription, clear simulated balance
        setSimulatedTokenBalance(null);
      }
    };

    // Initial load (immediate)
    loadUnfundedTokens();

    // Listen for localStorage changes to update in real-time
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('wewrite_simulated_tokens')) {
        loadUnfundedTokens();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, subscription]);

  // Calculate and update header height
  React.useEffect(() => {
    const handleScroll = () => {
      // Update scroll state
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 10);

      // Calculate smooth header height transition
      // Transition from 80px to 56px over 50px of scroll
      const maxScroll = 50;
      const minHeight = 56; // h-14
      const maxHeight = 80; // h-20
      const scrollRatio = Math.min(scrollY / maxScroll, 1);
      const newHeight = maxHeight - (maxHeight - minHeight) * scrollRatio;
      setHeaderHeight(newHeight);


    };

    // Initial update
    handleScroll();

    // Add scroll event listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Add scrollend event listener if supported
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', () => {
        // Update scroll state on scroll end
        handleScroll();
      });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if ('onscrollend' in window) {
        window.removeEventListener('scrollend', () => {});
      }
    };
  }, []);

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed top-0 z-[70] transition-all duration-300 ease-in-out will-change-transform`}
        style={{
          transform: 'translateZ(0)', // Force GPU acceleration
          left: '0px', // Always start from left edge like the editor
          right: '0px',
          width: '100%' // Always full width like the editor
        }}
        data-component="main-header"
        data-testid="main-header"
        data-sticky="true"
      >
        <div
          className="relative header-border-transition border-visible bg-background transition-all duration-300 ease-in-out"
          style={{
            height: `${headerHeight}px`,
            transform: 'translateZ(0)', // Force GPU acceleration
            willChange: 'height'
          }}
        >
          {/* Use the same layout approach as SidebarLayout for consistent spacing */}
          <div className="flex w-full h-full">
            {/* Sidebar spacer - only on desktop, matches SidebarLayout logic */}
            <div
              className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
              style={{ width: `${headerSidebarWidth}px` }}
            />

            {/* Header content area - matches editor content area */}
            <div className={`flex-1 min-w-0 flex items-center h-full px-3 sm:px-4 md:px-6 header-padding-mobile transition-all duration-300 ease-in-out`}>
              {/* Earnings Display (left side) */}
              <div className="flex-1 flex justify-start">
                {renderEarningsDisplay()}
              </div>

              {/* Logo/Title (centered) - clickable to go home */}
              <div className="flex items-center justify-center">
                <Link href="/" className="flex items-center space-x-2 transition-all duration-200 hover:scale-105">
                  <Logo size="md" priority={true} clickable={true} styled={true} />
                </Link>
              </div>

              {/* Remaining Tokens Counter (right side) */}
              <div className="flex-1 flex justify-end">
                {/* Show remaining tokens counter if user has any token allocations (funded or unfunded) */}
                {renderRemainingTokensDisplay()}
              </div>
            </div>
          </div>

        </div>
      </header>
      {/* Spacer to prevent content from being hidden under the fixed header */}
      <div
        style={{
          height: `${headerHeight}px`,
          transition: 'height 300ms ease-in-out',
          transform: 'translateZ(0)', // Force GPU acceleration
          willChange: 'height',
          '--header-height': `${headerHeight}px`
        } as React.CSSProperties}
      />

    </>
  );
}