"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronLeft, DollarSign, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useSidebarContext } from "./UnifiedSidebar";
import { Logo } from "../ui/Logo";
import { useAuth } from '../../providers/AuthProvider';
import { useUserEarnings } from '../../hooks/useUserEarnings';
import { RemainingFundsDisplay, OverspendWarningDisplay } from "../ui/RemainingUsdCounter";
import { useUsdBalance } from "../../contexts/UsdBalanceContext";
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';
import { formatUsdCents } from "../../utils/formatCurrency";
import { FinancialDropdown, SpendBreakdown, EarningsBreakdown } from "../ui/FinancialDropdown";

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
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
  const { earnings, loading: earningsLoading } = useUserEarnings();
  const { hasActiveSubscription } = useSubscriptionWarning();

  // Calculate header positioning width - should match other headers
  const headerSidebarWidth = React.useMemo(() => {
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
      const totalUsdEarned = earnings.totalEarnings; // Already in USD
      const isZeroEarnings = totalUsdEarned === 0;

      return (
        <FinancialDropdown
          title="Click to view earnings"
          onNavigate={() => router.push('/settings/earnings')}
          direction="southwest"
          trigger={
            <Badge
              variant="secondary"
              className={`cursor-pointer hover:bg-secondary/80 transition-colors text-sm ${
                isZeroEarnings ? 'text-muted-foreground' : 'text-green-600 border-green-200'
              }`}
            >
              {formatUsdCents(totalUsdEarned * 100)}
            </Badge>
          }
          content={<EarningsBreakdown totalEarnings={totalUsdEarned} />}
        />
      );
    }

    // Fallback: show zero earnings if no data but not loading
    return (
      <FinancialDropdown
        title="Click to view earnings"
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
        content={<EarningsBreakdown totalEarnings={0} />}
      />
    );
  };

  // Helper function to render spend/overspend display (same as homepage)
  const renderSpendDisplay = () => {
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

    // Show spend/overspend display for users with USD balance
    if (usdBalance) {
      const isOverspending = usdBalance.allocatedUsdCents > usdBalance.totalUsdCents;
      const overspendingAmount = isOverspending ? usdBalance.allocatedUsdCents - usdBalance.totalUsdCents : 0;

      // Business logic: Show EITHER remaining funds with pie chart OR overspend warning with icon
      if (isOverspending) {
        // Show overspend badge with warning icon to the right
        return (
          <FinancialDropdown
            title="Click to view full spend breakdown"
            onNavigate={() => router.push('/settings/spend')}
            direction="southeast"
            trigger={
              <OverspendWarningDisplay
                overspendUsdCents={overspendingAmount}
              />
            }
            content={
              <SpendBreakdown
                totalUsdCents={usdBalance.totalUsdCents}
                allocatedUsdCents={usdBalance.allocatedUsdCents}
                availableUsdCents={Math.max(0, usdBalance.totalUsdCents - usdBalance.allocatedUsdCents)}
              />
            }
          />
        );
      } else {
        // Show pie chart of remaining funds and amount left to spend
        const availableUsdCents = Math.max(0, usdBalance.totalUsdCents - usdBalance.allocatedUsdCents);

        return (
          <FinancialDropdown
            title="Click to view full spend breakdown"
            onNavigate={() => router.push('/settings/spend')}
            direction="southeast"
            trigger={
              <RemainingFundsDisplay
                allocatedUsdCents={usdBalance.allocatedUsdCents || 0}
                totalUsdCents={usdBalance.totalUsdCents || 0}
              />
            }
            content={
              <SpendBreakdown
                totalUsdCents={usdBalance.totalUsdCents}
                allocatedUsdCents={usdBalance.allocatedUsdCents}
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
    <div className={`flex flex-col pt-8 pb-6 ${className}`}>
      {/* Use the same layout approach as other headers for consistent spacing */}
      <div className="flex w-full">
        {/* Sidebar spacer - only on desktop, matches other headers */}
        <div
          className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
          style={{ width: `${headerSidebarWidth}px` }}
        />

        {/* Header content area - matches homepage layout with money elements */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center h-14 px-3 sm:px-4 md:px-6">
            {/* Spend/Overspend Display (left side) */}
            <div className="flex-1 flex justify-start">
              {renderSpendDisplay()}
            </div>

            {/* Logo/Title (centered) - clickable to go home */}
            <div className="flex items-center justify-center">
              <div
                className="cursor-pointer transition-transform hover:scale-105"
                onClick={() => router.push('/')}
              >
                <Logo size="md" priority={true} styled={true} clickable={true} />
              </div>
            </div>

            {/* Earnings Display (right side) */}
            <div className="flex-1 flex justify-end">
              {renderEarningsDisplay()}
            </div>
          </div>
        </div>
      </div>



      {/* Mobile overflow sidebar functionality moved to MobileBottomNav */}
    </div>
  );
}