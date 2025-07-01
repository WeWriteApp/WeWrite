'use client';

import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useRouter } from 'next/navigation';
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ChevronLeft, DollarSign, Wallet } from 'lucide-react';
import WriterTokenDashboard from '../../components/payments/WriterTokenDashboard';
import WriterEarningsFeatureGuard from '../../components/payments/WriterEarningsFeatureGuard';
import { PayoutsManager } from '../../components/payments/PayoutsManager';

export default function EarningsPage() {
  const { session } = useCurrentAccount();
  const router = useRouter();

  if (!session) {
    return null;
  }

  return (
    <div>
      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
            className="mr-3"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Earnings</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Desktop Header */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Earnings</h1>
        </div>

        {/* Tabbed Interface */}
            <Tabs defaultValue="earnings" className="space-y-6" urlNavigation="hash">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="earnings" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Earnings
                </TabsTrigger>
                <TabsTrigger value="payouts" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Payouts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="earnings" className="space-y-6">
                <WriterEarningsFeatureGuard>
                  <WriterTokenDashboard />
                </WriterEarningsFeatureGuard>
              </TabsContent>

              <TabsContent value="payouts" className="space-y-6">
                <PayoutsManager />
              </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}