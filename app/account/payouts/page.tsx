"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft, ExternalLink, AlertCircle, CheckCircle, DollarSign, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { createConnectAccount, getConnectAccountStatus, getPayoutHistory } from '../../services/stripeConnectService';
import PayoutHistoryTable from '../../components/PayoutHistoryTable';

export default function PayoutsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<any>(null);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    loadAccountStatus();
  }, [user, router]);

  const loadAccountStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to get existing account status
      const status = await getConnectAccountStatus(user.uid);
      setAccountStatus(status);

      // Load payout history
      const history = await getPayoutHistory(user.uid);
      setPayoutHistory(history.payouts || []);
    } catch (err: any) {
      // If no account exists, the error is expected
      if (err.message.includes('No Stripe Connect account found')) {
        setAccountStatus(null);
      } else {
        setError(err.message || 'Failed to load account status');
        console.error('Error loading account status:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await createConnectAccount(user.uid);
      setAccountStatus(result);

      // Redirect to Stripe onboarding if we have an account link
      if (result.accountLink) {
        window.location.href = result.accountLink;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create Stripe Connect account');
      console.error('Error creating account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueOnboarding = () => {
    if (accountStatus?.accountLink) {
      window.location.href = accountStatus.accountLink;
    }
  };

  const handleViewDashboard = () => {
    if (accountStatus?.loginLink) {
      window.open(accountStatus.loginLink, '_blank');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/account" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payouts</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your payout settings and view your earnings from donations.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">Payout History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payout Status</CardTitle>
                  <CardDescription>Your current payout setup status</CardDescription>
                </CardHeader>
                <CardContent>
                  {!accountStatus ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Not Set Up</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        You need to set up your Stripe Connect account to receive payouts.
                      </p>
                      <Button
                        onClick={handleCreateAccount}
                        className="w-full"
                      >
                        Set Up Payouts
                      </Button>
                    </div>
                  ) : accountStatus.accountStatus === 'incomplete' ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <Clock className="h-12 w-12 text-amber-500 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Onboarding Incomplete</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        You need to complete your Stripe Connect onboarding to receive payouts.
                      </p>
                      <Button
                        onClick={handleContinueOnboarding}
                        className="w-full"
                      >
                        Continue Onboarding
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Ready to Receive Payouts</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Your Stripe Connect account is set up and ready to receive payouts.
                      </p>
                      <Button
                        onClick={handleViewDashboard}
                        variant="outline"
                        className="w-full flex items-center justify-center"
                      >
                        View Stripe Dashboard
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Earnings Overview</CardTitle>
                  <CardDescription>Your earnings from donations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Month Earnings</span>
                      <span className="font-medium">
                        ${calculateCurrentMonthEarnings(payoutHistory).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Earnings</span>
                      <span className="font-medium">
                        ${calculateTotalEarnings(payoutHistory).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Next Payout Date</span>
                      <span className="font-medium">
                        {getNextPayoutDate()}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={() => setActiveTab('history')}
                  >
                    View Payout History
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>How Payouts Work</CardTitle>
                  <CardDescription>Understanding the payout process</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2 mt-1">
                        <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Monthly Payouts</h4>
                        <p className="text-sm text-muted-foreground">
                          Payouts are processed at the end of each month for all donations received.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2 mt-1">
                        <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Platform Fee</h4>
                        <p className="text-sm text-muted-foreground">
                          WeWrite takes a 10% platform fee from all donations.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2 mt-1">
                        <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Stripe Fees</h4>
                        <p className="text-sm text-muted-foreground">
                          Stripe may charge additional processing fees on payouts.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>View your past payouts</CardDescription>
              </CardHeader>
              <CardContent>
                <PayoutHistoryTable payouts={payoutHistory} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payout Settings</CardTitle>
                <CardDescription>Manage your payout preferences</CardDescription>
              </CardHeader>
              <CardContent>
                {!accountStatus ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Not Set Up</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      You need to set up your Stripe Connect account to manage payout settings.
                    </p>
                    <Button
                      onClick={handleCreateAccount}
                      className="w-full"
                    >
                      Set Up Payouts
                    </Button>
                  </div>
                ) : accountStatus.accountStatus === 'incomplete' ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Clock className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Onboarding Incomplete</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      You need to complete your Stripe Connect onboarding to manage payout settings.
                    </p>
                    <Button
                      onClick={handleContinueOnboarding}
                      className="w-full"
                    >
                      Continue Onboarding
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Manage Payout Settings</span>
                      <Button
                        onClick={handleViewDashboard}
                        variant="outline"
                        size="sm"
                        className="flex items-center"
                      >
                        Stripe Dashboard
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You can manage your payout settings, including bank account information and payout schedule, through your Stripe Dashboard.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Helper functions for calculating earnings
function calculateCurrentMonthEarnings(payouts: any[]): number {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return payouts
    .filter(payout => {
      if (!payout.payoutDate) return false;
      const payoutDate = new Date(payout.payoutDate);
      return payoutDate.getMonth() === currentMonth && payoutDate.getFullYear() === currentYear;
    })
    .reduce((total, payout) => total + (payout.amount || 0), 0);
}

function calculateTotalEarnings(payouts: any[]): number {
  return payouts.reduce((total, payout) => total + (payout.amount || 0), 0);
}

function getNextPayoutDate(): string {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Format the date as Month Day, Year
  return lastDayOfMonth.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}
