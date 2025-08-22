"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronLeft, DollarSign, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { WeWriteLogo } from "../ui/WeWriteLogo";
import { FloatingHeader } from "../ui/FloatingCard";
import { useAuth } from '../../providers/AuthProvider';
import { RemainingFundsDisplay, OverspendWarningDisplay } from "../ui/RemainingUsdCounter";
import { useUsdBalance } from "../../contexts/UsdBalanceContext";
import { useEarnings } from "../../contexts/EarningsContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useDemoBalance, useShouldUseDemoBalance } from "../../contexts/DemoBalanceContext";
import { formatUsdCents } from "../../utils/formatCurrency";
import { FinancialDropdown, SpendBreakdown, EarningsBreakdown } from "../ui/FinancialDropdown";
import { useSidebarContext } from './UnifiedSidebar';

export interface FloatingFinancialHeaderProps {
  className?: string;
}

/**
 * FloatingFinancialHeader Component
 *
 * Floating sticky header for logged-in users with:
 * - Left: Spend/balance display
 * - Center: WeWrite logo (clickable to home)
 * - Right: Earnings display
 * - Position: Floating at top with translucency and blur
 * - Respects sidebar positioning on desktop
 * - Consistent styling with logged-out financial header
 */
export default function FloatingFinancialHeader({
  className = ""
}: FloatingFinancialHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const { earnings, isLoading: earningsLoading } = useEarnings();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);
  const { demoBalance } = useDemoBalance();
  const { sidebarWidth, isExpanded } = useSidebarContext();

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

  // Check if we should hide the header
  const shouldHideHeader = React.useMemo(() => {
    if (!pathname) return false;

    console.log('🔍 FloatingFinancialHeader: Checking pathname:', pathname);
    const pathSegments = pathname.split('/').filter(Boolean);
    console.log('🔍 FloatingFinancialHeader: Path segments:', pathSegments);

    // Hide on all settings pages and subpages
    if (pathname.startsWith('/settings')) {
      console.log('🚫 FloatingFinancialHeader: Hiding on settings page');
      return true;
    }

    // Hide on all admin pages and subpages
    if (pathname.startsWith('/admin')) {
      console.log('🚫 FloatingFinancialHeader: Hiding on admin page');
      return true;
    }

    // Hide on ContentPages that have ContentPageHeader (single segment routes that aren't NavPages)
    const navPageRoutes = [
      '/', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications', '/random-pages', '/trending-pages', '/following',
      '/user', '/group', '/admin', '/timeline'
    ];

    // Hide on content creation pages
    if (pathname === '/new') {
      console.log('🚫 FloatingFinancialHeader: Hiding on /new page (content creation)');
      return true;
    }

    // CRITICAL FIX: Hide on ALL ContentPages (/[id]/ routes)
    // Content pages have paths like /M7CAYL7SrApqV57mYKnK which results in pathSegments = ['M7CAYL7SrApqV57mYKnK']
    // This includes both user's own pages and other people's pages
    if (pathSegments.length === 1 && pathSegments[0]) {
      // Check if this is NOT a known NavPage route
      const isNavPage = navPageRoutes.some(route => {
        // Handle exact matches and prefix matches
        if (route === '/') {
          return pathname === '/';
        }
        return pathname === route || pathname.startsWith(route + '/');
      });

      if (!isNavPage) {
        console.log('🚫 FloatingFinancialHeader: Hiding on ContentPage (single segment):', pathname, 'segments:', pathSegments);
        return true;
      }
    }

    // Hide on ContentPage sub-routes (like /[id]/edit, /[id]/versions, etc.)
    if (pathSegments.length >= 2 && pathSegments[0]) {
      // Check if the first segment is NOT a known NavPage route
      const firstSegmentPath = `/${pathSegments[0]}`;
      const isNavPageRoute = navPageRoutes.some(route => {
        if (route === '/') return false; // Root is handled separately
        return firstSegmentPath === route || firstSegmentPath.startsWith(route + '/');
      });

      if (!isNavPageRoute) {
        console.log('🚫 FloatingFinancialHeader: Hiding on ContentPage sub-route:', pathname, 'segments:', pathSegments);
        return true;
      }
    }

    console.log('✅ FloatingFinancialHeader: Showing on page:', pathname);
    return false;
  }, [user?.uid, pathname]);

  // Don't render the header if it should be hidden
  if (shouldHideHeader) {
    return null;
  }

  // Helper function to render earnings display (same as homepage)
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
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
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
              variant="secondary"
              className={`cursor-pointer transition-colors text-sm ${
                isZeroEarnings
                  ? 'text-muted-foreground bg-secondary/50 hover:bg-secondary/80'
                  : 'text-green-600 bg-green-50/80 border-green-200/60 hover:bg-green-100/80 dark:text-green-400 dark:bg-green-950/80 dark:border-green-800/60 dark:hover:bg-green-900/80'
              }`}
            >
              {formatUsdCents(displayAmount * 100)}
            </Badge>
          }
          content={<EarningsBreakdown
            totalEarnings={earnings.totalEarnings || 0}
            pendingEarnings={displayAmount} // Show the same amount as the chip
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
            className="cursor-pointer bg-secondary/50 hover:bg-secondary/80 transition-colors text-muted-foreground text-sm"
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

  // Helper function to render spend/overspend display (same as homepage)
  const renderSpendDisplay = () => {
    // Don't show anything for unauthenticated users
    if (!user) {
      return null;
    }

    // Debug logging to help diagnose the "Add Funds" issue
    console.log('🔍 FloatingFinancialHeader Debug:', {
      userId: user?.uid,
      hasActiveSubscription,
      shouldUseDemoBalance,
      usdBalance,
      demoBalance,
      usdLoading,
      subscription: hasActiveSubscription ? 'active' : 'inactive'
    });

    // Determine which balance to use
    const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;
    const isLoading = shouldUseDemoBalance ? false : usdLoading;

    // Show loading state while USD balance is being fetched (only for real balance)
    if (isLoading) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer bg-secondary/50 hover:bg-secondary/80 transition-colors text-sm"
          onClick={() => router.push('/settings/spend')}
          title="Loading balance..."
        >
          <Loader2 className="h-3 w-3 animate-spin mr-1 flex-shrink-0" />
          <span className="flex items-center">Loading</span>
        </Badge>
      );
    }

    // Show "Add Funds" badge if user has no active subscription or zero USD
    const shouldShowAddFunds = !hasActiveSubscription ||
      (currentBalance && currentBalance.totalUsdCents === 0) ||
      (!currentBalance && !isLoading);

    console.log('🔍 FloatingFinancialHeader Add Funds Logic:', {
      shouldShowAddFunds,
      hasActiveSubscription,
      currentBalance,
      isLoading,
      reasons: {
        noActiveSubscription: !hasActiveSubscription,
        zeroBalance: currentBalance && currentBalance.totalUsdCents === 0,
        noBalanceAndNotLoading: !currentBalance && !isLoading
      }
    });

    if (shouldShowAddFunds) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer bg-secondary/50 hover:bg-secondary/80 transition-colors text-sm"
          onClick={() => router.push('/settings/fund-account')}
          title="Click to add funds"
        >
          <DollarSign className="h-3 w-3 mr-1 flex-shrink-0" />
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



  return (
    <div className="fixed top-4 left-0 right-0 z-[70] mb-6">
      {/* Mobile: Standard centered layout */}
      <div className="md:hidden mx-auto px-4 max-w-4xl transition-all duration-300 ease-in-out">
        <FloatingHeader size="md" noShadowAtTop={true}>
          <div className="relative flex items-center justify-between h-10">
            {/* Spend/Overspend Display (left side) */}
            <div className="flex items-center min-w-0 flex-shrink-0 h-full">
              {renderSpendDisplay()}
            </div>

            {/* Logo/Title (absolutely centered) - clickable to go home */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center flex-shrink-0">
              <WeWriteLogo
                size="md"
                styled={true}
                clickable={true}
                showText={false}
                priority={true}
              />
            </div>

            {/* Earnings Display (right side) */}
            <div className="flex items-center min-w-0 flex-shrink-0 h-full">
              {renderEarningsDisplay()}
            </div>
          </div>
        </FloatingHeader>
      </div>

      {/* Desktop: Respect sidebar positioning */}
      <div
        className="hidden md:block mx-auto px-6 transition-all duration-300 ease-in-out"
        style={{
          ...(headerSidebarWidth > 0 ? {
            marginLeft: `${headerSidebarWidth + 16}px`, // Add padding offset
            marginRight: '16px',
            maxWidth: `calc(100vw - ${headerSidebarWidth + 32}px)` // Account for both sides
          } : {
            maxWidth: '1024px' // Standard page max-width when no sidebar
          }),
        }}
      >
        <FloatingHeader size="lg" noShadowAtTop={true}>
          <div className="relative flex items-center justify-between h-12">
            {/* Spend/Overspend Display (left side) */}
            <div className="flex items-center min-w-0 flex-shrink-0 h-full">
              {renderSpendDisplay()}
            </div>

            {/* Logo/Title (absolutely centered) - clickable to go home */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center flex-shrink-0">
              <WeWriteLogo
                size="md"
                styled={true}
                clickable={true}
                showText={false}
                priority={true}
              />
            </div>

            {/* Earnings Display (right side) */}
            <div className="flex items-center min-w-0 flex-shrink-0 h-full">
              {renderEarningsDisplay()}
            </div>
          </div>
        </FloatingHeader>
      </div>
    </div>
  );
}