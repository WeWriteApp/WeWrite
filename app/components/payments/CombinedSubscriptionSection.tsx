"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// Removed enhanced subscription error logging imports
import { 
  CreditCard, 
  Plus, 
  Settings, 
  Heart, 
  ExternalLink, 
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Link from 'next/link';
// REMOVED: Direct Firebase imports - now using API-first approach
import { PaymentMethodSetup } from './PaymentMethodSetup';
import { FailedPaymentRecovery } from './FailedPaymentRecovery';
import { SubscriptionModification } from './SubscriptionModification';
import { getSubscriptionStatusInfo } from '../../utils/subscriptionStatus';

interface Subscription {
  id: string;
  amount: number;
  status: string;
  currentPeriodEnd: any;
  pledgedAmount?: number;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isPrimary: boolean;
}

interface Pledge {
  id: string;
  pageId: string;
  amount: number;
  createdAt: any;
  pageTitle?: string;
  authorUsername?: string;
  authorDisplayName?: string;
}

function CombinedSubscriptionSectionInner() {
  const { user } = useAuth();


  // Removed enhanced error tracking

  // Always declare all hooks - this prevents the hooks order from changing
  // Subscription state
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);

  // Pledges state
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [pledgesLoading, setPledgesLoading] = useState(true);
  const [pledgesError, setPledgesError] = useState<string | null>(null);

  // Payment method setup state
  const [showPaymentMethodSetup, setShowPaymentMethodSetup] = useState(false);

  // CRITICAL: Function declarations are hoisted and avoid temporal dead zone issues
  function setupSubscriptionListener() {
    try {
      setSubscriptionLoading(true);
      setSubscriptionError(null);

      // Use API-first approach instead of complex optimized subscription
      try {
        const response = await fetch('/api/account-subscription');
        if (response.ok) {
          const data = await response.json();
          const subscriptionData = data.hasSubscription ? data.fullData : null;
          setSubscriptionError(null);
          setSubscription(subscriptionData);
          console.log('[CombinedSubscriptionSection] Received subscription data:', subscriptionData);
        } else {
          setSubscriptionError('Failed to load subscription details');
        }
      } catch (error) {
        console.error('Error processing subscription:', error);
        setSubscriptionError('Failed to load subscription details');
      } finally {
        setSubscriptionLoading(false);
      }

      // No cleanup needed for API calls
      return () => {};
    } catch (error) {
      console.error('Error setting up subscription listener:', error);
      setSubscriptionError('Failed to load subscription');
      setSubscriptionLoading(false);
      return () => {}; // Return empty cleanup function
    }
  }

  async function fetchPaymentMethods() {
    try {
      setPaymentMethodsLoading(true);
      setPaymentMethodsError(null);

      const response = await fetch('/api/payment-methods');

      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      } else {
        const errorData = await response.json();
        setPaymentMethodsError(errorData.error || 'Failed to load payment methods');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      setPaymentMethodsError('Failed to load payment methods');
    } finally {
      setPaymentMethodsLoading(false);
    }
  }

  async function fetchPledges() {
    try {
      setPledgesLoading(true);
      setPledgesError(null);

      // Use API-first approach for pledges instead of real-time listeners
      const response = await fetch('/api/pledges/list');
      if (response.ok) {
        const data = await response.json();
        setPledges(data.pledges || []);
      } else {
        setPledgesError('Failed to load pledges');
      }
    } catch (error) {
      console.error('Error fetching pledges:', error);
      setPledgesError('Failed to load pledges');
    } finally {
      setPledgesLoading(false);
    }
  }

  // CRITICAL: All hooks must be called before any early returns
  useEffect(() => {
    return trackEffect('subscriptionAndPaymentSetup', () => {
      if (user?.uid) {
        const unsubscribeSubscription = setupSubscriptionListener();
        fetchPaymentMethods();
        fetchPledges();

        // Cleanup function
        return () => {
          if (unsubscribeSubscription) {
            unsubscribeSubscription();
          }
        };
      }
    });
  }, [user, trackEffect]);



  function handlePaymentMethodAdded() {
    setShowPaymentMethodSetup(false);
    // Refresh payment methods
    fetchPaymentMethods();
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'}).format(amount);
  };

  const getStatusBadge = (subscription: Subscription) => {
    const statusInfo = getSubscriptionStatusInfo(
      subscription.status,
      subscription.cancelAtPeriodEnd,
      subscription.currentPeriodEnd
    );

    return (
      <Badge variant={statusInfo.variant}>
        <span className={statusInfo.color}>
          {statusInfo.displayText}
        </span>
      </Badge>
    );
  };

  const getCardBrandIcon = (brand: string) => {
    return <CreditCard className="h-4 w-4" />;
  };

  const primaryMethod = paymentMethods.find(method => method.isPrimary);
  const totalPledged = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>
          Manage your subscription, payment methods, and active pledges
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" urlNavigation="hash" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
            <TabsTrigger value="pledges">Active Pledges</TabsTrigger>
            <TabsTrigger value="modify">Modify Plan</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {subscriptionLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : subscriptionError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{subscriptionError}</AlertDescription>
              </Alert>
            ) : !subscription ? (
              <div className="text-center py-6">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No active subscription</h3>
                <p className="text-muted-foreground mb-4">
                  Start a subscription to support pages and access premium features.
                </p>
                <Button asChild>
                  <Link href="/settings/subscription">
                    Start Subscription
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Failed Payment Recovery - Show first if payment failed */}
                {subscription && (
                  <FailedPaymentRecovery
                    subscription={subscription}
                    onPaymentSuccess={() => {
                      // Refresh subscription data after successful payment
                      setupSubscriptionListener();
                    }}
                  />
                )}

                {/* Subscription Status */}
                <div className="flex items-center justify-between p-4 border-theme-strong rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Monthly Subscription</h4>
                      {subscription?.status && getStatusBadge(subscription)}
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(subscription?.amount || 0)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(subscription?.pledgedAmount || 0)} pledged • {formatCurrency(subscription && subscription.amount !== undefined ? Math.max(0, subscription.amount - (subscription.pledgedAmount || 0)) : 0)} available
                    </p>
                  </div>
                  <Button variant="secondary" asChild>
                    <Link href="/settings/subscription/manage">
                      <Settings className="h-4 w-4 mr-2" />
                      Manage
                    </Link>
                  </Button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border-theme-strong rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Active Pledges</span>
                    </div>
                    <p className="text-xl font-bold">{pledges.length}</p>
                  </div>
                  <div className="p-3 border-theme-strong rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Total Pledged</span>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(totalPledged)}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payment-methods" className="space-y-4">
            {paymentMethodsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : paymentMethodsError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{paymentMethodsError}</AlertDescription>
              </Alert>
            ) : paymentMethods.length === 0 ? (
              showPaymentMethodSetup ? (
                <div className="space-y-4">
                  <PaymentMethodSetup
                    showTitle={false}
                    onSuccess={handlePaymentMethodAdded}
                    onCancel={() => setShowPaymentMethodSetup(false)}
                  />
                </div>
              ) : (
                <div className="text-center py-6">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No payment methods</h3>
                  <p className="text-muted-foreground mb-4">
                    Add a payment method to enable subscriptions and support pages.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => setShowPaymentMethodSetup(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Payment Method
                    </Button>
                    {!subscription && (
                      <Button variant="secondary" asChild>
                        <Link href="/settings/subscription">
                          Start Subscription
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-3">
                {showPaymentMethodSetup && (
                  <div className="border-theme-strong rounded-lg p-4 bg-muted/20">
                    <PaymentMethodSetup
                      showTitle={false}
                      onSuccess={handlePaymentMethodAdded}
                      onCancel={() => setShowPaymentMethodSetup(false)}
                    />
                  </div>
                )}

                {/* Primary Payment Method */}
                {primaryMethod && (
                  <div className="flex items-center justify-between p-3 border-theme-strong rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      {getCardBrandIcon(primaryMethod.brand)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">•••• {primaryMethod.last4}</span>
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {primaryMethod.brand.toUpperCase()} • Expires {primaryMethod.expMonth}/{primaryMethod.expYear}
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/settings/subscription/manage">
                        Update
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Other Payment Methods */}
                {paymentMethods.filter(method => !method.isPrimary).map((method) => (
                  <div key={method.id} className="flex items-center justify-between p-3 border-theme-strong rounded-lg">
                    <div className="flex items-center gap-3">
                      {getCardBrandIcon(method.brand)}
                      <div>
                        <span className="font-medium">•••• {method.last4}</span>
                        <p className="text-sm text-muted-foreground">
                          {method.brand.toUpperCase()} • Expires {method.expMonth}/{method.expYear}
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/settings/subscription/manage">
                        Manage
                      </Link>
                    </Button>
                  </div>
                ))}

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShowPaymentMethodSetup(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pledges" className="space-y-4">
            {pledgesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : pledgesError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{pledgesError}</AlertDescription>
              </Alert>
            ) : pledges.length === 0 ? (
              <div className="text-center py-6">
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No active pledges</h3>
                <p className="text-muted-foreground mb-4">
                  Start supporting your favorite pages and writers.
                </p>
                <Button asChild>
                  <Link href="/">
                    Explore Pages
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary */}
                <div className="flex items-center justify-between p-3 border-theme-strong rounded-lg bg-muted/50">
                  <div>
                    <h4 className="font-medium">Total Monthly Pledges</h4>
                    <p className="text-sm text-muted-foreground">{pledges.length} active pledges</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{formatCurrency(totalPledged)}</p>
                    <p className="text-sm text-muted-foreground">per month</p>
                  </div>
                </div>

                {/* Individual Pledges */}
                {pledges.map((pledge) => (
                  <div
                    key={pledge.id}
                    className="flex items-center justify-between p-3 border-theme-strong rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/${pledge.pageId}`}
                          className="font-medium text-sm hover:text-primary truncate"
                        >
                          {pledge.pageTitle}
                        </Link>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </div>
                      {pledge.authorUsername && (
                        <p className="text-xs text-muted-foreground">
                          by @{pledge.authorUsername}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(pledge.amount)}</p>
                      <p className="text-xs text-muted-foreground">per month</p>
                    </div>
                  </div>
                ))}

                <Button variant="secondary" className="w-full" asChild>
                  <Link href="/settings/subscription/manage">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage All Pledges
                  </Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="modify" className="space-y-4">
            {subscription && subscription.status === 'active' ? (
              <SubscriptionModification
                subscription={subscription}
                onModificationSuccess={() => {
                  // Refresh subscription data after successful modification
                  setupSubscriptionListener();
                }}
              />
            ) : (
              <div className="text-center py-8">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
                <p className="text-muted-foreground mb-4">
                  You need an active subscription to modify your plan.
                </p>
                <Button asChild>
                  <Link href="/settings/subscription">
                    Start Subscription
                  </Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            <div className="space-y-3">
              <Button className="w-full" asChild>
                <Link href="/settings/subscription/manage">
                  <Settings className="h-4 w-4 mr-2" />
                  Full Subscription Management
                </Link>
              </Button>
              
              {subscription && (
                <Button variant="secondary" className="w-full" asChild>
                  <Link href="/settings/subscription/manage">
                    View Payment History
                  </Link>
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Export the component directly (removed error boundary wrapper)
export function CombinedSubscriptionSection() {
  return <CombinedSubscriptionSectionInner />;
}