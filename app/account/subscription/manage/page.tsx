'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { ArrowLeft, Check, X, Clock, CreditCard, AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { SupporterIcon } from '../../../components/SupporterIcon';
import { getUserSubscription, cancelSubscription, listenToUserSubscription } from '../../../firebase/subscription';
import { PaymentFeatureGuard } from '../../../components/PaymentFeatureGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';

interface SubscriptionHistoryItem {
  id: string;
  date: string;
  amount: number;
  status: string;
  description: string;
}

export default function ManageSubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryItem[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // First, directly fetch the subscription data
    const fetchSubscriptionDirectly = async () => {
      try {
        console.log('Directly fetching subscription data for user:', user.uid);
        const subscriptionData = await getUserSubscription(user.uid);
        console.log('Direct subscription fetch result:', subscriptionData);

        if (subscriptionData) {
          setSubscription(subscriptionData);
          setLoading(false);

          // If we have a subscription, fetch payment history
          if (subscriptionData.status === 'active') {
            fetchPaymentHistory(user.uid);
          }
        }
      } catch (error) {
        console.error('Error directly fetching subscription:', error);
      }
    };

    fetchSubscriptionDirectly();

    // Set up subscription listener as a backup
    const unsubscribe = listenToUserSubscription(user.uid, (userSubscription) => {
      console.log('Subscription data received from listener:', userSubscription);
      setSubscription(userSubscription);
      setLoading(false);

      // If we have a subscription, fetch payment history
      if (userSubscription && userSubscription.status === 'active') {
        fetchPaymentHistory(user.uid);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, router]);

  const fetchPaymentHistory = async (userId: string) => {
    try {
      const response = await fetch(`/api/payment-history?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setSubscriptionHistory(data.payments || []);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !subscription.stripeSubscriptionId) return;

    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to cancel your subscription? This will stop all future payments and remove your supporter badge.')) {
      return;
    }

    try {
      setCancelLoading(true);
      setError(null);
      setSuccess(null);

      // Call the cancel subscription function
      const result = await cancelSubscription(subscription.stripeSubscriptionId);

      // Check if this was a "no subscription found" case, which we now treat as success
      if (result.noSubscription) {
        console.log('No active subscription found to cancel');
        setSuccess('No active subscription found.');

        // Force a complete refresh of the subscription data
        if (user) {
          // First clear the current subscription state
          setSubscription(null);

          // Then fetch fresh data after a short delay to ensure Firestore has updated
          setTimeout(async () => {
            try {
              const subscriptionData = await getUserSubscription(user.uid);
              console.log('Refreshed subscription data:', subscriptionData);
              setSubscription(subscriptionData);

              // If we still have subscription data, force a page refresh
              if (subscriptionData && subscriptionData.status !== 'canceled') {
                console.log('Subscription data still exists, forcing page refresh');
                window.location.reload();
              }
            } catch (refreshError) {
              console.error('Error refreshing subscription data:', refreshError);
            }
          }, 1000);
        }
        return;
      }

      setSuccess('Your subscription has been canceled successfully.');
    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      setError(err.message || 'Failed to cancel subscription. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };



  const getTierName = (tier: string | null) => {
    if (!tier) return 'No Subscription';
    return tier === 'tier1' ? 'Tier 1' :
           tier === 'tier2' ? 'Tier 2' :
           tier === 'tier3' ? 'Tier 3' : 'Custom';
  };

  const isActive = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
  const isCanceled = subscription && subscription.status === 'canceled';
  const isPastDue = subscription && subscription.status === 'past_due';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/account" className="inline-flex items-center text-blue-500 hover:text-blue-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Account
          </Link>
        </div>

        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <PaymentFeatureGuard redirectTo="/account">
      <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/account" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manage Subscription</h1>
        <p className="text-muted-foreground">
          View and manage your WeWrite subscription details.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
          <Check className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="details" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Subscription Details</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              {isActive && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg">
                    <div className="flex-shrink-0">
                      <SupporterIcon tier={subscription.tier} status="active" size="lg" />
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-medium flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Active Subscription</span>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {getTierName(subscription.tier)} - ${subscription.amount}/month
                      </p>
                      {subscription.billingCycleEnd && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Next payment: {new Date(subscription.billingCycleEnd).toLocaleDateString()}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Subscription Actions</h3>
                      <div className="flex flex-col gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 justify-center"
                          onClick={handleCancelSubscription}
                          disabled={cancelLoading}
                        >
                          {cancelLoading ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                              <span>Canceling...</span>
                            </>
                          ) : (
                            <>
                              <X className="h-4 w-4" />
                              <span>Cancel Subscription</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 justify-center"
                          asChild
                        >
                          <Link href="/subscription">
                            <CreditCard className="h-4 w-4" />
                            <span>Change Subscription Tier</span>
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-2">Payment Methods</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 w-full justify-center"
                      >
                        <CreditCard className="h-4 w-4" />
                        <span>Manage Payment Methods</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isCanceled && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                    <div className="flex-shrink-0">
                      <SupporterIcon tier={null} status="canceled" size="lg" />
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-medium flex items-center gap-2">
                        <X className="h-4 w-4 text-destructive" />
                        <span>Subscription Canceled</span>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Your subscription has been canceled.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="default"
                    className="flex items-center gap-2 w-full sm:w-auto"
                    asChild
                  >
                    <Link href="/subscription">
                      <CreditCard className="h-4 w-4" />
                      <span>Reactivate Subscription</span>
                    </Link>
                  </Button>
                </div>
              )}

              {isPastDue && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-medium text-amber-800 dark:text-amber-300">Payment Issue</h3>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        There was a problem with your last payment. Please update your payment method.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="default"
                    className="flex items-center gap-2"
                    asChild
                  >
                    <Link href="/subscription">
                      <CreditCard className="h-4 w-4" />
                      <span>Update Payment Method</span>
                    </Link>
                  </Button>
                </div>
              )}

              {!subscription && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                    <div className="flex-shrink-0">
                      <SupporterIcon tier={null} status={null} size="lg" />
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-medium">No Active Subscription</h3>
                      <p className="text-sm text-muted-foreground">
                        Subscribe to support WeWrite and get a badge on your profile.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="default"
                    className="flex items-center gap-2"
                    asChild
                  >
                    <Link href="/subscription">
                      <CreditCard className="h-4 w-4" />
                      <span>Subscribe Now</span>
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment-methods">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              {subscription && subscription.status === 'active' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    {/* Primary Payment Method */}
                    <div className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <CreditCard className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium">Primary Payment Method</h3>
                            <p className="text-sm text-muted-foreground">Used for all subscription charges</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Update
                        </Button>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-card p-2 rounded-md">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                              <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">•••• •••• •••• {subscription.lastFourDigits || '4242'}</p>
                            <p className="text-xs text-muted-foreground">Expires {subscription.expiryMonth || '12'}/{subscription.expiryYear || '25'}</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Default
                        </span>
                      </div>
                    </div>

                    {/* Backup Payment Method */}
                    <div className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-muted p-2 rounded-full">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-medium">Backup Payment Method</h3>
                            <p className="text-sm text-muted-foreground">Used if primary payment fails</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Add
                        </Button>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                        <p className="text-muted-foreground mb-2">No backup payment method added</p>
                        <p className="text-xs text-muted-foreground">Adding a backup payment method ensures your subscription continues if your primary payment method fails</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">You need an active subscription to manage payment methods.</p>
                  <Button onClick={() => router.push('/subscription')}>
                    Subscribe Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionHistory.length > 0 ? (
                <>
                  {/* Desktop view - Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Amount</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptionHistory.map((item, index) => (
                          <tr key={item.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{new Date(item.date).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">${item.amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                item.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}>
                                {item.status === 'succeeded' ? 'Paid' :
                                 item.status === 'failed' ? 'Failed' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile view - Cards */}
                  <div className="md:hidden space-y-4">
                    {subscriptionHistory.map((item) => (
                      <div key={item.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{new Date(item.date).toLocaleDateString()}</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            item.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {item.status === 'succeeded' ? 'Paid' :
                             item.status === 'failed' ? 'Failed' : 'Pending'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">${item.amount.toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground">{item.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No payment history available.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>





      </div>
    </PaymentFeatureGuard>
  );
}
