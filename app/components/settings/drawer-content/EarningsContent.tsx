'use client';

import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../../providers/AuthProvider';
import { SegmentedControl, SegmentedControlContent, SegmentedControlList, SegmentedControlTrigger } from "../../ui/segmented-control";

import EarningsDashboard from '../../payments/EarningsDashboard';
import EarningsBreakdownCard from '../../payments/EarningsBreakdownCard';
import EarningsSourceBreakdown from '../../payments/EarningsSourceBreakdown';
import EarningsHistoryChart from '../../payments/EarningsHistoryChart';

interface EarningsContentProps {
  onClose: () => void;
}

export default function EarningsContent({ onClose }: EarningsContentProps) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="px-4 pb-6">
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
          <EarningsDashboard />
        </SegmentedControlContent>
      </SegmentedControl>
    </div>
  );
}
