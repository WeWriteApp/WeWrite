'use client';

import { useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SegmentedControl, SegmentedControlContent, SegmentedControlList, SegmentedControlTrigger } from "../../components/ui/segmented-control";
import { DollarSign, Wallet, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';

import SimpleEarningsDashboard from '../../components/payments/SimpleEarningsDashboard';
import EarningsBreakdownCard from '../../components/payments/EarningsBreakdownCard';
import EarningsSourceBreakdown from '../../components/payments/EarningsSourceBreakdown';
import EarningsHistoryChart from '../../components/payments/EarningsHistoryChart';
import { getAnalyticsService } from '../../utils/analytics-service';
import { SETTINGS_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';

export default function EarningsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { hasActiveSubscription } = useSubscription();

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
      {/* Beta Warning Banner */}
      <div className="wewrite-card mb-6 border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h3 className="font-semibold text-foreground">Earnings are still in beta</h3>
            {hasActiveSubscription ? (
              <p className="text-sm text-muted-foreground">
                Your subscription funds help us pay for developers to resolve this problem. We'll make an announcement once it's working!
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  As of December 2025 users are unable to get payouts. We're trying to resolve this, and if you'd like to support development please start your subscription, as that helps us with development costs.
                </p>
                <Button
                  size="sm"
                  onClick={() => router.push('/settings/fund-account')}
                  className="mt-2"
                >
                  Start subscription
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Segmented Control Interface */}
      <SegmentedControl defaultValue="earnings" className="space-y-4 sm:space-y-6" urlNavigation="query" queryParam="tab">
        <SegmentedControlList className="grid w-full grid-cols-2">
          <SegmentedControlTrigger value="earnings" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Earnings</span>
          </SegmentedControlTrigger>
          <SegmentedControlTrigger value="payouts" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Payouts</span>
          </SegmentedControlTrigger>
        </SegmentedControlList>

        <SegmentedControlContent value="earnings" className="space-y-4 sm:space-y-6">
          <EarningsHistoryChart />
          <EarningsBreakdownCard />
          <EarningsSourceBreakdown />
        </SegmentedControlContent>

        <SegmentedControlContent value="payouts" className="space-y-4 sm:space-y-6">
          <SimpleEarningsDashboard />
        </SegmentedControlContent>
      </SegmentedControl>
    </div>
  );
}
