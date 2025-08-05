"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronLeft, DollarSign, Loader2 } from "lucide-react";
import { useEffect } from "react";
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
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();
  const { earnings, loading: earningsLoading } = useUserEarnings();
  const { hasActiveSubscription } = useSubscriptionWarning();

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
          <Loader2 className="h-3 w-3 animate-spin mr-1 flex-shrink-0" />
          <span className="flex items-center">Loading</span>
        </Badge>
      );
    }

    // Show "Add Funds" badge if user has no active subscription or zero USD
    const shouldShowAddFunds = hasActiveSubscription === false ||
      (usdBalance && usdBalance.totalUsdCents === 0) ||
      (!usdBalance && !usdLoading);

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
    <header
      data-component="nav-header"
      className={`fixed top-0 z-[70] w-full bg-background border-b border-border transition-all duration-300 ease-in-out ${className}`}
      style={{
        transform: 'translateZ(0)', // Force GPU acceleration
        height: '56px', // Explicit height to ensure consistency
      }}
    >
        {/* Header content area - matches page content width and padding */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
            {/* Spend/Overspend Display (left side) */}
            <div className="flex-1 flex justify-start items-center">
              <div className="flex items-center">
                {renderSpendDisplay()}
              </div>
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
            <div className="flex-1 flex justify-end items-center">
              <div className="flex items-center">
                {renderEarningsDisplay()}
              </div>
            </div>
        </div>
    </header>
  );
}