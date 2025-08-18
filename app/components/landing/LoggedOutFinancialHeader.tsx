"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '../ui/badge';
import { DollarSign, Loader2 } from 'lucide-react';
import { useFakeBalance } from '../../contexts/FakeBalanceContext';
import { formatUsdCents } from '../../utils/formatCurrency';
import { RemainingFundsDisplay, OverspendWarningDisplay } from '../ui/RemainingUsdCounter';
import { FinancialDropdown, SpendBreakdown, EarningsBreakdown } from '../ui/FinancialDropdown';

/**
 * LoggedOutFinancialHeader Component
 * 
 * Shows fake balance and earnings for logged-out users to get them excited
 * about the allocation system. Positioned below the auth header and above
 * the main content sections.
 */
export function LoggedOutFinancialHeader() {
  const router = useRouter();
  const { fakeBalance, isLoading } = useFakeBalance();

  // Helper function to render fake spend display
  const renderSpendDisplay = () => {
    if (isLoading || !fakeBalance) {
      return (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors text-sm"
          onClick={() => router.push('/auth/register')}
          title="Sign up to start allocating!"
        >
          <Loader2 className="h-3 w-3 animate-spin mr-1 flex-shrink-0" />
          <span className="flex items-center">Loading</span>
        </Badge>
      );
    }

    // Calculate overspending
    const isOverspending = fakeBalance.allocatedUsdCents > fakeBalance.totalUsdCents;
    const overspendingAmount = isOverspending 
      ? fakeBalance.allocatedUsdCents - fakeBalance.totalUsdCents 
      : 0;

    if (isOverspending) {
      // Show overspend badge with warning
      return (
        <FinancialDropdown
          title="Demo Spending"
          onNavigate={() => router.push('/auth/register')}
          direction="southeast"
          showNavigationButton={false}
          trigger={
            <OverspendWarningDisplay
              overspendUsdCents={overspendingAmount}
            />
          }
          content={
            <div className="p-4 space-y-3">
              <SpendBreakdown
                totalUsdCents={fakeBalance.totalUsdCents}
                allocatedUsdCents={fakeBalance.allocatedUsdCents}
                availableUsdCents={Math.max(0, fakeBalance.totalUsdCents - fakeBalance.allocatedUsdCents)}
              />
            </div>
          }
        />
      );
    } else {
      // Show remaining funds with pie chart
      const availableUsdCents = Math.max(0, fakeBalance.totalUsdCents - fakeBalance.allocatedUsdCents);

      return (
        <FinancialDropdown
          title="Demo Spending"
          onNavigate={() => router.push('/auth/register')}
          direction="southeast"
          showNavigationButton={false}
          trigger={
            <RemainingFundsDisplay
              allocatedUsdCents={fakeBalance.allocatedUsdCents || 0}
              totalUsdCents={fakeBalance.totalUsdCents || 0}
            />
          }
          content={
            <div className="p-4 space-y-3">
              <SpendBreakdown
                totalUsdCents={fakeBalance.totalUsdCents}
                allocatedUsdCents={fakeBalance.allocatedUsdCents}
                availableUsdCents={availableUsdCents}
              />
            </div>
          }
        />
      );
    }
  };

  // Helper function to render fake earnings display
  const renderEarningsDisplay = () => {
    // Show fake earnings to get users excited
    const fakeEarnings = 0; // Start with $0 to encourage sign up

    return (
      <FinancialDropdown
        title="Demo Earnings"
        onNavigate={() => router.push('/auth/register')}
        direction="southwest"
        showNavigationButton={false}
        trigger={
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80 transition-colors text-muted-foreground text-sm"
          >
            {formatUsdCents(fakeEarnings)}
          </Badge>
        }
        content={
          <div className="p-4 space-y-3">
            <EarningsBreakdown
              totalEarnings={fakeEarnings}
              pendingEarnings={fakeEarnings}
              lastMonthEarnings={0}
              monthlyChange={0}
            />
            <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/50 p-2 rounded">
              <strong>Demo Mode:</strong> Start writing pages to earn from supporters! Sign up to begin.
            </div>
          </div>
        }
      />
    );
  };

  return (
    <div className="flex items-center justify-between">
      {/* Spend Display (left side) */}
      <div className="flex items-center min-w-0 flex-shrink-0">
        {renderSpendDisplay()}
      </div>

      {/* Earnings Display (right side) */}
      <div className="flex items-center min-w-0 flex-shrink-0">
        {renderEarningsDisplay()}
      </div>
    </div>
  );
}
