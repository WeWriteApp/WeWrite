"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "../../providers/AuthProvider";
import { Button } from '../../components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { isAdmin } from "../../utils/feature-flags";
import { DateRangeFilter, type DateRange } from "../../components/admin/DateRangeFilter";
import { NewAccountsWidget } from "../../components/admin/NewAccountsWidget";
import { NewPagesWidget } from "../../components/admin/NewPagesWidget";
import { SharesAnalyticsWidget } from "../../components/admin/SharesAnalyticsWidget";
import { EditsAnalyticsWidget } from "../../components/admin/EditsAnalyticsWidget";
import { ContentChangesAnalyticsWidget } from "../../components/admin/ContentChangesAnalyticsWidget";
import { PWAInstallsAnalyticsWidget } from "../../components/admin/PWAInstallsAnalyticsWidget";
import { DashboardErrorBoundary, WidgetErrorBoundary } from "../../components/admin/DashboardErrorBoundary";
import { DashboardGridSkeleton, DateRangeFilterSkeleton } from "../../components/admin/DashboardSkeleton";
import './dashboard.css';



export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Date range state - default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return { startDate, endDate };
  });

  // Dashboard loading state
  const [dashboardLoading, setDashboardLoading] = useState(true);







  // Check if user is admin
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      } else {
        // User is admin, stop dashboard loading
        setDashboardLoading(false);
      }
    } else if (!authLoading && !user) {
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
      {/* Minimal Navigation - Back Button Only */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin#tools')}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Admin Tools
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Analytics and insights for WeWrite
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <DashboardErrorBoundary>
          {dashboardLoading ? (
            <>
              {/* Loading state */}
              <div className="mb-6">
                <DateRangeFilterSkeleton />
              </div>
              <DashboardGridSkeleton />
            </>
          ) : (
            <>
              {/* Date Range Filter */}
              <div className="mb-6">
                <DateRangeFilter
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                />
              </div>

              {/* Simple Grid Layout (temporarily disabled react-grid-layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* New Accounts Created Widget */}
                <WidgetErrorBoundary widgetName="New Accounts">
                  <NewAccountsWidget dateRange={dateRange} />
                </WidgetErrorBoundary>

                {/* New Pages Created Widget */}
                <WidgetErrorBoundary widgetName="New Pages">
                  <NewPagesWidget dateRange={dateRange} />
                </WidgetErrorBoundary>

                {/* Shares Analytics Widget */}
                <WidgetErrorBoundary widgetName="Shares Analytics">
                  <SharesAnalyticsWidget dateRange={dateRange} />
                </WidgetErrorBoundary>

                {/* Edits Analytics Widget */}
                <WidgetErrorBoundary widgetName="Edits Analytics">
                  <EditsAnalyticsWidget dateRange={dateRange} />
                </WidgetErrorBoundary>

                {/* Content Changes Analytics Widget */}
                <WidgetErrorBoundary widgetName="Content Changes Analytics">
                  <ContentChangesAnalyticsWidget dateRange={dateRange} />
                </WidgetErrorBoundary>

                {/* PWA Installs Analytics Widget */}
                <WidgetErrorBoundary widgetName="PWA Installs Analytics">
                  <PWAInstallsAnalyticsWidget dateRange={dateRange} />
                </WidgetErrorBoundary>
              </div>
            </>
          )}
        </DashboardErrorBoundary>
      </div>
    </div>
  );
}
