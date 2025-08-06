'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { DollarSign, Wallet } from 'lucide-react';
import WriterUsdDashboard from '../../components/payments/WriterUsdDashboard';
import { PayoutsManager } from '../../components/payments/PayoutsManager';
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
      {/* Tabbed Interface */}
      <Tabs defaultValue="earnings" className="space-y-4 sm:space-y-6" urlNavigation="hash">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="earnings" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Earnings</span>
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm">
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Payouts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="earnings" className="space-y-4 sm:space-y-6">
          <EarningsBreakdownCard />
          <EarningsSourceBreakdown />
          <WriterUsdDashboard />
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4 sm:space-y-6">
          <PayoutsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}