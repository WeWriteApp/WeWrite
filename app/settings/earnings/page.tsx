'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { SegmentedControl, SegmentedControlContent, SegmentedControlList, SegmentedControlTrigger } from "../../components/ui/segmented-control";
import { DollarSign, Wallet } from 'lucide-react';

import SimpleEarningsDashboard from '../../components/payments/SimpleEarningsDashboard';
import EarningsBreakdownCard from '../../components/payments/EarningsBreakdownCard';
import EarningsSourceBreakdown from '../../components/payments/EarningsSourceBreakdown';

export default function EarningsPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) {
    return null;
  }

  return (
    <div className="p-6 lg:p-8">
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