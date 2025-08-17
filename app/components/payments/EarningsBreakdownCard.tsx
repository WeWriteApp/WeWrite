"use client";

import React from 'react';
import { Card } from '../ui/card';
import { DollarSign, TrendingUp, Calendar, Award } from 'lucide-react';
import { useEarnings } from '../../contexts/EarningsContext';
import { formatUsdCents } from '../../utils/formatCurrency';


/**
 * EarningsBreakdownCard - Shows earnings breakdown as KPI cards
 *
 * Displays:
 * - Pending: This month (green, most urgent)
 * - Earned last month
 * - Lifetime earnings
 */
export default function EarningsBreakdownCard() {
  const { earnings, isLoading } = useEarnings();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="pb-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  const pendingEarnings = earnings?.pendingBalance || 0;
  const lastMonthEarnings = earnings?.lastMonthEarnings || 0;
  const totalEarnings = earnings?.totalEarnings || 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Earnings - Green (Most Urgent) */}
        <Card className="p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-sm font-medium text-muted-foreground">
              Pending: This month
            </div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatUsdCents(pendingEarnings * 100)}
          </div>
        </Card>

        {/* Last Month Earnings */}
        <Card className="p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-sm font-medium text-muted-foreground">
              Earned last month
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">
            {formatUsdCents(lastMonthEarnings * 100)}
          </div>
        </Card>

        {/* Lifetime Earnings */}
        <Card className="p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-sm font-medium text-muted-foreground">
              Lifetime earnings
            </div>
            <Award className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">
            {formatUsdCents(totalEarnings * 100)}
          </div>
        </Card>
      </div>

      {/* Information Box */}
      <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
        <strong>About pending earnings:</strong> Supporters have until the end of the month to make changes to their allocations,
        so this amount might change. These earnings become available for payout at the beginning of next month.
      </div>

      {/* Zero State Message */}
      {totalEarnings === 0 && (
        <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
          Start writing pages to earn from supporters
        </div>
      )}
    </div>
  );
}
