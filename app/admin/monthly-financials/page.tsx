"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { formatUsdCents } from '../../utils/formatCurrency';
import { useFinancialsData, useUserDrawer } from './hooks';
import {
  RealtimeBalance,
  CurrentMonthStatus,
  SubscribersTable,
  WriterEarningsTable,
  DataReconciliation,
  HistoricalData,
  FinancialsUserDrawer,
} from './components';

const formatMonth = (month: string) => {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export default function MonthlyFinancialsPage() {
  const { data, isLoading, error, isSyncing, fetchData, handleSync, user, authLoading } = useFinancialsData();
  const { selectedUserEmail, selectedUserData, loadingUserData, handleUserClick, closeUserDrawer } = useUserDrawer();

  // Show loading while checking auth
  if (authLoading || !user || !user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader" className="text-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => fetchData()}
        disabled={isLoading}
        className="w-full gap-1.5"
      >
        <Icon name="RefreshCw" size={14} className={isLoading ? 'animate-spin' : ''} />
        Refresh
      </Button>

      {/* Error State */}
      {error && (
        <div className="wewrite-card bg-destructive/10 border-destructive/20">
          <div className="flex items-center gap-2 text-destructive">
            <Icon name="AlertCircle" size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !data && (
        <div className="space-y-4">
          <div className="wewrite-card animate-pulse h-48" />
          <div className="wewrite-card animate-pulse h-64" />
          <div className="wewrite-card animate-pulse h-96" />
        </div>
      )}

      {data && (
        <>
          {/* Environment Debug Info */}
          {data.debug && (data.debug.environment === 'development' || data.debug.stripeMode === 'TEST') && (
            <div className="wewrite-card border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-start gap-3">
                <Icon name="AlertTriangle" size={20} className="mt-0.5 flex-shrink-0 text-yellow-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Development Environment Detected</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    You are viewing <strong>{data.debug.stripeMode}</strong> Stripe data and <strong>{data.debug.firebaseCollection}</strong> Firebase collection.
                    Production subscribers and allocations will not appear here.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                    <div className="p-2 bg-[var(--card-bg)] rounded">
                      <p className="text-yellow-600 dark:text-yellow-400">Environment</p>
                      <p className="font-mono font-medium">{data.debug.environment}</p>
                    </div>
                    <div className="p-2 bg-[var(--card-bg)] rounded">
                      <p className="text-yellow-600 dark:text-yellow-400">Stripe Mode</p>
                      <p className="font-mono font-medium">{data.debug.stripeMode}</p>
                    </div>
                    <div className="p-2 bg-[var(--card-bg)] rounded">
                      <p className="text-yellow-600 dark:text-yellow-400">Firebase Collection</p>
                      <p className="font-mono font-medium">{data.debug.firebaseCollection}</p>
                    </div>
                    <div className="p-2 bg-[var(--card-bg)] rounded">
                      <p className="text-yellow-600 dark:text-yellow-400">Records</p>
                      <p className="font-mono font-medium">{data.debug.stripeSubscriptionCount} Stripe / {data.debug.firebaseRecordCount} Firebase</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Real-Time Balance Breakdown */}
          {data.realtimeBalanceBreakdown && (
            <RealtimeBalance balance={data.realtimeBalanceBreakdown} />
          )}

          {/* Fund Flow Model Explanation */}
          <div className="wewrite-card border">
            <div className="flex items-start gap-3">
              <Icon name="Info" size={20} className="mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Monthly Bulk Processing Model</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.metadata.description}
                </p>
              </div>
            </div>
          </div>

          {/* Current Month Status */}
          <CurrentMonthStatus currentMonth={data.currentMonth} formatMonth={formatMonth} />

          {/* Stripe Balance */}
          {data.stripeBalance && (
            <div className="wewrite-card">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="DollarSign" size={20} />
                <h2 className="text-xl font-bold">Stripe Balance</h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold">{formatUsdCents(data.stripeBalance.availableCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{formatUsdCents(data.stripeBalance.pendingCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{formatUsdCents(data.stripeBalance.totalCents)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Subscribers Table */}
          {data.stripeSubscriptions && (
            <SubscribersTable stripeSubscriptions={data.stripeSubscriptions} onUserClick={handleUserClick} />
          )}

          {/* Writer Earnings */}
          <WriterEarningsTable writerEarnings={data.writerEarnings} onUserClick={handleUserClick} />

          {/* Data Reconciliation */}
          {data.reconciliation && (
            <DataReconciliation reconciliation={data.reconciliation} isSyncing={isSyncing} onSync={handleSync} />
          )}

          {/* Data Sources */}
          {data.dataSources && (
            <div className="wewrite-card">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="Database" size={20} />
                <h2 className="text-xl font-bold">Data Sources</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3 p-2 bg-muted/30 rounded">
                  <span className="font-medium min-w-[140px]">Subscription Revenue:</span>
                  <span className="text-muted-foreground">{data.dataSources.subscriptionRevenue}</span>
                </div>
                <div className="flex items-start gap-3 p-2 bg-muted/30 rounded">
                  <span className="font-medium min-w-[140px]">Allocations:</span>
                  <span className="text-muted-foreground">{data.dataSources.allocations}</span>
                </div>
                <div className="flex items-start gap-3 p-2 bg-muted/30 rounded">
                  <span className="font-medium min-w-[140px]">Historical Data:</span>
                  <span className="text-muted-foreground">{data.dataSources.historicalData}</span>
                </div>
              </div>
            </div>
          )}

          {/* Historical Data & Trends */}
          <HistoricalData historicalData={data.historicalData} totals={data.totals} formatMonth={formatMonth} />
        </>
      )}

      {/* User Details Side Drawer */}
      <FinancialsUserDrawer
        selectedUserEmail={selectedUserEmail}
        selectedUserData={selectedUserData}
        loadingUserData={loadingUserData}
        onClose={closeUserDrawer}
      />
    </div>
  );
}
