"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import './dashboard.css';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
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
  WriterEarningsWidget
} from "../../components/admin/WriterEarningsPayoutsWidget";
import { PlatformRevenueWidget } from "../../components/admin/PlatformRevenueWidget";
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
          <Icon name="GripVertical" size={20} className="text-muted-foreground" />
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
  { id: 'platform-revenue', component: PlatformRevenueWidget },

  // Writer Analytics Widgets
  { id: 'writer-earnings', component: WriterEarningsWidget },

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

  // Granularity state for chart detail (fixed value, no longer configurable)
  const [granularity] = useState<number>(50);

  // Global analytics filters state
  const [globalFilters, setGlobalFilters] = useState<GlobalAnalyticsFiltersType>(defaultGlobalAnalyticsFilters);

  // Removed view mode state - now only desktop-optimized mode

  // Debug logging for admin dashboard state
  console.log('📊 [Admin Dashboard] Current state:', {
    dateRange,
    granularity,
    globalFilters,
    dashboardLoading
  });

  // Debug current user authentication
  console.log('🔐 [Admin Dashboard] Current user:', {
    user: user?.user,
    email: user?.user?.email,
    uid: user?.user?.uid,
    isAdmin: user?.user?.email ? isAdmin(user.user.email) : false
  });

  // Removed view mode and list items handlers - now using desktop-optimized component

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

    if (user) {
      // Use user.isAdmin from auth context for consistency with sidebar
      setIsAdminUser(user.isAdmin === true);
      if (!user.isAdmin) {
        console.log('❌ [Admin Dashboard] User is not admin, redirecting to home');
        router.push('/');
      } else {
        console.log('✅ [Admin Dashboard] User is admin, loading dashboard');
        setDashboardLoading(false);
      }
    } else {
      console.log('❌ [Admin Dashboard] No user, redirecting to login');
      router.push('/auth/login?redirect=/admin/product-kpis');
    }
  }, [user, authLoading, router]);

  // Show loading while checking auth
  if (authLoading || !user || !user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader" size={32} />
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-background">
        {/* Options Bar - Always visible */}
        <div className="border-b bg-card">
          <div className="px-6 py-4">
            {dashboardLoading ? (
              /* Loading state for options bar */
              <div className="h-10 bg-muted animate-pulse rounded"></div>
            ) : (
              /* Combined Filters - Single Horizontal Row (no granularity) */
              <DateRangeFilter
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                globalFilters={globalFilters}
                onGlobalFiltersChange={handleGlobalFiltersChange}
                className="border-0 shadow-none p-0 bg-transparent"
                compact={true}
                combined={true}
              />
            )}
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="py-4 px-4 md:py-6 md:px-6">
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