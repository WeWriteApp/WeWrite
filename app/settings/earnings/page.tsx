'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ChevronLeft, DollarSign, Wallet } from 'lucide-react';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import WriterTokenDashboard from '../../components/payments/WriterTokenDashboard';
// WriterEarningsFeatureGuard removed - all features are now always enabled
import { PayoutsManager } from '../../components/payments/PayoutsManager';

export default function EarningsPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) {
    return null;
  }

  return (
    <div>
      <SettingsPageHeader
        title="Earnings"
        description="Track your earnings and manage payouts"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-8">

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
                <WriterTokenDashboard />
              </TabsContent>

              <TabsContent value="payouts" className="space-y-4 sm:space-y-6">
                <PayoutsManager />
              </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}