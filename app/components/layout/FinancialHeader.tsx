"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Badge } from "../ui/badge";
import { Icon } from '@/components/ui/Icon';
import { useEffect, useState } from "react";
import { WeWriteLogo } from "../ui/WeWriteLogo";
import { useAuth } from '../../providers/AuthProvider';
import { RemainingFundsDisplay, OverspendWarningDisplay } from "../ui/RemainingUsdCounter";
import { useUsdBalance } from "../../contexts/UsdBalanceContext";
import { useEarnings } from "../../contexts/EarningsContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useDemoBalance, useShouldUseDemoBalance } from "../../contexts/DemoBalanceContext";
import { formatUsdCents } from "../../utils/formatCurrency";
import { FinancialDropdown, SpendBreakdown, EarningsBreakdown } from "../ui/FinancialDropdown";
import { useSidebarContext } from './DesktopSidebar';
import { cn } from "../../lib/utils";
import { shouldShowNavigation } from "../../constants/layout";
import { useBanner } from "../../providers/BannerProvider";

export interface FinancialHeaderProps {
  className?: string;
}

/**
 * FinancialHeader Component
 *
 * Sticky header for logged-in users with:
 * - Left: Spend/balance display
 * - Center: WeWrite logo (clickable to home)
 * - Right: Earnings display
 * - Position: Full-width sticky at top, shadow appears on scroll
 * - Respects sidebar positioning on desktop
 */

export default function FinancialHeader({
  className = ""
}: FinancialHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const { earnings, isLoading: earningsLoading } = useEarnings();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);
  const { demoBalance } = useDemoBalance();
  const { sidebarWidth, isExpanded } = useSidebarContext();
  const { showSaveBanner } = useBanner();

  // Scroll detection for conditional shadow
  const [isScrolled, setIsScrolled] = useState(false);
  // Track if we've hydrated to avoid SSR/client mismatch
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    handleScroll(); // Check initial position
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate header positioning width - should match PageHeader.tsx and SidebarLayout.tsx
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

  // Check if we should hide the header using centralized route config
  const shouldHideHeader = React.useMemo(() => {
    if (!pathname) return true; // Hide if no pathname yet

    // Hide when save banner is visible (content page editing mode)
    // This ensures FinancialHeader doesn't overlap with StickySaveHeader
    if (showSaveBanner) {
      return true;
    }

    // Hide on user profile pages - they have their own header
    if (pathname.startsWith('/u/') || pathname.startsWith('/user/')) {
      return true;
    }

    // Use centralized navigation config - returns true if nav should show
    const showNav = shouldShowNavigation(pathname);

    // Additional check: hide on /new (content creation) even though it's in NAV_PAGE_ROUTES
    // because editors have their own UI
    if (pathname === '/new') {
      return true;
    }

    return !showNav;
  }, [pathname, showSaveBanner]);

  // Don't render the header if it should be hidden
  // Also wait for hydration to avoid SSR/client mismatch
  if (!isHydrated || shouldHideHeader) {
    return null;
  }

  // Helper function to render earnings display
  const renderEarningsDisplay = () => {
    // Don't show anything for unauthenticated users
    if (!user?.uid) return null;

    // Show loading state while earnings are being fetched
    if (earningsLoading) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer bg-secondary/50 hover:bg-secondary/80 transition-colors"
          onClick={() => router.push('/settings/earnings')}
          title="Loading earnings..."
        >
          <Icon name="Loader" className="mr-1" />
          <span className="text-xs">Loading</span>
        </Badge>
      );
    }

    // Show earnings data (even if zero)
    if (earnings) {
      // Show pending earnings if available, otherwise show available balance
      const pendingUsdEarned = earnings.pendingBalance || 0;
      const availableUsdEarned = earnings.availableBalance || 0;
      const displayAmount = pendingUsdEarned > 0 ? pendingUsdEarned : availableUsdEarned;
      const isZeroEarnings = displayAmount === 0;

      return (
        <FinancialDropdown
          title="Earnings"
          onNavigate={() => router.push('/settings/earnings')}
          direction="southwest"
          trigger={
            <Badge
              variant={isZeroEarnings ? "secondary" : "success"}
              className="cursor-pointer transition-colors text-sm"
            >
              {formatUsdCents(displayAmount * 100)}
            </Badge>
          }
          content={<EarningsBreakdown
            totalEarnings={earnings.totalEarnings || 0}
            pendingEarnings={displayAmount}
            lastMonthEarnings={earnings.lastMonthEarnings || 0}
            monthlyChange={earnings.monthlyChange || 0}
          />}
        />
      );
    }

    // Fallback: show zero earnings if no data but not loading
    return (
      <FinancialDropdown
        title="Earnings"
        onNavigate={() => router.push('/settings/earnings')}
        direction="southwest"
        trigger={
          <Badge
            variant="secondary"
            className="cursor-pointer transition-colors text-sm"
          >
            $0.00
          </Badge>
        }
        content={<EarningsBreakdown
          totalEarnings={0}
          pendingEarnings={0}
          lastMonthEarnings={0}
          monthlyChange={0}
        />}
      />
    );
  };

  // Helper function to render spend/overspend display
  const renderSpendDisplay = () => {
    // Don't show anything for unauthenticated users
    if (!user) {
      return null;
    }

    // Determine which balance to use
    const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;
    const isLoading = shouldUseDemoBalance ? false : usdLoading;

    // Show loading state while USD balance is being fetched (only for real balance)
    if (isLoading) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer bg-secondary/50 hover:bg-secondary/80 transition-colors text-sm"
          onClick={() => navigateToSettings('spend', router)}
          title="Loading balance..."
        >
          <Icon name="Loader" className="mr-1 flex-shrink-0" />
          <span className="flex items-center">Loading</span>
        </Badge>
      );
    }

    // Show "Add Funds" badge if user has no active subscription or zero USD
    const shouldShowAddFunds = !hasActiveSubscription ||
      (currentBalance && currentBalance.totalUsdCents === 0) ||
      (!currentBalance && !isLoading);

    if (shouldShowAddFunds) {
      return (
        <Badge
          variant="success"
          className="cursor-pointer text-sm"
          onClick={() => router.push('/settings/fund-account')}
          title="Click to add funds"
        >
          <Icon name="DollarSign" size={12} className="mr-1 flex-shrink-0" />
          <span className="flex items-center">Add Funds</span>
        </Badge>
      );
    }

    // Show spend/overspend display for users with USD balance
    if (currentBalance) {
      const isOverspending = currentBalance.allocatedUsdCents > currentBalance.totalUsdCents;
      const overspendingAmount = isOverspending ? currentBalance.allocatedUsdCents - currentBalance.totalUsdCents : 0;

      // Business logic: Show EITHER remaining funds with pie chart OR overspend warning with icon
      if (isOverspending) {
        // Show overspend badge with warning icon to the right
        return (
          <FinancialDropdown
            title="Spending"
            onNavigate={() => router.push('/settings/spend')}
            direction="southeast"
            trigger={
              <OverspendWarningDisplay
                overspendUsdCents={overspendingAmount}
              />
            }
            content={
              <SpendBreakdown
                totalUsdCents={currentBalance.totalUsdCents}
                allocatedUsdCents={currentBalance.allocatedUsdCents}
                availableUsdCents={Math.max(0, currentBalance.totalUsdCents - currentBalance.allocatedUsdCents)}
              />
            }
          />
        );
      } else {
        // Show pie chart of remaining funds and amount left to spend
        const availableUsdCents = Math.max(0, currentBalance.totalUsdCents - currentBalance.allocatedUsdCents);

        return (
          <FinancialDropdown
            title="Spending"
            onNavigate={() => router.push('/settings/spend')}
            direction="southeast"
            trigger={
              <RemainingFundsDisplay
                allocatedUsdCents={currentBalance.allocatedUsdCents || 0}
                totalUsdCents={currentBalance.totalUsdCents || 0}
              />
            }
            content={
              <SpendBreakdown
                totalUsdCents={currentBalance.totalUsdCents}
                allocatedUsdCents={currentBalance.allocatedUsdCents}
                availableUsdCents={availableUsdCents}
              />
            }
          />
        );
      }
    }

    return null;
  };

  // Shared header content - DRY principle
  const HeaderContent = () => (
    <div className="relative flex items-center justify-between py-3">
      {/* Spend/Overspend Display (left side) */}
      <div className="flex items-center">
        {renderSpendDisplay()}
      </div>

      {/* Logo/Title (absolutely centered) - clickable to go home */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <WeWriteLogo
          size="md"
          styled={true}
          clickable={true}
          showText={false}
          priority={true}
        />
      </div>

      {/* Earnings Display (right side) */}
      <div className="flex items-center">
        {renderEarningsDisplay()}
      </div>
    </div>
  );

  // Shared header classes
  const headerClasses = cn(
    "fixed left-0 right-0 z-fixed-header wewrite-card wewrite-card-sharp wewrite-card-border-bottom wewrite-card-no-padding transition-shadow duration-200",
    isScrolled && "shadow-sm"
  );

  const headerStyle = {
    top: 'var(--banner-stack-height, 0px)',
  };

  return (
    <>
      {/* Mobile: Full-width sticky header - card style with bottom border */}
      <header
        className={cn(headerClasses, "lg:hidden")}
        style={headerStyle}
      >
        <div className="mx-auto px-5 max-w-4xl">
          <HeaderContent />
        </div>
      </header>

      {/* Desktop: Full-width sticky header respecting sidebar - card style with bottom border */}
      <header
        className={cn(headerClasses, "hidden lg:block")}
        style={headerStyle}
      >
        <div
          className="px-5 transition-all duration-300 ease-in-out"
          style={{
            marginLeft: headerSidebarWidth > 0 ? `${headerSidebarWidth}px` : '0',
          }}
        >
          <div className="mx-auto max-w-4xl">
            <HeaderContent />
          </div>
        </div>
      </header>
    </>
  );
}
