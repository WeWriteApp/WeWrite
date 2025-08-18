"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronLeft, DollarSign, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { WeWriteLogo } from "../ui/WeWriteLogo";
import { useAuth } from '../../providers/AuthProvider';
import { RemainingFundsDisplay, OverspendWarningDisplay } from "../ui/RemainingUsdCounter";
import { useUsdBalance } from "../../contexts/UsdBalanceContext";
import { useEarnings } from "../../contexts/EarningsContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useFakeBalance, useShouldUseFakeBalance } from "../../contexts/FakeBalanceContext";
import { formatUsdCents } from "../../utils/formatCurrency";
import { FinancialDropdown, SpendBreakdown, EarningsBreakdown } from "../ui/FinancialDropdown";
import { useSidebarContext } from './UnifiedSidebar';

export interface NavHeaderProps {
  className?: string;
}

/**
 * NavHeader Component
 *
 * Standardized header for navigation pages with:
 * - Left: Spend/balance display (same as homepage)
 * - Center: WeWrite logo (clickable to home)
 * - Right: Earnings display (same as homepage)
 * - Position: Below status bar on second row
 * - No title text or icons
 * - Back button removed - use sidebar navigation instead
 */
export default function NavHeader({
  className = ""
}: NavHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const { earnings, isLoading: earningsLoading } = useEarnings();
  const shouldUseFakeBalance = useShouldUseFakeBalance(hasActiveSubscription);
  const { fakeBalance } = useFakeBalance();
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

  // Helper function to render earnings display (same as homepage)
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
                  ? 'text-muted-foreground hover:bg-secondary/80'
                  : 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100 dark:text-green-400 dark:bg-green-950 dark:border-green-800 dark:hover:bg-green-900'
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
            className="cursor-pointer hover:bg-secondary/80 transition-colors text-muted-foreground text-sm"
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

    // Determine which balance to use
    const currentBalance = shouldUseFakeBalance ? fakeBalance : usdBalance;
    const isLoading = shouldUseFakeBalance ? false : usdLoading;

    // Show loading state while USD balance is being fetched (only for real balance)
    if (isLoading) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors text-sm"
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

    if (shouldShowAddFunds) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors text-sm"
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
    <header
      data-component="nav-header"
      className={`fixed top-0 left-0 right-0 z-[70] bg-background border-b border-border transition-all duration-300 ease-in-out ${className}`}
      style={{
        ...(headerSidebarWidth > 0 ? { '--sidebar-width': `${headerSidebarWidth}px` } : {}),
        transform: 'translateZ(0)', // Force GPU acceleration
        height: '56px', // Explicit height to ensure consistency
      }}
    >
        {/* Header content area - fills full width of container */}
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between min-w-0 relative">
            {/* Spend/Overspend Display (left side) */}
            <div className="flex items-center min-w-0 flex-shrink-0">
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
            <div className="flex items-center min-w-0 flex-shrink-0">
              {renderEarningsDisplay()}
            </div>
        </div>
    </header>
  );
}