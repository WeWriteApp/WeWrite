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
import { DashboardErrorBoundary, WidgetErrorBoundary } from "../../components/admin/DashboardErrorBoundary";
import { DashboardGridSkeleton, DateRangeFilterSkeleton } from "../../components/admin/DashboardSkeleton";
import { Modal } from "../../components/ui/modal";
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

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempDateRange, setTempDateRange] = useState<DateRange>(dateRange);

  // Handle filter modal actions
  const handleOpenFilterModal = () => {
    setTempDateRange(dateRange);
    setIsFilterModalOpen(true);
  };

  const handleApplyFilters = () => {
    setDateRange(tempDateRange);
    setIsFilterModalOpen(false);
  };

  const handleCancelFilters = () => {
    setTempDateRange(dateRange);
    setIsFilterModalOpen(false);
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
      {/* Minimal Navigation - Back Button Only */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
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
      <div className="container mx-auto px-4 py-6">
        <DashboardErrorBoundary>
          {dashboardLoading ? (
            <>
              {/* Loading state */}
              <div className="mb-6 flex justify-end">
                <div className="h-10 w-24 bg-muted animate-pulse rounded"></div>
              </div>
              <DashboardGridSkeleton />
            </>
          ) : (
            <>
              {/* Filter Button */}
              <div className="mb-6 flex justify-end">
                <Button
                  variant="outline"
                  onClick={handleOpenFilterModal}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </div>

              {/* Responsive Grid Layout optimized for large displays */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {/* Live Visitors Widget */}
                <WidgetErrorBoundary widgetName="Live Visitors">
                  <LiveVisitorsWidget />
                </WidgetErrorBoundary>

                {/* New Accounts Created Widget */}
                <WidgetErrorBoundary widgetName="New Accounts">
                  <NewAccountsWidget dateRange={dateRange} />
                </WidgetErrorBoundary>

                {/* New Pages Created Widget */}
                <WidgetErrorBoundary widgetName="New Pages">
                  <NewPagesWidget dateRange={dateRange} />
                </WidgetErrorBoundary>

                {/* Visitor Analytics Widget */}
                <WidgetErrorBoundary widgetName="Visitor Analytics">
                  <VisitorAnalyticsWidget dateRange={dateRange} />
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

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={handleCancelFilters}
        title="Dashboard Filters"
        className="sm:max-w-3xl"
        footer={
          <div className="flex justify-end gap-3 w-full pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handleCancelFilters}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyFilters}
              className="px-6"
            >
              Apply Filters
            </Button>
          </div>
        }
      >
        <div className="py-2">
          <DateRangeFilter
            dateRange={tempDateRange}
            onDateRangeChange={setTempDateRange}
            className="border-0 shadow-none p-0 bg-transparent"
          />
        </div>
      </Modal>
    </div>
  );
}
