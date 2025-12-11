"use client";

import React, { useState, useEffect, useRef } from 'react';
import './dashboard.css';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { ChevronLeft, Filter, GripVertical } from 'lucide-react';
import { isAdmin } from "../../utils/isAdmin";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DateRangeFilter, type DateRange } from "../../components/admin/DateRangeFilter";
import {
  GlobalAnalyticsFilters,
  type GlobalAnalyticsFilters as GlobalAnalyticsFiltersType,
  defaultGlobalAnalyticsFilters,
  filtersToURLParams,
  filtersFromURLParams,
  filtersToLocalStorage,
  filtersFromLocalStorage
} from "../../components/admin/GlobalAnalyticsFilters";
import { NewAccountsWidget } from "../../components/admin/NewAccountsWidget";
import { NewPagesWidget } from "../../components/admin/NewPagesWidget";
import { SharesAnalyticsWidget } from "../../components/admin/SharesAnalyticsWidget";

import { ContentChangesAnalyticsWidget } from "../../components/admin/ContentChangesAnalyticsWidget";
import { PWAInstallsAnalyticsWidget } from "../../components/admin/PWAInstallsAnalyticsWidget";
import { PWANotificationsAnalyticsWidget } from "../../components/admin/PWANotificationsAnalyticsWidget";
import { PageViewsAnalyticsWidget } from "../../components/admin/PageViewsAnalyticsWidget";
import { LiveVisitorsWidget } from "../../components/admin/LiveVisitorsWidget";
import { VisitorAnalyticsWidget } from "../../components/admin/VisitorAnalyticsWidget";
import { DesktopOptimizedDashboard } from "../../components/admin/DesktopOptimizedDashboard";

import {
  WriterEarningsWidget,
  WriterPayoutsWidget as NewWriterPayoutsWidget
} from "../../components/admin/WriterEarningsPayoutsWidget";
import { PlatformFeeRevenueWidget } from "../../components/admin/PlatformFeeRevenueWidget";
import { UsdPaymentsOverviewWidget } from "../../components/admin/UsdPaymentsOverviewWidget";
import { UsdAllocationsWidget } from "../../components/admin/UsdAllocationsWidget";
import { WritingIdeasManager } from "../../components/admin/WritingIdeasManager";

// 🚨 CRITICAL: Database Reads Crisis Monitoring


// Payment Analytics Widgets
import { SubscriptionConversionFunnelWidget } from "../../components/admin/SubscriptionConversionFunnelWidget";
import { SubscriptionsOverTimeWidget } from "../../components/admin/SubscriptionsOverTimeWidget";
import { SubscriptionRevenueWidget } from "../../components/admin/SubscriptionRevenueWidget";

import { UnifiedErrorBoundary } from "../../components/utils/UnifiedErrorBoundary";
import { DashboardGridSkeleton, DateRangeFilterSkeleton } from "../../components/admin/DashboardSkeleton";
import './dashboard.css';

const WIDGET_TYPE = 'WIDGET';

const DraggableWidget = ({ id, index, moveWidget, children }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [, drop] = useDrop({
    accept: WIDGET_TYPE,
    hover(item: any, monitor: any) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) {
        return;
      }
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      if (!hoverBoundingRect) return;
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      moveWidget(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }});

  const [{ isDragging }, drag, preview] = useDrag({
    type: WIDGET_TYPE,
    item: { id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()})});

  drag(drop(ref));
  preview(previewRef);

  return (
    <div
      ref={previewRef}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}
    >
      <div ref={ref} className="relative">
        <div className="absolute top-2 right-2 cursor-grab">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        {children}
      </div>
    </div>
  );
};

const initialWidgets = [
  { id: 'live-visitors', component: LiveVisitorsWidget },
  { id: 'new-accounts', component: NewAccountsWidget },
  { id: 'new-pages', component: NewPagesWidget },
  { id: 'page-views-analytics', component: PageViewsAnalyticsWidget },
  { id: 'visitor-analytics', component: VisitorAnalyticsWidget },
  { id: 'shares-analytics', component: SharesAnalyticsWidget },

  { id: 'content-changes-analytics', component: ContentChangesAnalyticsWidget },
  { id: 'pwa-installs-analytics', component: PWAInstallsAnalyticsWidget },
  { id: 'pwa-notifications-analytics', component: PWANotificationsAnalyticsWidget },
  { id: 'subscription-conversion-funnel', component: SubscriptionConversionFunnelWidget },
  { id: 'subscriptions-over-time', component: SubscriptionsOverTimeWidget },
  { id: 'subscription-revenue', component: SubscriptionRevenueWidget },


  // Payment Analytics Widgets
  { id: 'usd-payments-overview', component: UsdPaymentsOverviewWidget },
  { id: 'usd-allocations', component: UsdAllocationsWidget },
  { id: 'platform-fee-revenue', component: PlatformFeeRevenueWidget },

  // Writer Analytics Widgets
  { id: 'writer-earnings', component: WriterEarningsWidget },
  { id: 'writer-payouts-new', component: NewWriterPayoutsWidget },

  // Content Management Widgets
  { id: 'writing-ideas-manager', component: WritingIdeasManager },
];

export default function AdminDashboardPage() {
  console.log('🚀🚀🚀 AdminDashboardPage component is rendering! 🚀🚀🚀');

  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [widgets, setWidgets] = useState(initialWidgets);

  useEffect(() => {
    // Clear localStorage to reset widget layout and ensure all widgets are loaded
    localStorage.removeItem('adminDashboardLayout');

    const savedLayout = localStorage.getItem('adminDashboardLayout');
    if (savedLayout) {
      const parsedLayout = JSON.parse(savedLayout);
      const newWidgets = parsedLayout.map(id => initialWidgets.find(w => w.id === id)).filter(Boolean);
      // Add any new widgets that weren't in the saved layout
      initialWidgets.forEach(widget => {
        if (!newWidgets.find(w => w.id === widget.id)) {
          newWidgets.push(widget);
        }
      });
      setWidgets(newWidgets);
    } else {
      // Use all initial widgets
      setWidgets(initialWidgets);
    }
  }, []);

  const moveWidget = (dragIndex, hoverIndex) => {
    const newWidgets = [...widgets];
    const [reorderedItem] = newWidgets.splice(dragIndex, 1);
    newWidgets.splice(hoverIndex, 0, reorderedItem);
    setWidgets(newWidgets);
    localStorage.setItem('adminDashboardLayout', JSON.stringify(newWidgets.map(w => w.id)));
  };

  // Date range state - default to last 6 months
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    console.log('🗓️ [Admin Dashboard] Initial date range:', { startDate, endDate });
    return { startDate, endDate };
  });

  // Dashboard loading state
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Options bar state - persist in localStorage
  const [isOptionsBarExpanded, setIsOptionsBarExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('wewrite-admin-options-bar-expanded');
      return stored === 'true';
    }
    return false;
  });

  // Granularity state for chart detail
  const [granularity, setGranularity] = useState<number>(50);

  // Global analytics filters state
  const [globalFilters, setGlobalFilters] = useState<GlobalAnalyticsFiltersType>(defaultGlobalAnalyticsFilters);

  // Removed view mode state - now only desktop-optimized mode

  // Debug logging for admin dashboard state
  console.log('📊 [Admin Dashboard] Current state:', {
    dateRange,
    granularity,
    globalFilters,
    dashboardLoading,
    isOptionsBarExpanded
  });

  // Debug current user authentication
  console.log('🔐 [Admin Dashboard] Current user:', {
    user: user?.user,
    email: user?.user?.email,
    uid: user?.user?.uid,
    isAdmin: user?.user?.email ? isAdmin(user.user.email) : false
  });

  // Removed view mode and list items handlers - now using desktop-optimized component

  // Handle options bar toggle with persistence
  const handleToggleOptionsBar = () => {
    const newState = !isOptionsBarExpanded;
    setIsOptionsBarExpanded(newState);

    // Persist the state
    if (typeof window !== 'undefined') {
      localStorage.setItem('wewrite-admin-options-bar-expanded', newState.toString());
    }
  };

  // Handle global filters change with persistence
  const handleGlobalFiltersChange = (newFilters: GlobalAnalyticsFiltersType) => {
    setGlobalFilters(newFilters);

    // Persist to localStorage
    filtersToLocalStorage(newFilters);

    // Update URL parameters for bookmarking
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const filterParams = filtersToURLParams(newFilters);
      filterParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Initialize global filters from URL or localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);

      // Try to load from URL first (for bookmarked views)
      if (urlParams.has('timeMode') || urlParams.has('perUser')) {
        const filtersFromURL = filtersFromURLParams(urlParams);
        setGlobalFilters(filtersFromURL);
      } else {
        // Fall back to localStorage
        const filtersFromStorage = filtersFromLocalStorage();
        if (filtersFromStorage) {
          setGlobalFilters(filtersFromStorage);
        }
      }
    }
  }, []);

  // Check if user is admin
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    if (authLoading) return; // Wait for authentication to complete

    if (user && user.email) {
      const adminCheck = isAdmin(user.email);
      setIsAdminUser(adminCheck);
      if (!adminCheck) {
        console.log('❌ [Admin Dashboard] User is not admin, redirecting to home');
        router.push('/');
      } else {
        console.log('✅ [Admin Dashboard] User is admin, loading dashboard');
        setDashboardLoading(false);
      }
    } else {
      console.log('❌ [Admin Dashboard] No user, redirecting to login');
      router.push('/auth/login?redirect=/admin/dashboard');
    }
  }, [user, authLoading, router]);

  // Prevent options bar from closing due to dashboard loading state changes
  useEffect(() => {
    // This effect intentionally does nothing but prevents unwanted re-renders
    // from affecting the options bar state
  }, [dashboardLoading]);

  // Show loading while checking auth
  if (authLoading || !user || !user.email || !isAdmin(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-background">
        {/* Clean Header with Back Button and Centered Title */}
        <div className="border-b-only bg-card">
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

              <h1 className="text-2xl font-bold">Admin Product KPIs</h1>

              {/* Options Controls */}
              {!dashboardLoading && (
                <div className="flex items-center gap-2">
                  {/* Options Button - toggle options bar */}
                  <Button
                    variant={isOptionsBarExpanded ? "default" : "outline"}
                    onClick={handleToggleOptionsBar}
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Options
                  </Button>
                </div>
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
          className={`border-b-only bg-card transition-all duration-300 ease-in-out overflow-hidden ${
            isOptionsBarExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-6 py-4 space-y-4">
            {dashboardLoading ? (
              /* Loading state for options bar */
              <div className="space-y-4">
                <div className="h-12 bg-muted animate-pulse rounded"></div>
                <div className="h-12 bg-muted animate-pulse rounded"></div>
              </div>
            ) : (
              <>
                {/* Combined Filters - Single Horizontal Row */}
                <DateRangeFilter
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  granularity={granularity}
                  onGranularityChange={setGranularity}
                  globalFilters={globalFilters}
                  onGlobalFiltersChange={handleGlobalFiltersChange}
                  className="border-0 shadow-none p-0 bg-transparent"
                  compact={true}
                  combined={true}
                />
              </>
            )}
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="py-6 px-6">
          <UnifiedErrorBoundary>
            {(() => {
              if (dashboardLoading) {
                console.log('🔄🔄🔄 Dashboard is loading, showing skeleton 🔄🔄🔄');
                return (
                  <>
                    <DashboardGridSkeleton />
                  </>
                );
              } else {
                console.log('🎯🎯🎯 Dashboard loaded, rendering desktop-optimized mode! 🎯🎯🎯');

                // Always use desktop-optimized dashboard (no grid mode)
                return (
                  <>
                    {/* Desktop-Optimized Dashboard - Full Width */}
                    <div className="w-full">
                      <UnifiedErrorBoundary>
                        <DesktopOptimizedDashboard
                          dateRange={dateRange}
                          granularity={granularity}
                          globalFilters={globalFilters}
                        />
                      </UnifiedErrorBoundary>
                    </div>
                  </>
                );

                // Remove old grid/list mode logic
                if (false) {
                  return (
                    <>
                      {/* Grid Mode Layout - Responsive Grid optimized for large displays */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {widgets.map((widget, index) => {
                          const WidgetComponent = widget.component;
                          return (
                            <DraggableWidget key={widget.id} id={widget.id} index={index} moveWidget={moveWidget}>
                              <UnifiedErrorBoundary>
                                <WidgetComponent
                                  dateRange={dateRange}
                                  granularity={granularity}
                                  globalFilters={globalFilters}
                                />
                              </UnifiedErrorBoundary>
                            </DraggableWidget>
                          );
                        })}
                      </div>
                    </>
                  );
                }
              }
            })()}
          </UnifiedErrorBoundary>
        </div>
      </div>
    </DndProvider>
  );
}