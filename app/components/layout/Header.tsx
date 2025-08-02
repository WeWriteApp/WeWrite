"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Heart, DollarSign, AlertTriangle, Loader2 } from "lucide-react";
import { RemainingUsdCounter } from "../ui/RemainingUsdCounter";
import Logo from "../ui/Logo";
import { openExternalLink } from "../../utils/pwa-detection";
import { useSidebarContext } from "./UnifiedSidebar";
import { useAuth } from '../../providers/AuthProvider';
import { useUserEarnings } from '../../hooks/useUserEarnings';

// USD-based imports
import { getSubscriptionButtonText, getSubscriptionNavigationPath, isActiveSubscription } from "../../utils/subscriptionStatus";
import { useUsdBalance } from "../../contexts/UsdBalanceContext";
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';
import { formatUsdCents } from "../../utils/formatCurrency";

export default function Header() {
  const router = useRouter();
  const { user } = useAuth();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [headerHeight, setHeaderHeight] = React.useState(80); // Start at 80px (h-20)

  const [subscription, setSubscription] = React.useState(null);
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
  const headerRef = React.useRef<HTMLDivElement>(null);
  const { earnings, loading: earningsLoading } = useUserEarnings();
  const { hasActiveSubscription } = useSubscriptionWarning();

  // Helper function to render earnings display
  const renderEarningsDisplay = () => {
    // Don't show anything for unauthenticated users
    if (!user?.uid) return null;

    // Show loading state while earnings are being fetched
    if (earningsLoading) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors"
          onClick={() => router.push('/settings/earnings')}
          title="Loading earnings..."
        >
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          <span className="text-xs">Loading</span>
        </Badge>
      );
    }

    // Show earnings data (even if zero)
    if (earnings) {
      const totalUsdEarned = earnings.totalEarnings; // Already in USD
      const isZeroEarnings = totalUsdEarned === 0;

      return (
        <Badge
          variant="secondary"
          className={`cursor-pointer hover:bg-secondary/80 transition-colors text-sm ${
            isZeroEarnings ? 'text-muted-foreground' : 'text-green-600 border-green-200'
          }`}
          onClick={() => router.push('/settings/earnings')}
          title={`${formatUsdCents(totalUsdEarned * 100)} earned`}
        >
          {formatUsdCents(totalUsdEarned * 100)}
        </Badge>
      );
    }

    // Fallback: show zero earnings if no data but not loading
    return (
      <Badge
        variant="secondary"
        className="cursor-pointer hover:bg-secondary/80 transition-colors text-muted-foreground text-sm"
        onClick={() => router.push('/settings/earnings')}
        title="$0.00 earned"
      >
        $0.00
      </Badge>
    );
  };

  // Helper function to render remaining USD display
  const renderRemainingUsdDisplay = () => {
    // Debug logging
    console.log('🎯 Header: USD balance check', {
      hasUsdBalance: !!usdBalance,
      usdLoading,
      user: !!user,
      hasActiveSubscription
    });

    // Don't show anything for unauthenticated users
    if (!user) {
      return null;
    }

    // Show loading state while USD balance is being fetched
    if (usdLoading) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors text-sm"
          onClick={() => router.push('/settings/spend')}
          title="Loading balance..."
        >
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          <span>Loading</span>
        </Badge>
      );
    }

    // Show "Add Funds" button if user has no active subscription or zero USD
    const shouldShowAddFunds = hasActiveSubscription === false ||
      (usdBalance && usdBalance.totalUsdCents === 0) ||
      (!usdBalance && !usdLoading);

    if (shouldShowAddFunds) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/settings/fund-account')}
          className="text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Add Funds
        </Button>
      );
    }

    // Show USD counter for users with active subscription and funds
    if (usdBalance) {
      const isOverspending = usdBalance.allocatedUsdCents > usdBalance.totalUsdCents;
      const overspendingAmount = isOverspending ? usdBalance.allocatedUsdCents - usdBalance.totalUsdCents : 0;

      if (isOverspending) {
        // Show overspending warning with separate icon and badge
        return (
          <div
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => router.push('/settings/spend')}
            title={`Overspending by ${formatUsdCents(overspendingAmount)} - Click to adjust spending`}
          >
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <Badge
              variant="destructive"
              className="hover:bg-destructive/80 transition-colors text-sm"
            >
              +{formatUsdCents(overspendingAmount)}
            </Badge>
          </div>
        );
      } else {
        // Show remaining funds with badge on left and pie chart on right
        const isZeroBalance = usdBalance.totalUsdCents === 0;

        return (
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={`cursor-pointer hover:bg-secondary/80 transition-colors text-sm ${
                isZeroBalance ? 'text-muted-foreground' : ''
              }`}
              onClick={() => router.push('/settings/spend')}
              title={`${formatUsdCents(usdBalance.totalUsdCents)} total funds`}
            >
              {formatUsdCents(usdBalance.totalUsdCents)}
            </Badge>
            <RemainingUsdCounter
              allocatedUsdCents={usdBalance.allocatedUsdCents || 0}
              totalUsdCents={usdBalance.totalUsdCents || 0}
              onClick={() => router.push('/settings/spend')}
            />
          </div>
        );
      }
    }

    // Loading state
    if (usdLoading) {
      return (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      );
    }

    return null;
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
      userId: user?.uid
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

              {/* Remaining USD Counter (right side) */}
              <div className="flex-1 flex justify-end">
                {/* Show remaining USD counter if user has any USD balance */}
                {renderRemainingUsdDisplay()}
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