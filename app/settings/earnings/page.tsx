'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../providers/AuthProvider';
import { SegmentedControl, SegmentedControlContent, SegmentedControlList, SegmentedControlTrigger } from "../../components/ui/segmented-control";

import EarningsDashboard from '../../components/payments/EarningsDashboard';
import EarningsBreakdownCard from '../../components/payments/EarningsBreakdownCard';
import EarningsSourceBreakdown from '../../components/payments/EarningsSourceBreakdown';
import EarningsHistoryChart from '../../components/payments/EarningsHistoryChart';
import { getAnalyticsService } from '../../utils/analytics-service';
import { SETTINGS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';

export default function EarningsPage() {
  const { user } = useAuth();
  // Track page view
  useEffect(() => {
    if (user) {
      const analytics = getAnalyticsService();
      analytics.trackEvent({
        category: EVENT_CATEGORIES.SETTINGS,
        action: SETTINGS_EVENTS.EARNINGS_PAGE_VIEWED
      });
    }
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Segmented Control Interface */}
      <SegmentedControl defaultValue="earnings" className="space-y-4 sm:space-y-6" urlNavigation="query" queryParam="tab">
        <SegmentedControlList className="grid w-full grid-cols-2">
          <SegmentedControlTrigger value="earnings" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <Icon name="DollarSign" size={12} className="sm:h-4 sm:w-4" />
            <span>Earnings</span>
          </SegmentedControlTrigger>
          <SegmentedControlTrigger value="payouts" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <Icon name="Wallet" size={12} className="sm:h-4 sm:w-4" />
            <span>Payouts</span>
          </SegmentedControlTrigger>
        </SegmentedControlList>

        <SegmentedControlContent value="earnings" className="space-y-4 sm:space-y-6">
          <EarningsHistoryChart />
          <EarningsBreakdownCard />
          <EarningsSourceBreakdown />
        </SegmentedControlContent>

        <SegmentedControlContent value="payouts" className="space-y-4 sm:space-y-6">
          <EarningsDashboard />
        </SegmentedControlContent>
      </SegmentedControl>
    </div>
  );
}
