"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '../ui/badge';
import { DollarSign, Loader2 } from 'lucide-react';
import { useDemoBalance } from '../../contexts/DemoBalanceContext';
import { formatUsdCents } from '../../utils/formatCurrency';
import { RemainingFundsDisplay, OverspendWarningDisplay } from '../ui/RemainingUsdCounter';
import { FinancialDropdown, SpendBreakdown, EarningsBreakdown } from '../ui/FinancialDropdown';
import { FloatingHeader } from '../ui/FloatingCard';

/**
 * LoggedOutFinancialHeader Component
 * 
 * Shows demo balance and earnings for logged-out users to get them excited
 * about the allocation system. Positioned below the auth header and above
 * the main content sections.
 */
export function LoggedOutFinancialHeader() {
  const router = useRouter();
  const { demoBalance, isLoading } = useDemoBalance();

  // Helper function to render demo spend display
  const renderSpendDisplay = () => {
    if (isLoading || !demoBalance) {
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
    const isOverspending = demoBalance.allocatedUsdCents > demoBalance.totalUsdCents;
    const overspendingAmount = isOverspending
      ? demoBalance.allocatedUsdCents - demoBalance.totalUsdCents
      : 0;

    if (isOverspending) {
      // Show overspend badge with warning
      return (
        <FinancialDropdown
          title="Demo Spending"
          onNavigate={() => router.push('/auth/register')}
          direction="southeast"
          showNavigationButton={false}
          isDemo={true}
          demoMessage="Demo Mode: Sign up to start allocating real funds!"
          trigger={
            <OverspendWarningDisplay
              overspendUsdCents={overspendingAmount}
            />
          }
          content={
            <SpendBreakdown
              totalUsdCents={demoBalance.totalUsdCents}
              allocatedUsdCents={demoBalance.allocatedUsdCents}
              availableUsdCents={Math.max(0, demoBalance.totalUsdCents - demoBalance.allocatedUsdCents)}
            />
          }
        />
      );
    } else {
      // Show remaining funds with pie chart
      const availableUsdCents = Math.max(0, demoBalance.totalUsdCents - demoBalance.allocatedUsdCents);

      return (
        <FinancialDropdown
          title="Demo Spending"
          onNavigate={() => router.push('/auth/register')}
          direction="southeast"
          showNavigationButton={false}
          isDemo={true}
          demoMessage="Demo Mode: Sign up to start allocating real funds!"
          trigger={
            <RemainingFundsDisplay
              allocatedUsdCents={demoBalance.allocatedUsdCents || 0}
              totalUsdCents={demoBalance.totalUsdCents || 0}
            />
          }
          content={
            <SpendBreakdown
              totalUsdCents={demoBalance.totalUsdCents}
              allocatedUsdCents={demoBalance.allocatedUsdCents}
              availableUsdCents={availableUsdCents}
            />
          }
        />
      );
    }
  };

  // Helper function to render demo earnings display
  const renderEarningsDisplay = () => {
    // Show demo earnings to get users excited - demo amounts
    const fakeEarnings = 1234; // $12.34 demo earnings

    return (
      <FinancialDropdown
        title="Demo Earnings"
        onNavigate={() => router.push('/auth/register')}
        direction="southwest"
        showNavigationButton={false}
        isDemo={true}
        demoMessage="Demo Mode: Start writing pages to earn from supporters!"
        trigger={
          <Badge
            variant="secondary"
            className="cursor-pointer transition-colors text-sm text-success bg-success-20 border-success-30 hover:bg-success-25 dark:bg-success-15 dark:border-success-30 dark:hover:bg-success-20"
          >
            {formatUsdCents(fakeEarnings)}
          </Badge>
        }
        content={
          <EarningsBreakdown
            totalEarnings={12.34} // Pass as dollars, not cents
            pendingEarnings={12.34} // Pass as dollars, not cents
            lastMonthEarnings={5.67} // Pass as dollars, not cents
            monthlyChange={15} // 15% increase
          />
        }
      />
    );
  };

  return (
    <div className="fixed top-20 left-0 right-0 z-40 mb-6">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <FloatingHeader className="p-3 md:p-4 relative backdrop-blur-md bg-background/80">
            <div className="flex items-center justify-between">
              {/* Spend Display (left side) */}
              <div className="flex items-center min-w-0 flex-shrink-0">
                {renderSpendDisplay()}
              </div>

              {/* Demo funds text (absolutely centered) */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-muted-foreground font-medium">
                  Demo funds
                </span>
              </div>

              {/* Earnings Display (right side) */}
              <div className="flex items-center min-w-0 flex-shrink-0">
                {renderEarningsDisplay()}
              </div>
            </div>

            {/* Bottom gradient for content flowing behind */}
          </FloatingHeader>
        </div>
      </div>
  );
}
