'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../../providers/AuthProvider';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { SegmentedControl, SegmentedControlContent, SegmentedControlList, SegmentedControlTrigger } from "../../ui/segmented-control";
import { Button } from '../../ui/button';

import SimpleEarningsDashboard from '../../payments/SimpleEarningsDashboard';
import EarningsBreakdownCard from '../../payments/EarningsBreakdownCard';
import EarningsSourceBreakdown from '../../payments/EarningsSourceBreakdown';
import EarningsHistoryChart from '../../payments/EarningsHistoryChart';

interface EarningsContentProps {
  onClose: () => void;
}

export default function EarningsContent({ onClose }: EarningsContentProps) {
  const { user } = useAuth();
  const { hasActiveSubscription } = useSubscription();

  if (!user) {
    return null;
  }

  return (
    <div className="px-4 pb-6">
      {/* Beta Warning Banner */}
      <div className="wewrite-card mb-6 border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <Icon name="AlertCircle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
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
                  onClick={() => {
                    onClose();
                    window.location.href = '/settings/fund-account';
                  }}
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
      <SegmentedControl defaultValue="earnings" className="space-y-4 sm:space-y-6">
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
          <SimpleEarningsDashboard />
        </SegmentedControlContent>
      </SegmentedControl>
    </div>
  );
}
