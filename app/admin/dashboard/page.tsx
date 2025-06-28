"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "../../providers/AuthProvider";
import { Button } from '../../components/ui/button';
import { ChevronLeft, Filter } from 'lucide-react';
import { isAdmin } from "../../utils/feature-flags";
import { DateRangeFilter, type DateRange } from "../../components/admin/DateRangeFilter";
import { NewAccountsWidget } from "../../components/admin/NewAccountsWidget";
import { NewPagesWidget } from "../../components/admin/NewPagesWidget";
import { SharesAnalyticsWidget } from "../../components/admin/SharesAnalyticsWidget";
import { EditsAnalyticsWidget } from "../../components/admin/EditsAnalyticsWidget";
import { ContentChangesAnalyticsWidget } from "../../components/admin/ContentChangesAnalyticsWidget";
import { PWAInstallsAnalyticsWidget } from "../../components/admin/PWAInstallsAnalyticsWidget";
import { LiveVisitorsWidget } from "../../components/admin/LiveVisitorsWidget";
import { VisitorAnalyticsWidget } from "../../components/admin/VisitorAnalyticsWidget";
import { AnalyticsBackfillWidget } from "../../components/admin/AnalyticsBackfillWidget";
import { DashboardErrorBoundary, WidgetErrorBoundary } from "../../components/admin/DashboardErrorBoundary";
import { DashboardGridSkeleton, DateRangeFilterSkeleton } from "../../components/admin/DashboardSkeleton";
import './dashboard.css';



export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Date range state - default to last 24 hours
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    return { startDate, endDate };
  });

  // Dashboard loading state
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Options bar state
  const [isOptionsBarExpanded, setIsOptionsBarExpanded] = useState(false);

  // Granularity state for chart detail
  const [granularity, setGranularity] = useState<number>(50);

  // Handle options bar toggle
  const handleToggleOptionsBar = () => {
    setIsOptionsBarExpanded(!isOptionsBarExpanded);
  };

  // Check if user is admin
  useEffect(() => {
    console.log('🔍 [Admin Dashboard] Auth state check:', {
      authLoading,
      hasUser: !!user,
      userEmail: user?.email,
      isAdminResult: user?.email ? isAdmin(user.email) : 'no email'
    });

    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        console.log('❌ [Admin Dashboard] User is not admin, redirecting to home');
        router.push('/');
      } else {
        console.log('✅ [Admin Dashboard] User is admin, loading dashboard');
        // User is admin, stop dashboard loading
        setDashboardLoading(false);
      }
    } else if (!authLoading && !user) {
      console.log('❌ [Admin Dashboard] No user, redirecting to login');
      router.push('/auth/login?redirect=/admin/dashboard');
    }
  }, [user, authLoading, router]);

  // Show loading while checking auth
  if (authLoading || !user || !isAdmin(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Clean Header with Back Button and Centered Title */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin#tools')}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <h1 className="text-2xl font-bold">WeWrite Dashboard</h1>

            {/* Options Button - toggle options bar */}
            {!dashboardLoading && (
              <Button
                variant={isOptionsBarExpanded ? "default" : "outline"}
                onClick={handleToggleOptionsBar}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Options
              </Button>
            )}

            {/* Loading state placeholder for options button */}
            {dashboardLoading && (
              <div className="h-9 w-20 bg-muted animate-pulse rounded"></div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Options Bar */}
      <div
        className={`border-b border-border bg-card transition-all duration-300 ease-in-out overflow-hidden ${
          isOptionsBarExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 py-4">
          {!dashboardLoading && (
            <DateRangeFilter
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              granularity={granularity}
              onGranularityChange={setGranularity}
              className="border-0 shadow-none p-0 bg-transparent"
              compact={true}
            />
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="px-6 py-6">
        <DashboardErrorBoundary>
          {dashboardLoading ? (
            <>
              <DashboardGridSkeleton />
            </>
          ) : (
            <>
              {/* Responsive Grid Layout optimized for large displays */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {/* Live Visitors Widget */}
                <WidgetErrorBoundary widgetName="Live Visitors">
                  <LiveVisitorsWidget />
                </WidgetErrorBoundary>

                {/* New Accounts Created Widget */}
                <WidgetErrorBoundary widgetName="New Accounts">
                  <NewAccountsWidget dateRange={dateRange} granularity={granularity} />
                </WidgetErrorBoundary>

                {/* New Pages Created Widget */}
                <WidgetErrorBoundary widgetName="New Pages">
                  <NewPagesWidget dateRange={dateRange} granularity={granularity} />
                </WidgetErrorBoundary>

                {/* Visitor Analytics Widget */}
                <WidgetErrorBoundary widgetName="Visitor Analytics">
                  <VisitorAnalyticsWidget dateRange={dateRange} granularity={granularity} />
                </WidgetErrorBoundary>

                {/* Shares Analytics Widget */}
                <WidgetErrorBoundary widgetName="Shares Analytics">
                  <SharesAnalyticsWidget dateRange={dateRange} granularity={granularity} />
                </WidgetErrorBoundary>

                {/* Edits Analytics Widget */}
                <WidgetErrorBoundary widgetName="Edits Analytics">
                  <EditsAnalyticsWidget dateRange={dateRange} granularity={granularity} />
                </WidgetErrorBoundary>

                {/* Content Changes Analytics Widget */}
                <WidgetErrorBoundary widgetName="Content Changes Analytics">
                  <ContentChangesAnalyticsWidget dateRange={dateRange} granularity={granularity} />
                </WidgetErrorBoundary>

                {/* PWA Installs Analytics Widget */}
                <WidgetErrorBoundary widgetName="PWA Installs Analytics">
                  <PWAInstallsAnalyticsWidget dateRange={dateRange} granularity={granularity} />
                </WidgetErrorBoundary>

                {/* Analytics Backfill Widget */}
                <WidgetErrorBoundary widgetName="Analytics Backfill">
                  <AnalyticsBackfillWidget />
                </WidgetErrorBoundary>
              </div>
            </>
          )}
        </DashboardErrorBoundary>
      </div>
    </div>
  );
}
