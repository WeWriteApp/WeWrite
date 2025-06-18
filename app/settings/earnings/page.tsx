'use client';

import { useAuth } from "../../providers/AuthProvider";
import { useRouter } from 'next/navigation';
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ChevronLeft, Coins, Wallet } from 'lucide-react';
import WriterTokenDashboard from '../../components/payments/WriterTokenDashboard';
import WriterEarningsFeatureGuard from '../../components/payments/WriterEarningsFeatureGuard';
import { PayoutsManager } from '../../components/payments/PayoutsManager';

export default function EarningsPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) {
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
          <p className="text-muted-foreground mt-1">Track earnings and request payouts</p>
        </div>

            {/* Tabbed Interface */}
            <Tabs defaultValue="earnings" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="earnings" className="flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Earnings
                </TabsTrigger>
                <TabsTrigger value="payouts" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Payouts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="earnings" className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Token Earnings</h2>
                    <p className="text-muted-foreground">
                      Tokens received from supporters.
                    </p>
                  </div>

                  <WriterEarningsFeatureGuard>
                    <WriterTokenDashboard />
                  </WriterEarningsFeatureGuard>
                </div>
              </TabsContent>

              <TabsContent value="payouts" className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Payouts</h2>
                    <p className="text-muted-foreground">
                      Set up bank account and request payouts.
                    </p>
                  </div>

                  <PayoutsManager />
                </div>
              </TabsContent>
            </Tabs>

            {/* Info Section */}
            <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                How It Works
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                <p>
                  <strong>Earnings:</strong> Supporters allocate tokens to your pages. Current month tokens are pending until month end.
                </p>
                <p>
                  <strong>Payouts:</strong> Set up bank account and request payouts when you meet the minimum.
                </p>
                <p>
                  <strong>Rate:</strong> 10 tokens = $1. Minimum payout $25.
                </p>
              </div>
        </div>
      </div>
    </div>
  );
}
