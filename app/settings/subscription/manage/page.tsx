'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { ArrowLeft, Check, X, Clock, CreditCard, AlertTriangle, Settings, Edit2, DollarSign, Copy, ExternalLink, Pause, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Input } from '../../../components/ui/input';
import { SupporterIcon } from '../../../components/payments/SupporterIcon';
import { cancelSubscription, listenToUserSubscription } from '../../../firebase/subscription';
import { getOptimizedUserSubscription, createOptimizedSubscriptionListener } from '../../../firebase/optimizedSubscription';
import { useFeatureFlag } from '../../../utils/feature-flags';
import OpenCollectiveSupport from '../../../components/payments/OpenCollectiveSupport';
import { ErrorCopyButton } from '../../../components/ui/copy-button';
import { createPortalSession } from '../../../services/stripeService';
import { useConfirmation } from '../../../hooks/useConfirmation';
import ConfirmationModal from '../../../components/utils/ConfirmationModal';

interface SubscriptionHistoryItem {
  id: string;
  date: string;
  amount: number;
  status: string;
  description: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isPrimary: boolean;
}

export default function ManageSubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);

  // Custom modal hooks
  const { confirmationState, confirm, closeConfirmation } = useConfirmation();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [updateAmountLoading, setUpdateAmountLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [newAmount, setNewAmount] = useState<string>('');

  // All hooks must be called before any conditional returns
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // First, directly fetch the subscription data with optimization
    const fetchSubscriptionDirectly = async () => {
      try {
        console.log('Directly fetching optimized subscription data for user:', user.uid);
        const subscriptionData = await getOptimizedUserSubscription(user.uid, {
          useCache: true,
          cacheTTL: 10 * 60 * 1000, // 10 minutes cache
          verbose: process.env.NODE_ENV === 'development'
        });
        console.log('Direct optimized subscription fetch result:', subscriptionData);

        if (subscriptionData) {
          setSubscription(subscriptionData);
          setNewAmount(subscriptionData.amount?.toString() || '');
          setLoading(false);

          // If we have a subscription, fetch payment history and payment methods
          if ((subscriptionData as any).status === 'active') {
            fetchPaymentHistory(user.uid);
            fetchPaymentMethods();
          }
        }
      } catch (error) {
        console.error('Error directly fetching optimized subscription:', error);
      }
    };

    fetchSubscriptionDirectly();

    // Set up optimized subscription listener with throttling
    const unsubscribe = createOptimizedSubscriptionListener(user.uid, (userSubscription) => {
      console.log('Subscription data received from optimized listener:', userSubscription);
      setSubscription(userSubscription);
      setNewAmount(userSubscription?.amount?.toString() || '');
      setLoading(false);

      // If we have a subscription, fetch payment history and payment methods
      if (userSubscription && userSubscription.status === 'active') {
        fetchPaymentHistory(user.uid);
        fetchPaymentMethods();
      }
    }, { verbose: process.env.NODE_ENV === 'development' });

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

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const handleUpdateAmount = async () => {
    if (!subscription || !newAmount) return;

    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 5) {
      setError('Amount must be at least $5.00');
      return;
    }

    try {
      setUpdateAmountLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/activate-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: 'custom',
          customAmount: Math.round(amount * 100), // Convert to cents
          userId: user?.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subscription amount');
      }

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe checkout for payment method update
        window.location.href = data.url;
      } else {
        setSuccess('Subscription amount updated successfully.');
        setIsEditingAmount(false);
      }
    } catch (err: any) {
      console.error('Error updating subscription amount:', err);
      setError(err.message || 'Failed to update subscription amount. Please try again.');
    } finally {
      setUpdateAmountLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingAmount(false);
    setNewAmount(subscription?.amount?.toString() || '');
    setError(null);
  };

  const handleManagePaymentMethods = async () => {
    if (!user?.uid) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);
      const result = await createPortalSession(user.uid);
      if (result.error) {
        setError(result.error);
      }
      // If successful, user will be redirected to Stripe Customer Portal
    } catch (err: any) {
      console.error('Error opening payment methods:', err);
      setError(err.message || 'Failed to open payment methods. Please try again.');
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !subscription.stripeSubscriptionId) return;

    // Show confirmation dialog
    const confirmed = await confirm({
      title: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your subscription? This will stop all future payments and remove your supporter badge.',
      confirmText: 'Cancel Subscription',
      cancelText: 'Keep Subscription',
      variant: 'destructive',
      icon: 'warning'
    });

    if (!confirmed) {
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
              const subscriptionData = await getOptimizedUserSubscription(user.uid, {
                useCache: false, // Force fresh data
                verbose: true
              });
              console.log('Refreshed subscription data:', subscriptionData);
              setSubscription(subscriptionData);

              // If we still have subscription data, force a page refresh
              if (subscriptionData && (subscriptionData as any).status !== 'canceled') {
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

  // Show loading while user and feature flags are being loaded
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/settings" className="inline-flex items-center text-blue-500 hover:text-blue-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Link>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // If payments feature flag is disabled, show OpenCollective support instead
  if (!isPaymentsEnabled) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-4">
          <Link href="/settings" className="inline-flex items-center text-primary hover:text-primary/80 text-sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Settings
          </Link>
        </div>
        <OpenCollectiveSupport
          title="Subscription Management Coming Soon!"
          description="We're working on subscription functionality. In the meantime, please support WeWrite development through OpenCollective."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/settings" className="inline-flex items-center text-blue-500 hover:text-blue-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Link>
        </div>

        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/settings" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
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
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <ErrorCopyButton text={error} />
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-success/10 text-success-foreground border-theme-medium">
          <Check className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">{/* Single-page layout container */}

        {/* Current Subscription Status */}
        <Card className="wewrite-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isActive && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-success/10 border-theme-medium rounded-lg">
                  <div className="flex-shrink-0">
                    <SupporterIcon tier={subscription.tier} status="active" size="lg" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-medium flex items-center gap-2 text-green-800 dark:text-green-300">
                      <Check className="h-4 w-4" />
                      <span>Active Subscription</span>
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      ${subscription.amount}/month • {getTierName(subscription.tier)}
                    </p>
                    {subscription.billingCycleEnd && (
                      <p className="text-xs text-green-600 dark:text-green-500 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Next payment: {new Date(subscription.billingCycleEnd).toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="font-medium text-muted-foreground">Monthly Budget</div>
                    <div className="text-lg font-bold">${subscription.amount}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="font-medium text-muted-foreground">Status</div>
                    <div className="text-lg font-bold capitalize">{subscription.status}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="font-medium text-muted-foreground">Pledged Amount</div>
                    <div className="text-lg font-bold">${subscription.pledgedAmount || 0}</div>
                  </div>
                </div>
              </div>
            )}

            {isCanceled && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-destructive/10 border-theme-medium rounded-lg">
                  <div className="flex-shrink-0">
                    <SupporterIcon tier={null} status="canceled" size="lg" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-medium flex items-center gap-2 text-red-800 dark:text-red-300">
                      <X className="h-4 w-4" />
                      <span>Subscription Canceled</span>
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Your subscription has been canceled and will not renew.
                    </p>
                  </div>
                </div>
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
              </div>
            )}

            {!subscription && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-lg">
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
                  <Link href="/settings/subscription">
                    <CreditCard className="h-4 w-4" />
                    <span>Subscribe Now</span>
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modify Subscription Amount */}
        {isActive && (
          <Card className="wewrite-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Monthly Subscription Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Adjust your monthly subscription budget for pledging to pages. Changes will take effect on your next billing cycle.
                </p>

                <div className="flex items-center gap-4">
                  {!isEditingAmount ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">${subscription.amount}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingAmount(true)}
                        className="flex items-center gap-2"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit Amount
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min="5"
                          step="1"
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          className="w-24"
                          placeholder="50"
                        />
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdateAmount}
                          disabled={updateAmountLoading}
                          className="flex items-center gap-1"
                        >
                          {updateAmountLoading ? (
                            <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={updateAmountLoading}
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <strong>Note:</strong> Your subscription amount represents your monthly budget for pledging to pages.
                  You can allocate this budget across multiple pages, and any unused amount will remain in your account.
                  Minimum amount is $5.00.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Methods Management */}
        {isActive && (
          <Card className="wewrite-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Manage your payment methods, billing information, and view invoices through Stripe's secure portal.
                </p>

                {paymentMethods.length > 0 && (
                  <div className="space-y-3">
                    {paymentMethods.slice(0, 2).map((method) => (
                      <div key={method.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="bg-card p-2 rounded-md">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">•••• •••• •••• {method.last4}</p>
                            <p className="text-xs text-muted-foreground">
                              {method.brand.toUpperCase()} • Expires {method.expMonth}/{method.expYear}
                            </p>
                          </div>
                        </div>
                        {method.isPrimary && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Primary
                          </span>
                        )}
                      </div>
                    ))}

                    {paymentMethods.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{paymentMethods.length - 2} more payment method{paymentMethods.length > 3 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleManagePaymentMethods}
                  className="flex items-center gap-2 w-full sm:w-auto"
                >
                  <ExternalLink className="h-4 w-4" />
                  Manage Payment Methods
                </Button>

                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <strong>Secure Management:</strong> Payment method management is handled through Stripe's secure portal.
                  You can add, remove, or update payment methods, view billing history, and download invoices.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing History */}
        {(isActive || isCanceled) && (
          <Card className="wewrite-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Billing History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionHistory.length > 0 ? (
                <div className="space-y-4">
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
                        {subscriptionHistory.slice(0, 5).map((item, index) => (
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
                  <div className="md:hidden space-y-3">
                    {subscriptionHistory.slice(0, 5).map((item) => (
                      <div key={item.id} className="bg-muted/30 rounded-lg p-4 space-y-3">
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

                  {subscriptionHistory.length > 5 && (
                    <div className="text-center pt-4">
                      <Button
                        variant="outline"
                        onClick={handleManagePaymentMethods}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Full History
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No billing history available.</p>
                  <p className="text-sm mt-1">Payment history will appear here after your first charge.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Subscription Actions */}
        <Card className="wewrite-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Subscription Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isActive && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Subscription Management</h3>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 w-full justify-start"
                        asChild
                      >
                        <Link href="/subscription">
                          <CreditCard className="h-4 w-4" />
                          <span>Change Subscription Tier</span>
                        </Link>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManagePaymentMethods}
                        className="flex items-center gap-2 w-full justify-start"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Billing Portal</span>
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Subscription Control</h3>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelSubscription}
                        disabled={cancelLoading}
                        className="flex items-center gap-2 w-full justify-start text-destructive hover:text-destructive"
                      >
                        {cancelLoading ? (
                          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span>Cancel Subscription</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isCanceled && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your subscription has been canceled. You can reactivate it at any time to continue supporting WeWrite.
                  </p>

                  <Button
                    variant="default"
                    className="flex items-center gap-2"
                    asChild
                  >
                    <Link href="/subscription">
                      <Play className="h-4 w-4" />
                      <span>Reactivate Subscription</span>
                    </Link>
                  </Button>
                </div>
              )}

              {isPastDue && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    There was an issue with your payment. Please update your payment method to continue your subscription.
                  </p>

                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={handleManagePaymentMethods}
                      className="flex items-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Update Payment Method</span>
                    </Button>

                    <Button
                      variant="outline"
                      asChild
                    >
                      <Link href="/subscription">
                        <span>Change Plan</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {!subscription && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Start supporting WeWrite creators by subscribing today. Choose from our flexible plans or set a custom amount.
                  </p>

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

              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                <strong>Need Help?</strong> If you have questions about your subscription or need assistance,
                please contact our support team. All subscription changes are processed securely through Stripe.
              </div>
            </div>
          </CardContent>
        </Card>

      </div>{/* End single-page layout container */}

      {/* Custom Modals */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        variant={confirmationState.variant}
        icon={confirmationState.icon}
        isLoading={confirmationState.isLoading}
      />
    </div>
  );
}
